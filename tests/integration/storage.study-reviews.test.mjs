import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const {
  getStudyReviewFromDb,
  listNotesFromDb,
  listStudyReviewsFromDb,
  openDatabase,
} = await import("../../core/storage.js");

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();
const EXISTING_V1_NOTE = {
  id: "v1-note-with-nested-data",
  title: "Existing v1 note",
  content: "Existing note content",
  tags: ["legacy", "nested"],
  links: ["Neighbor"],
  blocks: [
    {
      id: "legacy-block",
      type: "paragraph",
      content: "Nested block content",
      meta: { source: "v1" },
    },
  ],
  ast: [
    { type: "paragraph", text: "Existing note content" },
    { type: "wikilink", target: "Neighbor" },
  ],
  updatedAt: "2026-07-30T00:00:00.000Z",
  pinned: true,
  archived: false,
};
const VALID_REVIEW = {
  noteId: "review-note",
  notebookType: "vocabulary",
  status: "new",
  lastReviewedAt: null,
  nextReviewAt: "2026-07-31T00:00:00.000Z",
  interval: 0,
  ease: 2.5,
};

function closeAllDatabaseHandles() {
  for (const database of openHandles) {
    database.close();
  }
  openHandles.clear();
}

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked by an open handle."));
  });
}

async function openTestDatabase() {
  const database = await openDatabase();
  openHandles.add(database);
  return database;
}

function openV1DatabaseWithExistingNote(note) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("notes", { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
      store.createIndex("pinned", "pinned");
      store.createIndex("archived", "archived");
      store.put(note);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function writeRawReview(database, review) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("studyReviews", "readwrite");
    transaction.objectStore("studyReviews").put(review);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function readRawReview(database, noteId) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("studyReviews", "readonly");
    const request = transaction.objectStore("studyReviews").get(noteId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openDatabaseObservingV1NoteAccess() {
  const methods = ["get", "getAll", "put", "openCursor"];
  const originals = Object.fromEntries(
    methods.map((method) => [method, globalThis.IDBObjectStore.prototype[method]]),
  );
  const noteStoreCalls = [];

  for (const method of methods) {
    globalThis.IDBObjectStore.prototype[method] = function (...args) {
      if (this.name === "notes") {
        noteStoreCalls.push(method);
      }
      return Reflect.apply(originals[method], this, args);
    };
  }

  try {
    const database = await openDatabase();
    openHandles.add(database);
    return { database, noteStoreCalls };
  } finally {
    for (const method of methods) {
      globalThis.IDBObjectStore.prototype[method] = originals[method];
    }
  }
}

describe("study review storage schema", { concurrency: false }, () => {
  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  test("fresh databases create the isolated v2 review schema", async () => {
    const database = await openTestDatabase();
    const notesStore = database.transaction("notes", "readonly").objectStore("notes");
    const reviewsStore = database.transaction("studyReviews", "readonly").objectStore("studyReviews");

    assert.equal(database.version, 2);
    assert.deepEqual([...database.objectStoreNames], ["notes", "studyReviews"]);
    assert.deepEqual([...notesStore.indexNames], ["archived", "pinned", "updatedAt"]);
    assert.deepEqual([...reviewsStore.indexNames], ["nextReviewAt", "notebookType", "status"]);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.deepEqual(await listStudyReviewsFromDb(database), []);
  });

  test("upgrading a populated v1 database preserves notes without accessing their store", async () => {
    const v1NoteSnapshot = structuredClone(EXISTING_V1_NOTE);
    const v1Database = await openV1DatabaseWithExistingNote(EXISTING_V1_NOTE);
    openHandles.add(v1Database);
    v1Database.close();
    openHandles.delete(v1Database);

    const { database, noteStoreCalls } = await openDatabaseObservingV1NoteAccess();
    const notesStore = database.transaction("notes", "readonly").objectStore("notes");
    const reviewsStore = database.transaction("studyReviews", "readonly").objectStore("studyReviews");

    assert.equal(database.version, 2);
    assert.deepEqual([...database.objectStoreNames], ["notes", "studyReviews"]);
    assert.deepEqual([...notesStore.indexNames], ["archived", "pinned", "updatedAt"]);
    assert.deepEqual([...reviewsStore.indexNames], ["nextReviewAt", "notebookType", "status"]);
    assert.deepEqual(await listNotesFromDb(database), [v1NoteSnapshot]);
    assert.deepEqual(await listStudyReviewsFromDb(database), []);
    assert.deepEqual(noteStoreCalls, []);
  });

  test("review reads validate defensive copies and leave invalid persisted records unchanged", async () => {
    const database = await openTestDatabase();
    const persistedReview = { ...VALID_REVIEW, ignored: "not exposed" };
    const invalidPersistedReview = {
      ...VALID_REVIEW,
      noteId: "invalid-review-note",
      status: "unexpected",
      ignored: "must stay durable",
    };
    await writeRawReview(database, persistedReview);

    const listedReview = (await listStudyReviewsFromDb(database))[0];
    assert.deepEqual(listedReview, VALID_REVIEW);
    assert.notEqual(listedReview, persistedReview);
    listedReview.status = "review";
    assert.deepEqual(await getStudyReviewFromDb(database, VALID_REVIEW.noteId), VALID_REVIEW);
    assert.equal(await getStudyReviewFromDb(database, "missing-review-note"), undefined);

    await writeRawReview(database, invalidPersistedReview);
    await assert.rejects(() => listStudyReviewsFromDb(database), (error) => {
      assert.equal(error.name, "TypeError");
      assert.equal(error.code, "INVALID_STUDY_REVIEW");
      return true;
    });
    assert.deepEqual(await readRawReview(database, invalidPersistedReview.noteId), invalidPersistedReview);
  });
});
