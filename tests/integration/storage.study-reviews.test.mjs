import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const {
  deleteNoteWithReviewFromDb,
  getStudyReviewFromDb,
  listNotesFromDb,
  listStudyReviewsFromDb,
  openDatabase,
  putJapaneseNoteWithReviewToDb,
  putNoteToDb,
  putStudyReviewToDb,
  restoreNoteWithReviewToDb,
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

function readRawNotes(database) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("notes", "readonly");
    const request = transaction.objectStore("notes").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readRawReviews(database) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("studyReviews", "readonly");
    const request = transaction.objectStore("studyReviews").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function makePairedNote(id = VALID_REVIEW.noteId) {
  return {
    id,
    title: "Paired study note",
    content: "A stored note paired with its review schedule.",
    updatedAt: "2026-07-30T00:00:00.000Z",
    metadata: { source: "integration-test" },
  };
}

function makeReview(noteId = VALID_REVIEW.noteId, overrides = {}) {
  return { ...VALID_REVIEW, noteId, ...overrides };
}

async function openDatabaseObservingV1NoteAccess() {
  const originalObjectStore = globalThis.IDBTransaction.prototype.objectStore;
  const noteStoreCalls = [];

  globalThis.IDBTransaction.prototype.objectStore = function (name) {
    if (name === "notes") noteStoreCalls.push(name);
    return Reflect.apply(originalObjectStore, this, [name]);
  };

  try {
    const database = await openDatabase();
    openHandles.add(database);
    return { database, noteStoreCalls };
  } finally {
    globalThis.IDBTransaction.prototype.objectStore = originalObjectStore;
  }
}

function assertContentFree(error, forbiddenValues) {
  for (const value of forbiddenValues) {
    assert.equal(error.message.includes(value), false);
  }
  return true;
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

  test("fresh databases preserve the isolated review schema within v3", async () => {
    const database = await openTestDatabase();
    const notesStore = database.transaction("notes", "readonly").objectStore("notes");
    const reviewsStore = database.transaction("studyReviews", "readonly").objectStore("studyReviews");

    assert.equal(database.version, 6);
    assert.deepEqual([...database.objectStoreNames].sort(), ["cards", "kanjiInkEntries", "learningItems", "notes", "reviewLogs", "reviewStates", "studyArtifacts", "studyReviews"]);
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

    assert.equal(database.version, 6);
    assert.deepEqual([...database.objectStoreNames].sort(), ["cards", "kanjiInkEntries", "learningItems", "notes", "reviewLogs", "reviewStates", "studyArtifacts", "studyReviews"]);
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

  test("creates a note and validated defensive review pair without caller aliases", async () => {
    const database = await openTestDatabase();
    const note = makePairedNote();
    const review = { ...makeReview(), ignored: "not persisted" };
    const expectedNote = structuredClone(note);

    await putJapaneseNoteWithReviewToDb(database, note, review);
    note.metadata.source = "mutated caller value";
    review.status = "review";

    assert.deepEqual(await listNotesFromDb(database), [expectedNote]);
    assert.deepEqual(await readRawReview(database, expectedNote.id), makeReview());

    const listed = (await listStudyReviewsFromDb(database))[0];
    listed.status = "suspended";
    const fetched = await getStudyReviewFromDb(database, expectedNote.id);
    fetched.status = "learning";
    assert.deepEqual(await getStudyReviewFromDb(database, expectedNote.id), makeReview());
  });

  test("updates an existing review but rejects a missing review without creating an orphan", async () => {
    const database = await openTestDatabase();
    const existingReview = makeReview("existing-review");
    await writeRawReview(database, existingReview);

    const updatedReview = makeReview(existingReview.noteId, { status: "learning", interval: 1 });
    await putStudyReviewToDb(database, updatedReview);
    assert.deepEqual(await getStudyReviewFromDb(database, existingReview.noteId), updatedReview);

    const missingReview = makeReview("missing-review");
    await assert.rejects(() => putStudyReviewToDb(database, missingReview), (error) => {
      assert.equal(error.code, "STUDY_REVIEW_NOT_FOUND");
      assert.equal(error.message, "Study review not found");
      assertContentFree(error, [missingReview.noteId, missingReview.nextReviewAt]);
      return true;
    });
    assert.equal(await getStudyReviewFromDb(database, missingReview.noteId), undefined);
  });

  test("rejects invalid pair inputs before opening a transaction", async () => {
    let transactionCalls = 0;
    const database = {
      transaction() {
        transactionCalls += 1;
        throw new Error("transactions must not open for invalid input");
      },
    };
    const invalidReviews = [
      null,
      { ...makeReview(), status: undefined },
      makeReview(""),
      makeReview(VALID_REVIEW.noteId, { notebookType: "other" }),
      makeReview(VALID_REVIEW.noteId, { status: "other" }),
      makeReview(VALID_REVIEW.noteId, { lastReviewedAt: "not-a-date" }),
      makeReview(VALID_REVIEW.noteId, { nextReviewAt: "not-a-date" }),
      makeReview(VALID_REVIEW.noteId, { interval: -1 }),
      makeReview(VALID_REVIEW.noteId, { interval: 0.5 }),
      makeReview(VALID_REVIEW.noteId, { ease: 3.1 }),
    ];

    const invalidNoteId = "private-invalid-note-id";
    const mismatchedReviewId = "private-mismatched-review-id";
    const getterFailure = new Error("private getter payload");
    const prototypeFailure = new Error("private proxy payload");
    const throwingIdNote = makePairedNote();
    Object.defineProperty(throwingIdNote, "id", {
      enumerable: true,
      get() {
        throw getterFailure;
      },
    });
    const hostileProxyNote = new Proxy(makePairedNote(), {
      getPrototypeOf() {
        throw prototypeFailure;
      },
    });

    async function assertInvalidNote(note, review = makeReview()) {
      await assert.rejects(() => putJapaneseNoteWithReviewToDb(database, note, review), (error) => {
        assert.equal(error.name, "TypeError");
        assert.equal(error.code, "INVALID_NOTE");
        assert.equal(error.message, "Invalid note");
        assert.notEqual(error, getterFailure);
        assert.notEqual(error, prototypeFailure);
        assertContentFree(error, [
          invalidNoteId,
          mismatchedReviewId,
          getterFailure.message,
          prototypeFailure.message,
        ]);
        return true;
      });
    }

    for (const invalidNote of [
      makePairedNote(""),
      { ...makePairedNote(), id: 42 },
      throwingIdNote,
      hostileProxyNote,
    ]) {
      const review = makeReview();
      await assertInvalidNote(invalidNote, review);
    }
    await assertInvalidNote(makePairedNote(invalidNoteId), makeReview(mismatchedReviewId));
    for (const invalidReview of invalidReviews) {
      await assert.rejects(() => putJapaneseNoteWithReviewToDb(database, makePairedNote(), invalidReview));
      await assert.rejects(() => putStudyReviewToDb(database, invalidReview));
    }
    assert.equal(transactionCalls, 0);
  });

  test("rolls back pair creation when either note or review key collides", async () => {
    const database = await openTestDatabase();
    const existingNote = makePairedNote("note-collision");
    const existingReview = makeReview("review-collision");
    await putNoteToDb(database, existingNote);
    await writeRawReview(database, existingReview);
    const beforeNotes = await readRawNotes(database);
    const beforeReviews = await readRawReviews(database);

    await assert.rejects(() => putJapaneseNoteWithReviewToDb(
      database,
      makePairedNote(existingNote.id),
      makeReview(existingNote.id),
    ));
    assert.deepEqual(await readRawNotes(database), beforeNotes);
    assert.deepEqual(await readRawReviews(database), beforeReviews);

    await assert.rejects(() => putJapaneseNoteWithReviewToDb(
      database,
      makePairedNote(existingReview.noteId),
      makeReview(existingReview.noteId),
    ));
    assert.deepEqual(await readRawNotes(database), beforeNotes);
    assert.deepEqual(await readRawReviews(database), beforeReviews);
  });

  test("preserves the first asynchronous request error identity until terminal abort", async () => {
    const database = await openTestDatabase();
    const collisionId = "private-collision-note";
    const collisionContent = "private collision content";
    const existingNote = { ...makePairedNote(collisionId), content: collisionContent };
    await putNoteToDb(database, existingNote);
    const originalAdd = globalThis.IDBObjectStore.prototype.add;
    const transactionEvents = [];
    let requestError;

    globalThis.IDBObjectStore.prototype.add = function (...args) {
      const request = Reflect.apply(originalAdd, this, args);
      if (this.name === "notes") {
        request.addEventListener("error", () => {
          requestError ||= request.error;
        });
        this.transaction.addEventListener("error", () => transactionEvents.push("error"));
        this.transaction.addEventListener("complete", () => transactionEvents.push("complete"));
        this.transaction.addEventListener("abort", () => transactionEvents.push("abort"));
      }
      return request;
    };

    try {
      await assert.rejects(
        () => putJapaneseNoteWithReviewToDb(database, existingNote, makeReview(collisionId)),
        (error) => {
          assert.equal(error, requestError);
          assert.equal(error.name, "ConstraintError");
          assert.equal(transactionEvents.at(-1), "abort");
          assert.equal(transactionEvents.includes("complete"), false);
          assertContentFree(error, [collisionId, collisionContent]);
          return true;
        },
      );
    } finally {
      globalThis.IDBObjectStore.prototype.add = originalAdd;
    }
  });

  test("deletes an enrolled note with its captured review and deletes generic notes alone", async () => {
    const database = await openTestDatabase();
    const pairedNote = makePairedNote("enrolled-note");
    const pairedReview = makeReview(pairedNote.id);
    const genericNote = makePairedNote("generic-note");
    await putJapaneseNoteWithReviewToDb(database, pairedNote, pairedReview);
    await putNoteToDb(database, genericNote);

    assert.deepEqual(await deleteNoteWithReviewFromDb(database, pairedNote.id), pairedReview);
    assert.deepEqual(await readRawReview(database, pairedNote.id), undefined);
    assert.deepEqual(await listNotesFromDb(database), [genericNote]);

    assert.equal(await deleteNoteWithReviewFromDb(database, genericNote.id), undefined);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.deepEqual(await listStudyReviewsFromDb(database), []);
  });

  test("preserves an orphan review when its note is absent", async () => {
    const database = await openTestDatabase();
    const orphanReview = makeReview("orphan-review");
    await writeRawReview(database, orphanReview);

    assert.equal(await deleteNoteWithReviewFromDb(database, orphanReview.noteId), undefined);
    assert.deepEqual(await readRawNotes(database), []);
    assert.deepEqual(await readRawReviews(database), [orphanReview]);
  });

  test("restores the exact validated note and review pair", async () => {
    const database = await openTestDatabase();
    const note = makePairedNote("restored-note");
    const review = makeReview(note.id, { status: "learning", interval: 3 });

    await restoreNoteWithReviewToDb(database, note, review);
    assert.deepEqual(await readRawNotes(database), [note]);
    assert.deepEqual(await readRawReviews(database), [review]);
  });

  test("restore collisions abort without overwriting either existing record", async () => {
    const database = await openTestDatabase();
    const noteId = "restore-collision";
    const existingNote = makePairedNote(noteId);
    const existingReview = makeReview(noteId);
    await putJapaneseNoteWithReviewToDb(database, existingNote, existingReview);
    const beforeNotes = structuredClone(await readRawNotes(database));
    const beforeReviews = structuredClone(await readRawReviews(database));

    await assert.rejects(() => restoreNoteWithReviewToDb(
      database,
      { ...existingNote, title: "replacement title" },
      { ...existingReview, status: "review", interval: 2 },
    ), { name: "ConstraintError" });

    assert.deepEqual(await readRawNotes(database), beforeNotes);
    assert.deepEqual(await readRawReviews(database), beforeReviews);
  });

  test("aborts each paired mutation when its second store request throws synchronously", async () => {
    let database = await openTestDatabase();
    const originalAdd = globalThis.IDBObjectStore.prototype.add;
    const originalPut = globalThis.IDBObjectStore.prototype.put;
    const originalDelete = globalThis.IDBObjectStore.prototype.delete;

    async function assertRollback(operation, secondStoreName, patchMethod) {
      const beforeNotes = await readRawNotes(database);
      const beforeReviews = await readRawReviews(database);
      const injectedError = new Error(`injected ${patchMethod} failure`);
      const original = globalThis.IDBObjectStore.prototype[patchMethod];
      globalThis.IDBObjectStore.prototype[patchMethod] = function (...args) {
        if (this.name === secondStoreName) {
          throw injectedError;
        }
        return Reflect.apply(original, this, args);
      };

      try {
        await assert.rejects(operation, (error) => error === injectedError);
      } finally {
        globalThis.IDBObjectStore.prototype[patchMethod] = original;
      }
      database.close();
      openHandles.delete(database);
      database = await openTestDatabase();
      assert.deepEqual(await readRawNotes(database), beforeNotes);
      assert.deepEqual(await readRawReviews(database), beforeReviews);
    }

    try {
      await assertRollback(
        () => putJapaneseNoteWithReviewToDb(database, makePairedNote("create-failure"), makeReview("create-failure")),
        "studyReviews",
        "add",
      );
      const deleteFailureNote = makePairedNote("delete-failure");
      const deleteFailureReview = makeReview(deleteFailureNote.id);
      await putJapaneseNoteWithReviewToDb(database, deleteFailureNote, deleteFailureReview);
      assert.deepEqual(await readRawNotes(database), [deleteFailureNote]);
      assert.deepEqual(await readRawReview(database, deleteFailureNote.id), deleteFailureReview);
      await assertRollback(
        () => deleteNoteWithReviewFromDb(database, deleteFailureNote.id),
        "studyReviews",
        "delete",
      );
      assert.deepEqual(await readRawNotes(database), [deleteFailureNote]);
      assert.deepEqual(await readRawReview(database, deleteFailureNote.id), deleteFailureReview);
      await assertRollback(
        () => restoreNoteWithReviewToDb(database, makePairedNote("restore-failure"), makeReview("restore-failure")),
        "studyReviews",
        "add",
      );
    } finally {
      globalThis.IDBObjectStore.prototype.add = originalAdd;
      globalThis.IDBObjectStore.prototype.put = originalPut;
      globalThis.IDBObjectStore.prototype.delete = originalDelete;
    }
  });

  test("rejects after a scheduled transaction abort and commits no partial pair", async () => {
    const database = await openTestDatabase();
    const beforeNotes = await readRawNotes(database);
    const beforeReviews = await readRawReviews(database);
    const originalAdd = globalThis.IDBObjectStore.prototype.add;
    let terminalAbortObserved = false;

    globalThis.IDBObjectStore.prototype.add = function (...args) {
      const request = Reflect.apply(originalAdd, this, args);
      if (this.name === "studyReviews") {
        this.transaction.addEventListener("abort", () => {
          terminalAbortObserved = true;
        }, { once: true });
        queueMicrotask(() => this.transaction.abort());
      }
      return request;
    };

    try {
      await assert.rejects(
        () => putJapaneseNoteWithReviewToDb(database, makePairedNote("scheduled-abort"), makeReview("scheduled-abort")),
        (error) => {
          assert.equal(terminalAbortObserved, true);
          assert.equal(error.name, "AbortError");
          assert.equal(error.message, "IndexedDB transaction aborted.");
          assertContentFree(error, ["scheduled-abort", "Paired study note"]);
          return true;
        },
      );
    } finally {
      globalThis.IDBObjectStore.prototype.add = originalAdd;
    }
    assert.deepEqual(await readRawNotes(database), beforeNotes);
    assert.deepEqual(await readRawReviews(database), beforeReviews);
  });
});
