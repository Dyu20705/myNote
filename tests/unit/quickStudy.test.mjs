import { describe, it } from "node:test";
import assert from "node:assert";
import { startReviewSession, getInitialState } from "../../core/japaneseState.js";

describe("Quick Study", () => {
  it("limits queue to 5 when limit is 5", () => {
    let state = getInitialState();
    // mock some due notes
    const notes = [];
    const studyReviews = [];
    for (let i=0; i<10; i++) {
      notes.push({ id: `note-${i}`, type: "kanji", content: "data", active: true });
      studyReviews.push({ noteId: `note-${i}`, notebookType: "kanji", dueIso: "2023-01-01T00:00:00Z" });
    }
    state = { ...state, notes, studyReviews };
    const sessionState = startReviewSession(state, { nowIso: "2023-10-01T00:00:00Z", limit: 5 });
    assert.strictEqual(sessionState.reviewSession.queue.length, 5);
  });
});
