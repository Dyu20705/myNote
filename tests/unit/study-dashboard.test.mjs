import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDY_DASHBOARD_REPAIR_LIMIT,
  deriveStudyDashboard,
} from "../../core/studyDashboard.js";

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

test("deriveStudyDashboard joins enrolled notes into exact deterministic metrics", () => {
  const notes = [
    note("vocab", "Vocabulary"),
    note("kanji", "Kanji"),
    note("grammar-active", "Grammar active"),
    note("grammar-suspended", "Grammar suspended"),
    note("output-31", "2026-07-31"),
    note("output-30", "2026-07-30"),
    note("output-29", "2026-07-29"),
    note("output-27", "2026-07-27"),
    note("planner", "Japanese study plan — 2026-W31", [
      "## Weekly goals",
      "- [x] Vocabulary",
      "- [X] Kanji",
      "- [ ] Grammar",
      "- [y] malformed",
    ].join("\n")),
    note("archived", "Archived", "", true),
    null,
  ];
  const reviews = [
    review("vocab", "vocabulary", {
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: NOW,
      interval: 0,
    }),
    review("vocab", "vocabulary", {
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: NOW,
      interval: 0,
    }),
    review("kanji", "kanji", { nextReviewAt: "2026-07-31T11:59:59.999Z" }),
    review("grammar-active", "grammar"),
    review("grammar-suspended", "grammar", {
      status: "suspended",
      nextReviewAt: "2026-07-01T00:00:00.000Z",
    }),
    review("output-31", "output", { status: "suspended" }),
    review("output-30", "output"),
    review("output-29", "output"),
    review("output-27", "output"),
    review("planner", "planner", { status: "suspended" }),
    review("archived", "vocabulary", {
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: NOW,
      interval: 0,
    }),
    review("missing", "kanji", { nextReviewAt: NOW }),
    { noteId: "invalid" },
  ];
  const notesBefore = structuredClone(notes);
  const reviewsBefore = structuredClone(reviews);

  const result = deriveStudyDashboard({
    notes,
    reviews,
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  assert.deepEqual(result, {
    dueCount: 2,
    newVocabulary: 1,
    dueKanji: 1,
    grammarTotal: 2,
    outputStreak: 3,
    plannerProgress: { completed: 2, total: 3 },
    needsRepair: [
      { code: "archived-note", noteId: "archived", count: 1 },
      { code: "duplicate-review", noteId: "vocab", count: 1 },
      { code: "invalid-note", count: 1 },
      { code: "invalid-review", count: 1 },
      { code: "orphan-review", noteId: "missing", count: 1 },
    ],
    needsRepairOmitted: 0,
  });
  assert.deepEqual(notes, notesBefore);
  assert.deepEqual(reviews, reviewsBefore);
});

test("equal logical inputs produce deep-equal results independent of array order", () => {
  const notes = [
    note("a", "2026-07-31"),
    note("b", "Japanese study plan — 2026-W31", "- [ ] One\n- [x] Two"),
  ];
  const reviews = [
    review("a", "output"),
    review("b", "planner"),
  ];
  const input = {
    notes,
    reviews,
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  };

  assert.deepEqual(
    deriveStudyDashboard(input),
    deriveStudyDashboard({
      ...input,
      notes: [...notes].reverse(),
      reviews: [...reviews].reverse(),
    }),
  );
  assert.notStrictEqual(deriveStudyDashboard(input), deriveStudyDashboard(input));
});

test("duplicate review conflicts use a stable canonical record and remain visible", () => {
  const notes = [note("vocab", "Vocabulary")];
  const active = review("vocab", "vocabulary", {
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: NOW,
    interval: 0,
  });
  const suspended = review("vocab", "vocabulary", {
    status: "suspended",
    nextReviewAt: "2026-07-01T00:00:00.000Z",
  });

  const forward = deriveStudyDashboard({
    notes,
    reviews: [suspended, active],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });
  const reversed = deriveStudyDashboard({
    notes,
    reviews: [active, suspended],
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  assert.deepEqual(forward, reversed);
  assert.deepEqual(forward.needsRepair, [
    { code: "duplicate-review", noteId: "vocab", count: 1 },
  ]);
});

test("Needs repair is bounded and reports omitted entries", () => {
  const reviews = Array.from({ length: STUDY_DASHBOARD_REPAIR_LIMIT + 5 }, (_, index) =>
    review(`missing-${String(index).padStart(2, "0")}`, "kanji"));

  const result = deriveStudyDashboard({
    notes: [],
    reviews,
    nowIso: NOW,
    localDate: LOCAL_DATE,
    isoWeek: ISO_WEEK,
  });

  assert.equal(result.needsRepair.length, STUDY_DASHBOARD_REPAIR_LIMIT);
  assert.equal(result.needsRepairOmitted, 5);
  assert.deepEqual(result.needsRepair[0], {
    code: "orphan-review",
    noteId: "missing-00",
    count: 1,
  });
});

test("malformed top-level context rejects with a bounded content-free error", () => {
  for (const input of [
    null,
    {},
    { notes: [], reviews: [], nowIso: "invalid", localDate: LOCAL_DATE, isoWeek: ISO_WEEK },
    { notes: [], reviews: [], nowIso: NOW, localDate: "2026-02-30", isoWeek: ISO_WEEK },
    { notes: [], reviews: [], nowIso: NOW, localDate: LOCAL_DATE, isoWeek: "2026-W99" },
    { notes: [], reviews: [], nowIso: NOW, localDate: LOCAL_DATE, isoWeek: ISO_WEEK, extra: true },
  ]) {
    assert.throws(
      () => deriveStudyDashboard(input),
      (error) => error instanceof TypeError
        && error.message === "Invalid study dashboard input"
        && error.code === "INVALID_STUDY_DASHBOARD_INPUT"
        && !JSON.stringify(error).includes("2026"),
    );
  }
});
