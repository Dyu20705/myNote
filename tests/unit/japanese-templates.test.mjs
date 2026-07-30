import assert from "node:assert/strict";
import test from "node:test";
import { STUDY_NOTEBOOK_TYPES } from "../../core/studyReview.js";
import {
  JAPANESE_NOTEBOOK_TYPES,
  createJapaneseTemplate,
  findEnrolledOutputNoteId,
  findEnrolledPlannerNoteId,
  reservedTagFor,
} from "../../core/japaneseTemplates.js";

const TEMPLATES = Object.freeze([
  {
    type: "vocabulary",
    tag: "#jp-vocabulary",
    title: "New vocabulary",
    options: undefined,
    content: "## Reading\n\n## Meaning\n\n## Example\n\n## Collocations\n-\n\n## Related words\n- Synonym:\n- Antonym:\n\n## Context\n- JLPT:\n- Topic:\n- Lesson:\n\n#jp-vocabulary",
  },
  {
    type: "kanji",
    tag: "#jp-kanji",
    title: "新しい漢字",
    options: undefined,
    content: "## Character\n\n## Readings\n- On:\n- Kun:\n- Sino-Vietnamese:\n\n## Meaning\n\n## Stroke order\n- Reference:\n\n## Common compounds\n1.\n2.\n3.\n\n## Notes\n\n#jp-kanji",
  },
  {
    type: "grammar",
    tag: "#jp-grammar",
    title: "New grammar pattern",
    options: undefined,
    content: "## Pattern\n\n## Structure\n\n## Meaning and usage\n\n## Examples\n1.\n2.\n\n## Similar or confusing patterns\n- Similar:\n- Difference:\n\n## Notes\n\n#jp-grammar",
  },
  {
    type: "output",
    tag: "#jp-output",
    title: "2026-07-30",
    options: { localDate: "2026-07-30" },
    content: "## 今日の文\n1.\n2.\n3.\n\n## Corrections\n-\n\n## Rewritten version\n\n## Error ledger\n-\n\n#jp-output",
  },
  {
    type: "planner",
    tag: "#jp-planner",
    title: "Japanese study plan — 2026-W31",
    options: { isoWeek: "2026-W31" },
    content: "## Weekly goals\n- [ ] Vocabulary:\n- [ ] Kanji:\n- [ ] Grammar:\n- [ ] Reading or listening:\n- [ ] Output practice:\n\n## Review plan\n- [ ]\n\n## End-of-week reflection\n- Completed:\n- Missed:\n- Adjustment:\n\n#jp-planner",
  },
]);

function assertTemplateError(action, marker) {
  assert.throws(action, (error) => {
    assert.equal(error.name, "TypeError");
    assert.doesNotMatch(error.message, new RegExp(marker));
    return true;
  });
}

function makeReview(noteId, notebookType, overrides = {}) {
  return {
    noteId,
    notebookType,
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: "2026-07-30T00:00:00.000Z",
    interval: 0,
    ease: 2.5,
    ...overrides,
  };
}

function assertLookupError(action, marker) {
  assert.throws(action, (error) => {
    assert.equal(error.name, "TypeError");
    assert.doesNotMatch(error.message, new RegExp(marker));
    return true;
  });
}

test("Japanese notebook types reuse the persisted study type contract", () => {
  assert.strictEqual(JAPANESE_NOTEBOOK_TYPES, STUDY_NOTEBOOK_TYPES);
  assert.equal(Object.isFrozen(JAPANESE_NOTEBOOK_TYPES), true);
  assert.deepEqual(JAPANESE_NOTEBOOK_TYPES, TEMPLATES.map(({ type }) => type));
});

test("reservedTagFor maps every supported type to its exact enrollment tag", () => {
  for (const { type, tag } of TEMPLATES) {
    assert.equal(reservedTagFor(type), tag);
  }
});

test("createJapaneseTemplate creates every exact template seed as a fresh exact-shape object", () => {
  for (const { type, title, content, options } of TEMPLATES) {
    const first = options === undefined
      ? createJapaneseTemplate(type)
      : createJapaneseTemplate(type, options);
    const second = options === undefined
      ? createJapaneseTemplate(type, {})
      : createJapaneseTemplate(type, { ...options });

    assert.deepEqual(first, { title, content }, type);
    assert.deepEqual(Object.keys(first), ["title", "content"], type);
    assert.deepEqual(second, first, type);
    assert.notEqual(second, first, type);
  }
});

