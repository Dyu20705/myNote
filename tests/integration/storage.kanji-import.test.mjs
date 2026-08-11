import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const { restoreKanjiExportBundleToDb } = await import("../../core/kanjiInkImport.js");
const {
  createKanjiExportBundle,
  serializeKanjiExportBundle,
} = await import("../../core/kanjiInkProjection.js");
const {
  addKanjiInkEntryToDb,
  listKanjiInkEntriesFromDb,
  listNotesFromDb,
  openDatabase,
  putNoteToDb,
} = await import("../../core/storage.js");

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();

function makeNote(id = "import-note") {
  return {
    id,
    title: "Imported Kanji note",
    content: "Canonical imported content",
    blocks: [
      {
        id: "import-block",
        type: "paragraph",
        content: "Canonical imported content",
        meta: {},
      },
    ],
    tags: [],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    pinned: false,
    archived: false,
    links: [],
    ast: [{ type: "paragraph", text: "Canonical imported content" }],
    checksum: "64e5f0cb",
    version: 1,
    searchBlob: "imported kanji note canonical imported content  ",
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

function makeCanvasEntry(overrides = {}) {
  return {
    id: "import-ink-canvas",
    noteId: "import-note",
    strokes: [{
      tool: "marker",
      width: 0.024,
      points: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.2, y: 0.3, t: 12 }],
    }],
    paperStyle: "grid",
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    schemaVersion: 2,
    ...overrides,
  };
}

function makeLegacyGraph() {
  const shared = { raw: "keep" };
  const graph = { first: shared, second: shared };
  graph.self = graph;
  return graph;
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

  test("restores tagged schema-4 mixed ink atomically and losslessly", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const entry = makeEntry({
      legacyVendorField: {
        map: new Map([["keep", new Set([1n])]]),
        bytes: new Uint8Array([7, 8]),
        missing: undefined,
        graph: makeLegacyGraph(),
      },
    });
    const canvasEntry = makeCanvasEntry();
    const source = createKanjiExportBundle([note], [entry, canvasEntry], {
      exportedAt: "2026-08-04T02:00:00.000Z",
    });
    const bundle = JSON.parse(serializeKanjiExportBundle(source));

    const result = await restoreKanjiExportBundleToDb(database, bundle);
    assert.deepEqual(result, {
      importedNotes: 1,
      importedKanjiInkEntries: 2,
    });
    bundle.length = 0;

    assert.deepEqual(await listNotesFromDb(database), [note]);
    const listing = await listKanjiInkEntriesFromDb(database, note.id);
    assert.deepEqual(listing, {
      entries: [entry, canvasEntry],
      invalidCount: 0,
    });
    const graph = listing.entries[0].legacyVendorField.graph;
    assert.equal(graph.self, graph);
    assert.equal(graph.first, graph.second);
  });

  test("restores the exact historical schema-3 object bundle", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const entry = makeEntry();
    const historicalBundle = {
      schemaVersion: 3,
      exportedAt: "2026-08-04T02:00:00.000Z",
      notes: [note],
      kanjiInkEntries: [entry],
      recognizerAttribution: {
        engineId: "mynote-geometric-template",
        engineVersion: "1.0.0",
        datasetVersion: "mynote-kanji-mvp-1",
        source: "Project-owned geometric templates; no third-party runtime dataset.",
      },
    };

    assert.deepEqual(await restoreKanjiExportBundleToDb(database, historicalBundle), {
      importedNotes: 1,
      importedKanjiInkEntries: 1,
    });
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

  test("an ink-key collision rolls back a newly added note across stores", async () => {
    const database = await openTestDatabase();
    const existingNote = makeNote("existing-note");
    const existingEntry = makeEntry({ noteId: existingNote.id });
    await putNoteToDb(database, existingNote);
    await addKanjiInkEntryToDb(database, existingEntry);

    const importedNote = makeNote("new-note");
    const collidingEntry = makeEntry({ noteId: importedNote.id });
    const bundle = createKanjiExportBundle([importedNote], [collidingEntry], {
      exportedAt: "2026-08-04T02:00:00.000Z",
    });

    await assert.rejects(
      () => restoreKanjiExportBundleToDb(database, bundle),
      { name: "ConstraintError" },
    );
    assert.deepEqual(await listNotesFromDb(database), [existingNote]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, existingNote.id), {
      entries: [existingEntry],
      invalidCount: 0,
    });
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, importedNote.id), {
      entries: [],
      invalidCount: 0,
    });
  });

  test("hostile parsed tagged envelopes fail content-free before a transaction", async () => {
    let transactionCalls = 0;
    const database = {
      transaction() {
        transactionCalls += 1;
        throw new Error("transaction must not open");
      },
    };
    const cyclic = [];
    cyclic.push(cyclic);
    const getter = [];
    Object.defineProperty(getter, "0", {
      enumerable: true,
      get() {
        throw new Error("secret envelope content");
      },
    });
    getter.length = 1;
    let deep = ["null"];
    for (let index = 0; index < 20_000; index += 1) deep = ["array", [deep]];

    for (const input of [cyclic, getter, ["kanji-ink-json", 1, deep]]) {
      await assert.rejects(
        () => restoreKanjiExportBundleToDb(database, input),
        (error) => error.code === "KANJI_IMPORT_INVALID"
          && error.message === "KANJI_IMPORT_INVALID"
          && !error.message.includes("secret"),
      );
    }
    assert.equal(transactionCalls, 0);
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

  test("a non-canonical note is rejected before opening a transaction", async () => {
    let transactionCalls = 0;
    const database = {
      transaction() {
        transactionCalls += 1;
        throw new Error("transaction must not open");
      },
    };
    const bundle = createKanjiExportBundle([{ id: "x" }], [], {
      exportedAt: "2026-08-04T02:00:00.000Z",
    });

    await assert.rejects(
      () => restoreKanjiExportBundleToDb(database, bundle),
      {
        code: "KANJI_IMPORT_INVALID",
        message: "KANJI_IMPORT_INVALID",
      },
    );
    assert.equal(transactionCalls, 0);
  });
});
