import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const {
  addKanjiInkEntryToDb,
  deleteKanjiInkEntryFromDb,
  deleteNoteFromDb,
  deleteNoteWithDependentsFromDb,
  getKanjiInkEntryFromDb,
  listKanjiInkEntriesFromDb,
  listNotesFromDb,
  openDatabase,
  putKanjiInkEntryToDb,
  putNoteToDb,
  restoreNoteWithDependentsToDb,
} = await import("../../core/storage.js");

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();

function makeNote(id = "note-ink") {
  return {
    id,
    title: "Kanji ink owner",
    content: "Canonical note content remains separate.",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

function makeEntry(overrides = {}) {
  return {
    id: "ink-1",
    noteId: "note-ink",
    schemaVersion: 1,
    revision: 1,
    character: "人",
    strokes: [
      [{ x: 0.55, y: 0.1 }, { x: 0.2, y: 0.9 }],
      [{ x: 0.55, y: 0.1 }, { x: 0.9, y: 0.9 }],
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

function openPopulatedV2Database(note, review) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      const notes = database.createObjectStore("notes", { keyPath: "id" });
      notes.createIndex("updatedAt", "updatedAt");
      notes.createIndex("pinned", "pinned");
      notes.createIndex("archived", "archived");
      notes.put(note);
      const reviews = database.createObjectStore("studyReviews", { keyPath: "noteId" });
      reviews.createIndex("nextReviewAt", "nextReviewAt");
      reviews.createIndex("notebookType", "notebookType");
      reviews.createIndex("status", "status");
      reviews.put(review);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readRawStore(database, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeRawEntry(database, entry) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").put(entry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

describe("Kanji ink storage schema and lifecycle", { concurrency: false }, () => {
  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  test("fresh database creates additive v3 store and indexes", async () => {
    const database = await openTestDatabase();
    const store = database.transaction("kanjiInkEntries", "readonly")
      .objectStore("kanjiInkEntries");

    assert.equal(database.version, 3);
    assert.deepEqual(
      [...database.objectStoreNames],
      ["kanjiInkEntries", "notes", "studyReviews"],
    );
    assert.deepEqual([...store.indexNames], ["noteId", "updatedAt"]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, "note-ink"), {
      entries: [],
      invalidCount: 0,
    });
  });

  test("v2 to v3 upgrade preserves notes and reviews byte-for-byte", async () => {
    const note = makeNote("legacy-v2-note");
    const review = {
      noteId: note.id,
      notebookType: "kanji",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: "2026-08-05T00:00:00.000Z",
      interval: 0,
      ease: 2.5,
    };
    const v2 = await openPopulatedV2Database(note, review);
    v2.close();

    const database = await openTestDatabase();
    assert.equal(database.version, 3);
    assert.deepEqual(await readRawStore(database, "notes"), [note]);
    assert.deepEqual(await readRawStore(database, "studyReviews"), [review]);
    assert.deepEqual(await readRawStore(database, "kanjiInkEntries"), []);
  });

  test("CRUD validates ownership, uses defensive copies, and preserves stable IDs", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const source = makeEntry();
    await putNoteToDb(database, note);

    const added = await addKanjiInkEntryToDb(database, source);
    source.strokes[0][0].x = 0;
    assert.equal(added.strokes[0][0].x, 0.55);
    assert.deepEqual(await getKanjiInkEntryFromDb(database, added.id), added);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, note.id), {
      entries: [added],
      invalidCount: 0,
    });

    const updated = {
      ...added,
      revision: 2,
      character: "木",
      updatedAt: "2026-08-04T01:00:00.000Z",
    };
    assert.deepEqual(await putKanjiInkEntryToDb(database, updated), updated);
    assert.deepEqual(await getKanjiInkEntryFromDb(database, added.id), updated);

    assert.deepEqual(await deleteKanjiInkEntryFromDb(database, added.id), updated);
    assert.equal(await getKanjiInkEntryFromDb(database, added.id), undefined);
  });

  test("orphan and duplicate writes fail without changing prior canonical data", async () => {
    const database = await openTestDatabase();
    await assert.rejects(
      () => addKanjiInkEntryToDb(database, makeEntry()),
      { code: "KANJI_NOTE_NOT_FOUND" },
    );

    await putNoteToDb(database, makeNote());
    const canonical = await addKanjiInkEntryToDb(database, makeEntry());
    await assert.rejects(
      () => addKanjiInkEntryToDb(database, makeEntry({ character: "木" })),
      { name: "ConstraintError" },
    );
    assert.deepEqual(await getKanjiInkEntryFromDb(database, canonical.id), canonical);
  });

  test("invalid persisted records are isolated from valid entries", async () => {
    const database = await openTestDatabase();
    await putNoteToDb(database, makeNote());
    const valid = await addKanjiInkEntryToDb(database, makeEntry());
    await writeRawEntry(database, {
      ...makeEntry({ id: "ink-invalid" }),
      character: "not-one-Han-character",
    });

    assert.deepEqual(await listKanjiInkEntriesFromDb(database, "note-ink"), {
      entries: [valid],
      invalidCount: 1,
    });
    assert.deepEqual((await readRawStore(database, "kanjiInkEntries")).length, 2);
  });

  test("note delete and restore capture ink entries atomically", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const first = makeEntry();
    const second = makeEntry({ id: "ink-2", character: "木" });
    await putNoteToDb(database, note);
    await addKanjiInkEntryToDb(database, first);
    await addKanjiInkEntryToDb(database, second);

    const capture = await deleteNoteWithDependentsFromDb(database, note.id);
    assert.deepEqual(capture, {
      note,
      review: undefined,
      kanjiInkEntries: [first, second],
    });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.deepEqual(await readRawStore(database, "kanjiInkEntries"), []);

    await restoreNoteWithDependentsToDb(database, capture);
    assert.deepEqual(await listNotesFromDb(database), [note]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, note.id), {
      entries: [first, second],
      invalidCount: 0,
    });
  });

  test("note deletion removes corrupt ink dependents while restoring valid entries", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const valid = makeEntry();
    await putNoteToDb(database, note);
    await addKanjiInkEntryToDb(database, valid);
    await writeRawEntry(database, makeEntry({
      id: "ink-corrupt",
      character: "not-one-Han-character",
    }));

    const capture = await deleteNoteWithDependentsFromDb(database, note.id);

    assert.deepEqual(capture, {
      note,
      review: undefined,
      kanjiInkEntries: [valid],
    });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.deepEqual(await readRawStore(database, "kanjiInkEntries"), []);

    await restoreNoteWithDependentsToDb(database, capture);
    assert.deepEqual(await listNotesFromDb(database), [note]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, note.id), {
      entries: [valid],
      invalidCount: 0,
    });
  });

  test("generic note lifecycle cascades ink and restores it during command undo", async () => {
    const database = await openTestDatabase();
    const note = makeNote();
    const entry = makeEntry();
    await putNoteToDb(database, note);
    await addKanjiInkEntryToDb(database, entry);

    await deleteNoteFromDb(database, note.id);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.deepEqual(await readRawStore(database, "kanjiInkEntries"), []);

    await putNoteToDb(database, note);
    assert.deepEqual(await listNotesFromDb(database), [note]);
    assert.deepEqual(await listKanjiInkEntriesFromDb(database, note.id), {
      entries: [entry],
      invalidCount: 0,
    });

    await deleteNoteFromDb(database, note.id);
    assert.deepEqual(await readRawStore(database, "kanjiInkEntries"), []);
  });
});
