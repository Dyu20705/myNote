import assert from "node:assert/strict";
import test from "node:test";
import { createJapaneseAppState } from "../../core/japaneseState.js";

const NOW = "2026-07-31T12:00:00.000Z";

function review(noteId) {
  return {
    noteId,
    notebookType: "vocabulary",
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: NOW,
    interval: 0,
    ease: 2.5,
  };
}

test("application-state diagnostics count each invalid or duplicate input once", () => {
  const state = createJapaneseAppState({
    notes: [{ id: "due", title: "Vocabulary", content: "", archived: false }],
    reviews: [review("due"), review("due"), { noteId: "invalid" }],
    nowIso: NOW,
    localDate: "2026-07-31",
    isoWeek: "2026-W31",
  });

  assert.deepEqual(state.studyStatus, [
    { code: "duplicate-review", noteId: "due", count: 1 },
    { code: "invalid-review", count: 1 },
  ]);
});
