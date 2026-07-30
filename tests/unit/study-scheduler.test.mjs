import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDY_RATINGS,
  createInitialReview,
  isDue,
} from "../../core/studyScheduler.js";

const NOW = "2026-07-30T00:00:00.000Z";

function validReview(overrides = {}) {
  return {
    noteId: "note-study-1",
    notebookType: "vocabulary",
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: NOW,
    interval: 0,
    ease: 2.5,
    ...overrides,
  };
}

function assertSchedulerError(action, marker) {
  assert.throws(action, (error) => {
    assert.equal(error.name, "TypeError");
    assert.doesNotMatch(error.message, new RegExp(marker));
    return true;
  });
}

test("study scheduler exposes a frozen rating vocabulary", () => {
  assert.deepEqual(STUDY_RATINGS, ["again", "hard", "good", "easy"]);
  assert.equal(Object.isFrozen(STUDY_RATINGS), true);
});

test("createInitialReview produces fresh valid records for every persisted notebook type", () => {
  for (const notebookType of ["vocabulary", "kanji", "grammar", "output", "planner"]) {
    const input = { noteId: `note-${notebookType}`, notebookType, nowIso: NOW };
    const first = createInitialReview(input);
    const second = createInitialReview({ ...input });

    assert.deepEqual(first, {
      noteId: `note-${notebookType}`,
      notebookType,
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: NOW,
      interval: 0,
      ease: 2.5,
    });
    assert.deepEqual(Object.keys(first), [
      "noteId",
      "notebookType",
      "status",
      "lastReviewedAt",
      "nextReviewAt",
      "interval",
      "ease",
    ]);
    assert.notEqual(first, input);
    assert.notEqual(second, first);
  }
});

test("createInitialReview preserves accepted caller-clocked timestamp spellings", () => {
  for (const nowIso of [
    "2026-07-30T07:00:00+07:00",
    "2026-07-30T07:00:00.123456+0700",
    "2026-07-30T00:00:00.123456Z",
  ]) {
    assert.equal(createInitialReview({ noteId: "offset-note", notebookType: "vocabulary", nowIso }).nextReviewAt, nowIso);
  }
});

test("createInitialReview rejects malformed, inherited, and hostile boundaries without leaking caller data", () => {
  const cases = [
    [null, "null"],
    [{ noteId: "", notebookType: "vocabulary", nowIso: NOW }, "empty-id"],
    [{ noteId: "note", notebookType: "reading", nowIso: NOW }, "reading"],
    [{ noteId: "note", notebookType: "vocabulary", nowIso: "leak-invalid-time" }, "leak-invalid-time"],
    [{ noteId: "note", notebookType: "vocabulary", nowIso: NOW, extra: "leak-extra" }, "leak-extra"],
    [[], "array"],
  ];

  for (const [input, marker] of cases) {
    assertSchedulerError(() => createInitialReview(input), marker);
  }

  const inherited = Object.create({ noteId: "leak-inherited", notebookType: "vocabulary", nowIso: NOW });
  assertSchedulerError(() => createInitialReview(inherited), "leak-inherited");

  const getter = { noteId: "note", notebookType: "vocabulary" };
  Object.defineProperty(getter, "nowIso", {
    enumerable: true,
    get() {
      throw new Error("leak-hostile-getter");
    },
  });
  assertSchedulerError(() => createInitialReview(getter), "leak-hostile-getter");

  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error("leak-hostile-proxy");
    },
  });
  assertSchedulerError(() => createInitialReview(proxy), "leak-hostile-proxy");
});

test("isDue compares validated instants at before, equality, and after boundaries", () => {
  const review = validReview({ nextReviewAt: "2026-07-30T00:00:00.500Z" });

  assert.equal(isDue(review, "2026-07-30T00:00:00.499Z"), false);
  assert.equal(isDue(review, "2026-07-30T00:00:00.500Z"), true);
  assert.equal(isDue(review, "2026-07-30T00:00:00.501Z"), true);
});

test("isDue compares allowed offsets and fractional timestamps by instant", () => {
  const review = validReview({ nextReviewAt: "2026-07-30T07:00:00.500+0700" });

  assert.equal(isDue(review, "2026-07-30T00:00:00.499Z"), false);
  assert.equal(isDue(review, "2026-07-30T00:00:00.500000Z"), true);
});

test("isDue preserves arbitrary fractional-second precision across timezone offsets", () => {
  const review = validReview({ nextReviewAt: "2026-07-30T00:00:00.000000000000000000010Z" });

  assert.equal(isDue(review, "2026-07-30T00:00:00.000000000000000000009Z"), false);
  assert.equal(isDue(review, "2026-07-30T07:00:00.00000000000000000001+07:00"), true);
  assert.equal(isDue(review, "2026-07-30T07:00:00.0000000000000000000101+0700"), true);
});

test("isDue never makes suspended reviews due and does not mutate callers", () => {
  const review = validReview({ status: "suspended", nextReviewAt: "2026-07-29T00:00:00.000Z" });
  const before = structuredClone(review);

  assert.equal(isDue(review, NOW), false);
  assert.deepEqual(review, before);
});

test("isDue preserves the persisted invalid-review error and creates fresh errors", () => {
  const invalid = validReview({ interval: -1 });
  let first;
  let second;

  assert.throws(() => isDue(invalid, NOW), (error) => {
    first = error;
    assert.equal(error.name, "TypeError");
    assert.equal(error.code, "INVALID_STUDY_REVIEW");
    assert.doesNotMatch(error.message, /note-study-1|2026-07/);
    return true;
  });
  assert.throws(() => isDue(invalid, NOW), (error) => {
    second = error;
    assert.equal(error.code, "INVALID_STUDY_REVIEW");
    return true;
  });
  assert.notEqual(first, second);

  assertSchedulerError(() => isDue(validReview(), "leak-invalid-time"), "leak-invalid-time");
});
