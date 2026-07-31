import assert from "node:assert/strict";
import test from "node:test";
import { createCommandStack } from "../../core/commandStack.js";
import { createJapaneseActions } from "../../core/japaneseActions.js";
import { createJapaneseAppState, startReviewSession } from "../../core/japaneseState.js";

const NOW = "2026-07-31T12:00:00.000Z";
const LOCAL_DATE = "2026-07-31";
const ISO_WEEK = "2026-W31";

function note(id, title, content = "") {
  return {
    id,
    title,
    content,
    blocks: [],
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    pinned: false,
    archived: false,
    links: [],
    ast: [],
    checksum: "checksum",
    searchBlob: `${title} ${content}`.toLowerCase(),
    version: 1,
  };
}

function review(noteId, notebookType, overrides = {}) {
  return {
    noteId,
    notebookType,
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: NOW,
    interval: 0,
    ease: 2.5,
    ...overrides,
  };
}

function createHarness(initialState) {
  let state = initialState;
  const events = [];
  const commandStack = createCommandStack();
  let nextId = 0;

  const persist = {
    async createPair(createdNote, createdReview) {
      events.push(["persist-create", createdNote.id, createdReview.noteId]);
    },
    async deleteWithReview(noteId) {
      events.push(["persist-delete-pair", noteId]);
      return state.studyReviews.find((item) => item.noteId === noteId);
    },
    async restorePair(restoredNote, restoredReview) {
      events.push(["persist-restore-pair", restoredNote.id, restoredReview.noteId]);
    },
    async putReview(nextReview) {
      events.push(["persist-review", nextReview.noteId, nextReview.status]);
    },
    async putNote(savedNote) {
      events.push(["persist-note", savedNote.id]);
    },
    async deleteNote(noteId) {
      events.push(["persist-delete-note", noteId]);
    },
  };

  const actions = createJapaneseActions({
    getState: () => state,
    setState(next) {
      const patch = typeof next === "function" ? next(state) : next;
      state = { ...state, ...patch };
      events.push(["state"]);
      return state;
    },
    commandStack,
    persist,
    derived: {
      async upsert(changedNote) {
        events.push(["derived-upsert", changedNote.id]);
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
    createNote(seed) {
      nextId += 1;
      return note(`created-${nextId}`, seed.title, seed.content);
    },
  });

  return {
    actions,
    commandStack,
    events,
    getState: () => state,
    persist,
  };
}

function emptyState() {
  return createJapaneseAppState({
    notes: [],
    reviews: [],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
}

test("bootstrap installs loaded reviews without persistence or automatic enrollment", async () => {
  const harness = createHarness({});
  const ordinary = note("ordinary", "Ordinary");

  await harness.actions.bootstrap({
    db: { name: "db" },
    notes: [ordinary],
    reviews: [],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  const state = harness.getState();
  assert.equal(state.workspace, "notes");
  assert.deepEqual(state.notes, [ordinary]);
  assert.deepEqual(state.studyReviews, []);
  assert.deepEqual(state.japaneseNoteIds, []);
  assert.deepEqual(harness.events, [["state"]]);
});

test("Japanese create persists the atomic pair before state, derived indexes, and history", async () => {
  const harness = createHarness(emptyState());

  const created = await harness.actions.createJapaneseNote("vocabulary", {}, {
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  assert.equal(created.id, "created-1");
  assert.deepEqual(harness.getState().notes.map((item) => item.id), ["created-1"]);
  assert.deepEqual(harness.getState().studyReviews.map((item) => item.noteId), ["created-1"]);
  assert.deepEqual(harness.events.map((event) => event[0]), [
    "persist-create",
    "state",
    "derived-upsert",
    "history",
  ]);

  await harness.commandStack.undo();
  assert.deepEqual(harness.getState().notes, []);
  assert.deepEqual(harness.getState().studyReviews, []);
  assert.deepEqual(harness.events.slice(-4).map((event) => event[0]), [
    "persist-delete-pair",
    "state",
    "derived-remove",
    "history",
  ]);

  await harness.commandStack.redo();
  assert.deepEqual(harness.getState().notes.map((item) => item.id), ["created-1"]);
  assert.deepEqual(harness.getState().studyReviews.map((item) => item.noteId), ["created-1"]);
});

test("failed pair creation preserves canonical state and history", async () => {
  const harness = createHarness(emptyState());
  const storageError = new Error("offline");
  harness.persist.createPair = async () => {
    harness.events.push(["persist-create-failed"]);
    throw storageError;
  };

  await assert.rejects(
    harness.actions.createJapaneseNote("kanji", {}, {
      nowIso: NOW,
      localDate: LOCAL_DATE,
      isoWeek: ISO_WEEK,
    }),
    (error) => error === storageError,
  );

  assert.deepEqual(harness.getState().notes, []);
  assert.deepEqual(harness.getState().studyReviews, []);
  assert.deepEqual(harness.events, [["persist-create-failed"]]);
  assert.equal(harness.commandStack.canUndo(), false);
});

test("generic delete routes enrolled records through atomic pair deletion and restores exact values", async () => {
  const enrolledNote = note("enrolled", "Vocabulary", "exact content");
  const enrolledReview = review("enrolled", "vocabulary", { ease: 2.35 });
  const initial = createJapaneseAppState({
    notes: [enrolledNote],
    reviews: [enrolledReview],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  const harness = createHarness(initial);

  await harness.actions.deleteNote("enrolled");
  assert.deepEqual(harness.getState().notes, []);
  assert.deepEqual(harness.getState().studyReviews, []);
  assert.equal(harness.events[0][0], "persist-delete-pair");

  await harness.commandStack.undo();
  assert.deepEqual(harness.getState().notes, [enrolledNote]);
  assert.deepEqual(harness.getState().studyReviews, [enrolledReview]);
  assert.equal(harness.events.at(-4)[0], "persist-restore-pair");

  await harness.commandStack.redo();
  assert.deepEqual(harness.getState().notes, []);
  assert.deepEqual(harness.getState().studyReviews, []);
});

test("ordinary note deletion uses the generic durable route", async () => {
  const ordinary = note("ordinary", "Ordinary");
  const initial = createJapaneseAppState({
    notes: [ordinary],
    reviews: [],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  const harness = createHarness(initial);

  await harness.actions.deleteNote("ordinary");
  assert.equal(harness.events[0][0], "persist-delete-note");
  await harness.commandStack.undo();
  assert.equal(harness.events.at(-4)[0], "persist-note");
});

test("rating persists before replacing review state and advancing the session", async () => {
  const dueNote = note("due", "Vocabulary");
  const dueReview = review("due", "vocabulary");
  let initial = createJapaneseAppState({
    notes: [dueNote],
    reviews: [dueReview],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  initial = startReviewSession(initial, { nowIso: NOW });
  const harness = createHarness(initial);

  const rated = await harness.actions.rateReview("due", "good", NOW);

  assert.equal(rated.status, "review");
  assert.equal(harness.events[0][0], "persist-review");
  assert.equal(harness.events[1][0], "state");
  assert.equal(harness.getState().reviewSession.status, "complete");
  assert.equal(harness.getState().reviewSession.pendingRating, null);
  assert.equal(harness.events.at(-1)[0], "history");
});

test("failed rating preserves the review and current queue position with retry intent", async () => {
  const dueNote = note("due", "Vocabulary");
  const dueReview = review("due", "vocabulary");
  let initial = createJapaneseAppState({
    notes: [dueNote],
    reviews: [dueReview],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  initial = startReviewSession(initial, { nowIso: NOW });
  const harness = createHarness(initial);
  const storageError = new Error("offline");
  harness.persist.putReview = async () => {
    throw storageError;
  };

  await assert.rejects(
    harness.actions.rateReview("due", "easy", NOW),
    (error) => error === storageError,
  );

  assert.deepEqual(harness.getState().studyReviews, [dueReview]);
  assert.equal(harness.getState().reviewSession.currentNoteId, "due");
  assert.deepEqual(harness.getState().reviewSession.pendingRating, {
    noteId: "due",
    rating: "easy",
    nowIso: NOW,
  });
  assert.equal(harness.getState().reviewSession.message, "Save failed; retry rating");
});
