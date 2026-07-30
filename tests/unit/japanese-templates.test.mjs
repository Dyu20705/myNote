import assert from "node:assert/strict";
import test from "node:test";
import { STUDY_NOTEBOOK_TYPES } from "../../core/studyReview.js";
import {
  JAPANESE_NOTEBOOK_TYPES,
  createJapaneseTemplate,
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
