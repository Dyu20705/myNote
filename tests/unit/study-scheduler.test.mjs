import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDY_RATINGS,
  createInitialReview,
  isDue,
  rateReview,
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

test("rateReview applies every exact transition from a new card without mutating the caller", () => {
  const cases = [
    ["again", { status: "learning", interval: 0, ease: 2.3, nextReviewAt: "2026-07-30T00:10:00.000Z" }],
    ["hard", { status: "learning", interval: 2, ease: 2.35, nextReviewAt: "2026-08-01T00:00:00.000Z" }],
    ["good", { status: "review", interval: 1, ease: 2.5, nextReviewAt: "2026-07-31T00:00:00.000Z" }],
    ["easy", { status: "review", interval: 4, ease: 2.65, nextReviewAt: "2026-08-03T00:00:00.000Z" }],
  ];

  for (const [rating, expected] of cases) {
    const review = validReview();
    const before = structuredClone(review);
    const actual = rateReview(review, rating, NOW);

    assert.deepEqual(actual, {
      ...review,
      ...expected,
      lastReviewedAt: NOW,
    });
    assert.notEqual(actual, review);
    assert.deepEqual(review, before);
  }
});

test("rateReview applies established intervals and ease floors and ceilings exactly", () => {
  const nowIso = "2026-07-30T00:00:00.000Z";

  assert.deepEqual(rateReview(validReview({ interval: 1, ease: 1.3 }), "again", nowIso), {
    ...validReview({ interval: 1, ease: 1.3 }),
    status: "learning",
    lastReviewedAt: nowIso,
    nextReviewAt: "2026-07-30T00:10:00.000Z",
    interval: 0,
    ease: 1.3,
  });
  assert.deepEqual(rateReview(validReview({ interval: 1, ease: 1.3 }), "hard", nowIso), {
    ...validReview({ interval: 1, ease: 1.3 }),
    status: "review",
    lastReviewedAt: nowIso,
    nextReviewAt: "2026-08-01T00:00:00.000Z",
    interval: 2,
    ease: 1.3,
  });
  assert.deepEqual(rateReview(validReview({ interval: 1, ease: 2.5 }), "good", nowIso), {
    ...validReview({ interval: 1, ease: 2.5 }),
    status: "review",
    lastReviewedAt: nowIso,
    nextReviewAt: "2026-08-02T00:00:00.000Z",
    interval: 3,
    ease: 2.5,
  });
  assert.deepEqual(rateReview(validReview({ interval: 6, ease: 3 }), "easy", nowIso), {
    ...validReview({ interval: 6, ease: 3 }),
    status: "review",
    lastReviewedAt: nowIso,
    nextReviewAt: "2026-08-22T00:00:00.000Z",
    interval: 23,
    ease: 3,
  });
});

test("rateReview normalizes adjusted ease to two decimals while good preserves the stored value", () => {
  const review = validReview({ interval: 2, ease: 2.555 });

  assert.equal(rateReview(review, "again", NOW).ease, 2.36);
  assert.equal(rateReview(review, "hard", NOW).ease, 2.41);
  assert.equal(rateReview(review, "good", NOW).ease, 2.555);
  assert.equal(rateReview(review, "easy", NOW).ease, 2.71);
});

test("rateReview uses exactly 24-hour days and preserves fractional precision from caller time", () => {
  const nowIso = "2026-10-25T23:30:00.123456+02:00";
  const result = rateReview(validReview({ interval: 1, ease: 2.5 }), "good", nowIso);

  assert.equal(result.lastReviewedAt, nowIso);
  assert.equal(result.nextReviewAt, "2026-10-28T21:30:00.123456Z");
  assert.equal(isDue(result, "2026-10-28T21:30:00.123455999Z"), false);
  assert.equal(isDue(result, "2026-10-28T21:30:00.123456Z"), true);
});

test("rateReview canonicalizes computed timestamps when caller time omits seconds", () => {
  const nowIso = "2026-07-30T07:00+07:00";
  const result = rateReview(validReview(), "again", nowIso);

  assert.equal(result.lastReviewedAt, nowIso);
  assert.equal(result.nextReviewAt, "2026-07-30T00:10:00.000Z");
});

test("rateReview rejects unknown ratings, suspended cards, and unsafe interval or timestamp arithmetic without leaking inputs", () => {
  assertSchedulerError(() => rateReview(validReview(), "leak-rating", NOW), "leak-rating");
  assertSchedulerError(() => rateReview(validReview({ status: "suspended" }), "good", NOW), "suspended");
  assertSchedulerError(
    () => rateReview(validReview({ interval: Number.MAX_SAFE_INTEGER }), "hard", NOW),
    "note-study-1",
  );
  assertSchedulerError(
    () => rateReview(validReview(), "easy", "9999-12-31T23:59:59.999999Z"),
    "9999",
  );
});

test("rateReview keeps invalid-review provenance and returns fresh application errors", () => {
  const invalid = validReview({ ease: 3.1 });
  let first;
  let second;

  assert.throws(() => rateReview(invalid, "good", NOW), (error) => {
    first = error;
    assert.equal(error.name, "TypeError");
    assert.equal(error.code, "INVALID_STUDY_REVIEW");
    return true;
  });
  assert.throws(() => rateReview(invalid, "good", NOW), (error) => {
    second = error;
    assert.equal(error.code, "INVALID_STUDY_REVIEW");
    return true;
  });
  assert.notEqual(first, second);

  let invalidTimeFirst;
  let invalidTimeSecond;
  assert.throws(() => rateReview(validReview(), "good", "leak-time"), (error) => {
    invalidTimeFirst = error;
    assert.equal(error.name, "TypeError");
    assert.doesNotMatch(error.message, /leak-time/);
    return true;
  });
  assert.throws(() => rateReview(validReview(), "good", "leak-time"), (error) => {
    invalidTimeSecond = error;
    return true;
  });
  assert.notEqual(invalidTimeFirst, invalidTimeSecond);
});