test("createJapaneseTemplate accepts only a vacant plain object for static templates", () => {
  for (const type of ["vocabulary", "kanji", "grammar"]) {
    assert.deepEqual(createJapaneseTemplate(type, {}), createJapaneseTemplate(type), type);
    assertTemplateError(() => createJapaneseTemplate(type, { unknown: "leak-static-field" }), "leak-static-field");
    assertTemplateError(() => createJapaneseTemplate(type, null), "null");
    assertTemplateError(() => createJapaneseTemplate(type, []), "array");

    const inherited = Object.create({ unknown: "leak-inherited-field" });
    assertTemplateError(() => createJapaneseTemplate(type, inherited), "leak-inherited-field");
  }
});

test("createJapaneseTemplate validates real output calendar dates and exact own options", () => {
  assert.equal(createJapaneseTemplate("output", { localDate: "2024-02-29" }).title, "2024-02-29");

  for (const localDate of ["2026-02-29", "2026-13-01", "2026-00-01", "2026-04-31", "2026-7-30", "2026-07-30T00:00:00Z", "leak-output-date"]) {
    assertTemplateError(() => createJapaneseTemplate("output", { localDate }), localDate);
  }

  assertTemplateError(() => createJapaneseTemplate("output"), "output");
  assertTemplateError(() => createJapaneseTemplate("output", {}), "output");
  assertTemplateError(() => createJapaneseTemplate("output", { localDate: "2026-07-30", extra: "leak-output-extra" }), "leak-output-extra");

  const inherited = Object.create({ localDate: "leak-inherited-output-date" });
  assertTemplateError(() => createJapaneseTemplate("output", inherited), "leak-inherited-output-date");
});

test("createJapaneseTemplate validates real planner ISO weeks and exact own options", () => {
  assert.equal(createJapaneseTemplate("planner", { isoWeek: "2026-W01" }).title, "Japanese study plan — 2026-W01");
  assert.equal(createJapaneseTemplate("planner", { isoWeek: "2020-W53" }).title, "Japanese study plan — 2020-W53");

  for (const isoWeek of ["2026-W00", "2026-W54", "2021-W53", "2026-W1", "2026-W01T", "leak-planner-week"]) {
    assertTemplateError(() => createJapaneseTemplate("planner", { isoWeek }), isoWeek);
  }

  assertTemplateError(() => createJapaneseTemplate("planner"), "planner");
  assertTemplateError(() => createJapaneseTemplate("planner", {}), "planner");
  assertTemplateError(() => createJapaneseTemplate("planner", { isoWeek: "2026-W31", extra: "leak-planner-extra" }), "leak-planner-extra");

  const inherited = Object.create({ isoWeek: "leak-inherited-planner-week" });
  assertTemplateError(() => createJapaneseTemplate("planner", inherited), "leak-inherited-planner-week");
});

test("template APIs turn unsupported and hostile inputs into content-free errors", () => {
  assertTemplateError(() => reservedTagFor("leak-unsupported-type"), "leak-unsupported-type");
  assertTemplateError(() => createJapaneseTemplate("leak-unsupported-type"), "leak-unsupported-type");

  const getter = {};
  Object.defineProperty(getter, "localDate", {
    enumerable: true,
    get() {
      throw new Error("leak-hostile-getter");
    },
  });
  assertTemplateError(() => createJapaneseTemplate("output", getter), "leak-hostile-getter");

  const proxy = new Proxy({}, {
    ownKeys() {
      throw new Error("leak-hostile-proxy");
    },
  });
  assertTemplateError(() => createJapaneseTemplate("planner", proxy), "leak-hostile-proxy");
});

