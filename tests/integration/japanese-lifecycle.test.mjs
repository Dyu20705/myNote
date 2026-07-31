import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

await import("fake-indexeddb/auto");

const { createCommandStack } = await import("../../core/commandStack.js");
const { createJapaneseActions } = await import("../../core/japaneseActions.js");
const { startReviewSession } = await import("../../core/japaneseState.js");
const { createStore } = await import("../../core/state.js");
const {
  deleteNoteFromDb,
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
const NOW = "2026-07-31T12:00:00.000Z";
const LOCAL_DATE = "2026-07-31";
const ISO_WEEK = "2026-W31";
let database;

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

beforeEach(async () => {
  await deleteTestDatabase();
  database = await openDatabase();
});

afterEach(async () => {
  database?.close();
  database = undefined;
  await deleteTestDatabase();
});

test("Japanese lifecycle keeps note and review persistence atomic across create, rating, delete, undo, and redo", async () => {
  const ordinary = {
    id: "ordinary",
    title: "Existing ordinary note",
    content: "Must not be enrolled or rewritten.",
    tags: ["existing"],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    pinned: true,
    archived: false,
    version: 7,
  };
  const ordinaryBefore = structuredClone(ordinary);
  await putNoteToDb(database, ordinary);

  const store = createStore({});
  const commandStack = createCommandStack();
  const events = [];
  const actions = createJapaneseActions({
    getState: store.getState,
    setState: store.setState,
    commandStack,
    persist: {
      createPair: (note, review) => putJapaneseNoteWithReviewToDb(database, note, review),
      deleteWithReview: (noteId) => deleteNoteWithReviewFromDb(database, noteId),
      restorePair: (note, review) => restoreNoteWithReviewToDb(database, note, review),
      putReview: (review) => putStudyReviewToDb(database, review),
      putNote: (note) => putNoteToDb(database, note),
      deleteNote: (noteId) => deleteNoteFromDb(database, noteId),
    },
    derived: {
      async upsert(note) {
        events.push(["derived-upsert", note.id]);
      },
      async remove(noteId) {
        events.push(["derived-remove", noteId]);
      },
    },
    history: {
      record(operation) {
        events.push(["history", operation.op, operation.noteId]);
      },
    },
  });

  const loadedNotes = await listNotesFromDb(database);
  const loadedReviews = await listStudyReviewsFromDb(database);
  await actions.bootstrap({
    db: database,
    notes: loadedNotes,
    reviews: loadedReviews,
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  assert.equal(store.getState().workspace, "notes");
  assert.deepEqual(store.getState().studyReviews, []);
  assert.deepEqual((await listNotesFromDb(database))[0], ordinaryBefore);

  const created = await actions.createJapaneseNote("vocabulary", {}, {
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  const createdReview = await getStudyReviewFromDb(database, created.id);
  assert.equal(createdReview.noteId, created.id);
  assert.equal(createdReview.notebookType, "vocabulary");
  assert.equal((await listNotesFromDb(database)).length, 2);

  store.setState((state) => startReviewSession(state, { nowIso: NOW }));
  const rated = await actions.rateReview(created.id, "good", NOW);
  assert.equal(rated.status, "review");
  assert.deepEqual(await getStudyReviewFromDb(database, created.id), rated);
  assert.equal(store.getState().reviewSession.status, "complete");

  const capturedNote = structuredClone(store.getState().notes.find((note) => note.id === created.id));
  const capturedReview = structuredClone(store.getState().studyReviews.find((review) => review.noteId === created.id));
  await actions.deleteNote(created.id);
  assert.equal((await listNotesFromDb(database)).some((note) => note.id === created.id), false);
  assert.equal(await getStudyReviewFromDb(database, created.id), undefined);

  await commandStack.undo();
  assert.deepEqual((await listNotesFromDb(database)).find((note) => note.id === created.id), capturedNote);
  assert.deepEqual(await getStudyReviewFromDb(database, created.id), capturedReview);

  await commandStack.redo();
  assert.equal((await listNotesFromDb(database)).some((note) => note.id === created.id), false);
  assert.equal(await getStudyReviewFromDb(database, created.id), undefined);

  await actions.deleteNote("ordinary");
  assert.equal((await listNotesFromDb(database)).some((note) => note.id === "ordinary"), false);
  await commandStack.undo();
  assert.deepEqual((await listNotesFromDb(database)).find((note) => note.id === "ordinary"), ordinaryBefore);

  assert.ok(events.some((event) => event[0] === "derived-upsert"));
  assert.ok(events.some((event) => event[0] === "derived-remove"));
  assert.ok(events.some((event) => event[0] === "history"));
});
