import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDY_NOTEBOOK_TYPES,
  STUDY_REVIEW_STATUSES,
  validateStudyReview,
} from "../../core/studyReview.js";

const VALID_REVIEW = Object.freeze({
  noteId: "note-study-1",
  notebookType: "vocabulary",
  status: "new",
  lastReviewedAt: null,
  nextReviewAt: "2026-07-30T00:00:00.000Z",
  interval: 0,
  ease: 2.5,
});

test("study review enums expose the persistence contract", () => {
  assert.deepEqual(STUDY_NOTEBOOK_TYPES, ["vocabulary", "kanji", "grammar", "output", "planner"]);
  assert.deepEqual(STUDY_REVIEW_STATUSES, ["new", "learning", "review", "suspended"]);
  assert.equal(Object.isFrozen(STUDY_NOTEBOOK_TYPES), true);
  assert.equal(Object.isFrozen(STUDY_REVIEW_STATUSES), true);
});

test("validateStudyReview returns an exact defensive copy of a valid record", () => {
  const input = { ...VALID_REVIEW, ignored: "not persisted" };
  const result = validateStudyReview(input);

  assert.deepEqual(result, VALID_REVIEW);
  assert.notEqual(result, input);
  assert.deepEqual(Object.keys(result), [
    "noteId",
    "notebookType",
    "status",
    "lastReviewedAt",
    "nextReviewAt",
    "interval",
    "ease",
  ]);
});

test("validateStudyReview accepts ISO timestamps with Z or numeric timezone offsets unchanged", () => {
  const zReview = validateStudyReview(VALID_REVIEW);
  const offsetReview = validateStudyReview({
    ...VALID_REVIEW,
    lastReviewedAt: "2026-07-29T17:00:00+07:00",
    nextReviewAt: "2026-07-30T07:00:00+07:00",
  });

  assert.equal(zReview.nextReviewAt, "2026-07-30T00:00:00.000Z");
  assert.equal(offsetReview.lastReviewedAt, "2026-07-29T17:00:00+07:00");
  assert.equal(offsetReview.nextReviewAt, "2026-07-30T07:00:00+07:00");
});

test("validateStudyReview preserves ISO timestamps with long fractions and basic numeric offsets", () => {
  const review = validateStudyReview({
    ...VALID_REVIEW,
    lastReviewedAt: "2026-07-29T17:00:00.123456Z",
    nextReviewAt: "2026-07-30T07:00:00.987654+0700",
  });

  assert.equal(review.lastReviewedAt, "2026-07-29T17:00:00.123456Z");
  assert.equal(review.nextReviewAt, "2026-07-30T07:00:00.987654+0700");
});

test("validateStudyReview rejects invalid study review records without exposing record data", () => {
  const inherited = Object.create(VALID_REVIEW);
  const cases = [
    ["null", null],
    ["non-object", "review"],
    ["array", []],
    ["inherited fields", inherited],
    ["empty noteId", { ...VALID_REVIEW, noteId: "" }],
    ["non-string noteId", { ...VALID_REVIEW, noteId: 42 }],
    ["unknown notebook type", { ...VALID_REVIEW, notebookType: "reading" }],
    ["unknown status", { ...VALID_REVIEW, status: "graduated" }],
    ["non-string next review time", { ...VALID_REVIEW, nextReviewAt: 42 }],
    ["invalid next review time", { ...VALID_REVIEW, nextReviewAt: "2026-07-30" }],
    ["impossible next review date", { ...VALID_REVIEW, nextReviewAt: "2026-02-30T00:00:00Z" }],
    ["invalid non-null last review time", { ...VALID_REVIEW, lastReviewedAt: "not-a-date" }],
    ["negative interval", { ...VALID_REVIEW, interval: -1 }],
    ["fractional interval", { ...VALID_REVIEW, interval: 1.5 }],
    ["unsafe interval", { ...VALID_REVIEW, interval: Number.MAX_SAFE_INTEGER + 1 }],
    ["non-number interval", { ...VALID_REVIEW, interval: "1" }],
    ["ease below minimum", { ...VALID_REVIEW, ease: 1.29 }],
    ["ease above maximum", { ...VALID_REVIEW, ease: 3.01 }],
    ["non-number ease", { ...VALID_REVIEW, ease: "2.5" }],
  ];

  for (const [label, review] of cases) {
    assert.throws(
      () => validateStudyReview(review),
      (error) => {
        assert.equal(error.name, "TypeError", label);
        assert.equal(error.code, "INVALID_STUDY_REVIEW", label);
        assert.doesNotMatch(error.message, /note-study-1|2026-07-(29|30)/, label);
        return true;
      },
    );
  }
});

test("validateStudyReview converts hostile own getter failures into content-free contract errors", () => {
  const fields = [
    "noteId",
    "notebookType",
    "status",
    "lastReviewedAt",
    "nextReviewAt",
    "interval",
    "ease",
  ];

  for (const field of fields) {
    const review = { ...VALID_REVIEW };
    Object.defineProperty(review, field, {
      enumerable: true,
      get() {
        throw new Error(`hostile ${field}: note-study-1 2026-07-30T00:00:00.000Z`);
      },
    });

    assert.throws(
      () => validateStudyReview(review),
      (error) => {
        assert.equal(error.name, "TypeError", field);
        assert.equal(error.code, "INVALID_STUDY_REVIEW", field);
        assert.doesNotMatch(error.message, /note-study-1|2026-07-30|hostile/, field);
        return true;
      },
    );
  }
});
