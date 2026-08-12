import test from "node:test";
import assert from "node:assert/strict";
import { STUDY_NOTEBOOK_TYPES } from "../../core/studyReview.js";
import {
  JAPANESE_FILTER_ERRORS,
  JapaneseNoteFilter,
  filterJapaneseNoteIds,
  resolveJapaneseCommonFilter,
} from "../../core/japaneseFilters.js";

function localIso(year, month, day) {
  return new Date(year, month - 1, day, 12).toISOString();
}

function review(noteId, notebookType) {
  return {
    noteId,
    notebookType,
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: "2026-07-31T00:00:00.000Z",
    interval: 0,
    ease: 2.5,
  };
}

const notes = [
  { id: "vocab", createdAt: localIso(2026, 7, 29) },
  { id: "kanji", createdAt: localIso(2026, 7, 30) },
  { id: "grammar", createdAt: localIso(2026, 7, 31) },
  { id: "ordinary", createdAt: localIso(2026, 7, 31) },
  { id: "broken", createdAt: "not-a-date" },
];

const reviews = [
  review("vocab", "vocabulary"),
  review("kanji", "kanji"),
  review("grammar", "grammar"),
  review("ghost", "grammar"),
];

const enrolledIds = ["vocab", "kanji", "grammar", "broken", "missing"];

test("resolves every canonical M2 Japanese common filter value", () => {
  const enabled = ["all", ...STUDY_NOTEBOOK_TYPES];

  assert.deepEqual(enabled.map((value) => resolveJapaneseCommonFilter(value)), [
    "all",
    "vocabulary",
    "kanji",
    "grammar",
    "output",
    "planner",
  ]);
});

test("rejects unsupported Japanese common filter values", () => {
  for (const value of [undefined, null, "", "reading", "unknown", {}, []]) {
    assert.equal(resolveJapaneseCommonFilter(value), null);
  }
});

test("returns search order unchanged when no boundary or filters are supplied", () => {
  const ids = ["grammar", "ordinary", "vocab"];
  assert.deepEqual(filterJapaneseNoteIds({ ids, notes, reviews, filters: {} }), ids);
});

test("enrollment boundary excludes ordinary and missing notes even with empty filters", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["ordinary", "grammar", "missing", "vocab"],
    notes,
    reviews,
    enrolledIds,
    filters: {},
  }), ["grammar", "vocab"]);
});

test("filters by inclusive local created-date range and notebook type", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar", "kanji", "vocab", "broken"],
    notes,
    reviews,
    enrolledIds,
    filters: { fromDate: "2026-07-30", toDate: "2026-07-31", notebookType: "grammar" },
  }), ["grammar"]);
});

test("invalid and inverted dates cannot create inferred matches", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar", "kanji"],
    notes,
    reviews,
    enrolledIds,
    filters: { fromDate: "2026-02-30", toDate: "2026-07-31" },
  }), ["grammar", "kanji"]);
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar", "kanji"],
    notes,
    reviews,
    enrolledIds,
    filters: { fromDate: "2026-08-01", toDate: "2026-07-31" },
  }), []);
});

test("conflicting duplicate review metadata is excluded from type matches", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar"],
    notes,
    reviews: [...reviews, review("grammar", "kanji")],
    enrolledIds,
    filters: { notebookType: "grammar" },
  }), []);
});

test("JapaneseNoteFilter composes workspace enrollment and mutable filter state", () => {
  let state = {
    workspace: "notes",
    notes,
    studyReviews: reviews,
    japaneseNoteIds: enrolledIds,
  };
  const filter = new JapaneseNoteFilter({ getState: () => state });
  assert.deepEqual(filter.apply(["ordinary", "grammar"]), ["ordinary", "grammar"]);

  state = { ...state, workspace: "japanese" };
  assert.deepEqual(filter.apply(["ordinary", "grammar", "vocab"]), ["grammar", "vocab"]);
  filter.update({ notebookType: "grammar" });
  assert.equal(filter.isActive(), true);
  assert.deepEqual(filter.apply(["vocab", "grammar"]), ["grammar"]);

  filter.update({ fromDate: "2026-08-01", toDate: "2026-07-31" });
  assert.equal(filter.getValidationError(), JAPANESE_FILTER_ERRORS.INVALID_DATE_RANGE);
  assert.deepEqual(filter.apply(["grammar"]), []);
  assert.deepEqual(filter.reset(), { fromDate: "", toDate: "", notebookType: "all" });
});