test("enrolled output lookup requires a valid review, exact date title, and exact reserved tag", () => {
  const localDate = "2026-07-30";
  const notes = [
    { id: "tag-only", title: localDate, content: "#jp-output" },
    { id: "wrong-type", title: localDate, content: "#jp-output" },
    { id: "wrong-title", title: "2026-07-29", content: "#jp-output" },
    { id: "missing-tag", title: localDate, content: "Study draft" },
    { id: "wrong-tag-token", title: localDate, content: "#jp-output-extra" },
    { id: "invalid-review", title: localDate, content: "#jp-output" },
    { id: "match-z", title: localDate, content: "## 今日の文\n\n#jp-output" },
    { id: "match-a", title: localDate, content: "#jp-output" },
    Object.create({ id: "inherited-note", title: localDate, content: "#jp-output" }),
  ];
  const reviews = [
    makeReview("orphan", "output"),
    makeReview("wrong-type", "planner"),
    makeReview("wrong-title", "output"),
    makeReview("missing-tag", "output"),
    makeReview("wrong-tag-token", "output"),
    makeReview("invalid-review", "output", { interval: -1 }),
    makeReview("match-z", "output"),
    makeReview("match-a", "output"),
    Object.create(makeReview("inherited-review", "output")),
  ];
  const before = structuredClone({ notes, reviews });

  assert.equal(findEnrolledOutputNoteId({ notes, reviews, localDate }), "match-a");
  assert.deepEqual({ notes, reviews }, before);
});

test("enrolled planner lookup accepts only a matching planner enrollment", () => {
  const isoWeek = "2026-W31";
  const title = "Japanese study plan — 2026-W31";
  const notes = [
    { id: "planner-b", title, content: "#jp-planner" },
    { id: "planner-a", title, content: "#jp-planner" },
    { id: "output-review", title, content: "#jp-planner" },
    { id: "wrong-week", title: "Japanese study plan — 2026-W30", content: "#jp-planner" },
  ];
  const reviews = [
    makeReview("planner-b", "planner"),
    makeReview("planner-a", "planner"),
    makeReview("output-review", "output"),
    makeReview("wrong-week", "planner"),
  ];

  assert.equal(findEnrolledPlannerNoteId({ notes, reviews, isoWeek }), "planner-a");
  assert.equal(findEnrolledPlannerNoteId({ notes, reviews, isoWeek: "2026-W32" }), undefined);
});

test("enrolled duplicate lookups use canonical punctuation-delimited tag tokens", () => {
  const localDate = "2026-07-30";
  const isoWeek = "2026-W31";
  const notes = [
    { id: "output-punctuation", title: localDate, content: "Draft (#jp-output), ready." },
    { id: "output-prefix", title: localDate, content: "#jp-output-extra" },
    { id: "output-continuation", title: localDate, content: "#jp-output_more" },
    { id: "planner-punctuation", title: "Japanese study plan — 2026-W31", content: "(#jp-planner)," },
    { id: "planner-prefix", title: "Japanese study plan — 2026-W31", content: "#jp-planner-extra" },
    { id: "planner-continuation", title: "Japanese study plan — 2026-W31", content: "#jp-planner_more" },
  ];
  const reviews = [
    makeReview("output-punctuation", "output"),
    makeReview("output-prefix", "output"),
    makeReview("output-continuation", "output"),
    makeReview("planner-punctuation", "planner"),
    makeReview("planner-prefix", "planner"),
    makeReview("planner-continuation", "planner"),
  ];

  assert.equal(findEnrolledOutputNoteId({ notes, reviews, localDate }), "output-punctuation");
  assert.equal(findEnrolledPlannerNoteId({ notes, reviews, isoWeek }), "planner-punctuation");
});

test("enrolled duplicate lookups reject malformed or hostile query boundaries without exposing input", () => {
  const finders = [
    [findEnrolledOutputNoteId, "localDate", "2026-07-30"],
    [findEnrolledPlannerNoteId, "isoWeek", "2026-W31"],
  ];

  for (const [finder, selector, value] of finders) {
    assertLookupError(() => finder(null), "null");
    assertLookupError(() => finder({ notes: [], reviews: [], [selector]: "leak-extra", unknown: "leak-extra" }), "leak-extra");
    assertLookupError(() => finder({ notes: {}, reviews: [], [selector]: value }), "notes");
    assertLookupError(() => finder({ notes: [], reviews: {}, [selector]: value }), "reviews");
    assertLookupError(() => finder({ notes: [], reviews: [], [selector]: "leak-selector" }), "leak-selector");

    const inherited = Object.create({ notes: [], reviews: [], [selector]: value });
    assertLookupError(() => finder(inherited), "inherited");

    const getter = { notes: [], reviews: [] };
    Object.defineProperty(getter, selector, {
      enumerable: true,
      get() {
        throw new Error("leak-hostile-query-getter");
      },
    });
    assertLookupError(() => finder(getter), "leak-hostile-query-getter");

    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("leak-hostile-query-proxy");
      },
    });
    assertLookupError(() => finder(proxy), "leak-hostile-query-proxy");
  }
});
