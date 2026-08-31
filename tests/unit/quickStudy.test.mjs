import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDueReviewQueue,
  createJapaneseAppState,
  startReviewSession,
} from "../../core/japaneseState.js";

const NOW = "2026-07-31T12:00:00.000Z";
const LOCAL_DATE = "2026-07-31";
const ISO_WEEK = "2026-W31";

function note(id, title = `Note ${id}`, content = "", archived = false) {
  return { id, title, content, archived };
}

function review(noteId, notebookType = "vocabulary", overrides = {}) {
  return {
    noteId,
    notebookType,
    status: "review",
    lastReviewedAt: "2026-07-30T12:00:00.000Z",
    nextReviewAt: "2026-07-31T10:00:00.000Z",
    interval: 1,
    ease: 2.5,
    ...overrides,
  };
}

describe("Quick Study Domain Unit Tests", () => {
  it("preserves regular review behavior when no limit is provided", () => {
    const notes = Array.from({ length: 20 }, (_, i) => note(`note-${String(i).padStart(2, "0")}`));
    const reviews = notes.map((n) => review(n.id, "vocabulary", { nextReviewAt: "2026-07-31T09:00:00.000Z" }));

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW });
    assert.equal(sessionState.reviewSession.status, "active");
    assert.equal(sessionState.reviewSession.queue.length, 20);
    assert.equal(sessionState.reviewSession.currentNoteId, "note-00");
  });

  it("limits queue to 5 when limit is 5", () => {
    const notes = Array.from({ length: 12 }, (_, i) => note(`note-${String(i).padStart(2, "0")}`));
    const reviews = notes.map((n) => review(n.id, "vocabulary", { nextReviewAt: "2026-07-31T09:00:00.000Z" }));

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW, limit: 5 });
    assert.equal(sessionState.reviewSession.status, "active");
    assert.equal(sessionState.reviewSession.queue.length, 5);
    assert.deepEqual(
      sessionState.reviewSession.queue.map((item) => item.noteId),
      ["note-00", "note-01", "note-02", "note-03", "note-04"],
    );
  });

  it("limits queue to 10 when limit is 10", () => {
    const notes = Array.from({ length: 15 }, (_, i) => note(`note-${String(i).padStart(2, "0")}`));
    const reviews = notes.map((n) => review(n.id, "vocabulary", { nextReviewAt: "2026-07-31T09:00:00.000Z" }));

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW, limit: 10 });
    assert.equal(sessionState.reviewSession.queue.length, 10);
  });

  it("limits queue to 15 when limit is 15", () => {
    const notes = Array.from({ length: 25 }, (_, i) => note(`note-${String(i).padStart(2, "0")}`));
    const reviews = notes.map((n) => review(n.id, "vocabulary", { nextReviewAt: "2026-07-31T09:00:00.000Z" }));

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW, limit: 15 });
    assert.equal(sessionState.reviewSession.queue.length, 15);
  });

  it("returns full due queue when limit exceeds due cards length", () => {
    const notes = Array.from({ length: 3 }, (_, i) => note(`note-${i}`));
    const reviews = notes.map((n) => review(n.id, "vocabulary", { nextReviewAt: "2026-07-31T09:00:00.000Z" }));

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW, limit: 10 });
    assert.equal(sessionState.reviewSession.queue.length, 3);
  });

  it("returns complete session when limit is 0", () => {
    const notes = [note("note-1"), note("note-2")];
    const reviews = [review("note-1"), review("note-2")];

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW, limit: 0 });
    assert.equal(sessionState.reviewSession.status, "complete");
    assert.equal(sessionState.reviewSession.queue.length, 0);
    assert.equal(sessionState.reviewSession.currentNoteId, null);
  });

  it("preserves canonical sorting (earliest due, then noteId asc) before limiting", () => {
    const notes = [
      note("c", "Note C"),
      note("a", "Note A"),
      note("b", "Note B"),
      note("d", "Note D"),
    ];
    const reviews = [
      review("c", "vocabulary", { nextReviewAt: "2026-07-31T08:00:00.000Z" }),
      review("a", "vocabulary", { nextReviewAt: "2026-07-31T07:00:00.000Z" }),
      review("b", "vocabulary", { nextReviewAt: "2026-07-31T08:00:00.000Z" }),
      review("d", "vocabulary", { nextReviewAt: "2026-07-31T09:00:00.000Z" }),
    ];

    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const sessionState = startReviewSession(state, { nowIso: NOW, limit: 2 });
    assert.deepEqual(
      sessionState.reviewSession.queue.map((item) => item.noteId),
      ["a", "b"],
    );
  });

  it("rejects invalid limit values deterministically in buildDueReviewQueue and startReviewSession", () => {
    const notes = [note("a")];
    const reviews = [review("a")];
    const state = {
      ...createJapaneseAppState({
        notes,
        reviews,
        nowIso: NOW,
        localDate: LOCAL_DATE,
        isoWeek: ISO_WEEK,
      }),
      notes,
    };

    const invalidLimits = [-1, 1.5, NaN, Number.POSITIVE_INFINITY, "5", null, {}, []];

    for (const invalid of invalidLimits) {
      assert.throws(
        () => buildDueReviewQueue({ notes, reviews, nowIso: NOW, limit: invalid }),
        /Invalid Japanese state input/,
      );
      assert.throws(
        () => startReviewSession(state, { nowIso: NOW, limit: invalid }),
        /Invalid Japanese state input/,
      );
    }
  });
});
