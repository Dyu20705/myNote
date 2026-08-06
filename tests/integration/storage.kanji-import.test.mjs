import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const { createKanjiExportBundle } = await import("../../core/kanjiInkProjection.js");
const {
  listKanjiInkEntriesFromDb,
  listNotesFromDb,
  openDatabase,
  putNoteToDb,
  restoreKanjiExportBundleToDb,
} = await import("../../core/storage.js");

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();

function makeNote(id = "import-note") {
  return {
    id,
    title: "Imported Kanji note",
    content: "Canonical imported content",
    tags: [],
    links: [],
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

function makeEntry(overrides = {}) {
  return {
    id: "import-ink",
    noteId: "import-note",
    schemaVersion: 1,
    revision: 1,
    character: "人",
    strokes: [
      [{ x: 0.5, y: 0.1 }, { x: 0.2, y: 0.9 }],
      [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.9 }],
    ],
    recognizer: {
      engineId: "mynote-geometric-template",
      engineVersion: "1.0.0",
      datasetVersion: "mynote-kanji-mvp-1",
    },
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

function closeAllDatabaseHandles() {
  for (const database of openHandles) database.close();
  openHandles.clear();
}

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

async function openTestDatabase() {
  const database = await openDatabase();
  openHandles.add(database);
  return database;
}

describe("Kanji export bundle restore", { concurrency: false }, () => {
  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  test("restores validated notes and ink atomically with defensive copies", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const entry = makeEntry();
    const bundle = createKanjiExportBundle([note], [entry], {
      exportedAt: "2026-08-04T02:00:00.000Z",
    });

    const result = await restoreKanjiExportBundleToDb(database, bundle);
    assert.deepEqual(result, {
      importedNotes: 1,
      importedKanjiInkEntries: 1,
    });
    bundle.notes[0].title = "mutated caller";
    bundle.kanjiInkEntries[0].strokes[0][0].x = 0;

    assert.deepEqual(await listNotesFromDb(database), [note]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, note.id), {
      entries: [entry],
      invalidCount: 0,
    });
  });

  test("a note collision aborts without importing any entry", async () => {
    const database = await openTestDatabase();
    const existing = makeNote();
    await putNoteToDb(database, existing);
    const bundle = createKanjiExportBundle([existing], [makeEntry()], {
      exportedAt: "2026-08-04T02:00:00.000Z",
    });

    await assert.rejects(
      () => restoreKanjiExportBundleToDb(database, bundle),
      { name: "ConstraintError" },
    );
    assert.deepEqual(await listNotesFromDb(database), [existing]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, existing.id), {
      entries: [],
      invalidCount: 0,
    });
  });

  test("invalid bundle is rejected before opening a transaction", async () => {
    let transactionCalls = 0;
    const database = {
      transaction() {
        transactionCalls += 1;
        throw new Error("transaction must not open");
      },
    };

    await assert.rejects(
      () => restoreKanjiExportBundleToDb(database, {
        schemaVersion: 3,
        exportedAt: "not-a-date",
        notes: [],
        kanjiInkEntries: [],
        recognizerAttribution: {},
      }),
      { code: "KANJI_IMPORT_INVALID" },
    );
    assert.equal(transactionCalls, 0);
  });
});
