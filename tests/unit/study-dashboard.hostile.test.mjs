import assert from "node:assert/strict";
import test from "node:test";
import { deriveStudyDashboard } from "../../core/studyDashboard.js";

const NOW = "2026-07-31T12:00:00.000Z";

test("hostile nested note records are isolated as bounded invalid-note repairs", () => {
  const hostileNote = new Proxy({}, {
    getPrototypeOf() {
      throw new Error("private-note-content");
    },
  });
  const validNote = {
    id: "vocab",
    title: "Vocabulary",
    content: "",
    archived: false,
  };
  const validReview = {
    noteId: "vocab",
    notebookType: "vocabulary",
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: NOW,
    interval: 0,
    ease: 2.5,
  };

  const result = deriveStudyDashboard({
    notes: [hostileNote, validNote],
    reviews: [validReview],
    nowIso: NOW,
    localDate: "2026-07-31",
    isoWeek: "2026-W31",
  });

  assert.equal(result.dueCount, 1);
  assert.equal(result.newVocabulary, 1);
  assert.deepEqual(result.needsRepair, [
    { code: "invalid-note", count: 1 },
  ]);
  assert.ok(!JSON.stringify(result).includes("private-note-content"));
});
