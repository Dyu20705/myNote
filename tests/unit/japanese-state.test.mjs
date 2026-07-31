import assert from "node:assert/strict";
import test from "node:test";
import {
  JAPANESE_STATUS_LIMIT,
  advanceReviewSession,
  buildDueReviewQueue,
  createJapaneseAppState,
  revealCurrentReview,
  selectWorkspace,
  startReviewSession,
} from "../../core/japaneseState.js";

const NOW = "2026-07-31T12:00:00.000Z";
const LOCAL_DATE = "2026-07-31";
const ISO_WEEK = "2026-W31";

function note(id, title, content = "", archived = false) {
  return { id, title, content, archived };
}

function review(noteId, notebookType, overrides = {}) {
  return {
    noteId,
    notebookType,
    status: "review",
    lastReviewedAt: "2026-07-30T12:00:00.000Z",
    nextReviewAt: "2026-08-01T12:00:00.000Z",
    interval: 1,
    ease: 2.5,
    ...overrides,
  };
}

test("createJapaneseAppState loads reviews without enrolling or mutating ordinary notes", () => {
  const notes = [
    note("ordinary", "Ordinary note"),
    note("due", "Vocabulary"),
    note("archived", "Kanji", "", true),
  ];
  const reviews = [
    review("due", "vocabulary", { nextReviewAt: NOW }),
    review("archived", "kanji", { nextReviewAt: NOW }),
  ];
  const notesBefore = structuredClone(notes);
  const reviewsBefore = structuredClone(reviews);

  const state = createJapaneseAppState({
    notes,
    reviews,
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  assert.equal(state.workspace, "notes");
  assert.deepEqual(state.studyReviews.map((item) => item.noteId), ["archived", "due"]);
  assert.deepEqual(state.japaneseNoteIds, ["due"]);
  assert.deepEqual(state.reviewSession, {
    status: "idle",
    queue: [],
    index: 0,
    currentNoteId: null,
    revealed: false,
    message: null,
    pendingRating: null,
  });
  assert.equal(state.studyDashboard.dueCount, 1);
  assert.deepEqual(notes, notesBefore);
  assert.deepEqual(reviews, reviewsBefore);
  assert.equal(notes[0].id, "ordinary");
});

test("buildDueReviewQueue is deterministic and exposes bounded repair status", () => {
  const notes = [
    note("due-b", "B"),
    note("due-a", "A"),
    note("archived", "Archived", "", true),
  ];
  const reviews = [
    review("due-b", "kanji", { nextReviewAt: "2026-07-31T11:00:00.000Z" }),
    review("due-a", "vocabulary", { nextReviewAt: "2026-07-31T10:00:00.000Z" }),
    review("archived", "grammar", { nextReviewAt: NOW }),
    review("missing", "output", { nextReviewAt: NOW }),
    review("due-a", "vocabulary", { nextReviewAt: "2026-07-31T10:00:00.000Z" }),
    { noteId: "invalid" },
  ];

  const forward = buildDueReviewQueue({ notes, reviews, nowIso: NOW });
  const reversed = buildDueReviewQueue({
    notes: [...notes].reverse(),
    reviews: [...reviews].reverse(),
    nowIso: NOW,
  });

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.queue, [
    { noteId: "due-a", notebookType: "vocabulary" },
    { noteId: "due-b", notebookType: "kanji" },
  ]);
  assert.deepEqual(forward.status, [
    { code: "archived-note", noteId: "archived", count: 1 },
    { code: "duplicate-review", noteId: "due-a", count: 1 },
    { code: "invalid-review", count: 1 },
    { code: "orphan-review", noteId: "missing", count: 1 },
  ]);
  assert.equal(forward.statusOmitted, 0);
});

test("repair status is bounded with an explicit omitted count", () => {
  const reviews = Array.from({ length: JAPANESE_STATUS_LIMIT + 3 }, (_, index) =>
    review(`missing-${String(index).padStart(2, "0")}`, "kanji", { nextReviewAt: NOW }));

  const result = buildDueReviewQueue({ notes: [], reviews, nowIso: NOW });

  assert.equal(result.status.length, JAPANESE_STATUS_LIMIT);
  assert.equal(result.statusOmitted, 3);
});

test("workspace and review-session transitions are immutable and deterministic", () => {
  const base = createJapaneseAppState({
    notes: [note("a", "A"), note("b", "B")],
    reviews: [
      review("b", "kanji", { nextReviewAt: NOW }),
      review("a", "vocabulary", { nextReviewAt: NOW }),
    ],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  const before = structuredClone(base);

  const japanese = selectWorkspace(base, "japanese");
  const started = startReviewSession(japanese, { nowIso: NOW });
  const revealed = revealCurrentReview(started);
  const advanced = advanceReviewSession(revealed, "Saved");
  const completed = advanceReviewSession(advanced, null);

  assert.equal(japanese.workspace, "japanese");
  assert.equal(started.reviewSession.status, "active");
  assert.equal(started.reviewSession.currentNoteId, "a");
  assert.equal(revealed.reviewSession.revealed, true);
  assert.equal(advanced.reviewSession.currentNoteId, "b");
  assert.equal(advanced.reviewSession.message, "Saved");
  assert.equal(completed.reviewSession.status, "complete");
  assert.equal(completed.reviewSession.currentNoteId, null);
  assert.deepEqual(base, before);

  assert.throws(() => selectWorkspace(base, "unknown"), {
    name: "TypeError",
    message: "Invalid Japanese state input",
  });
});
