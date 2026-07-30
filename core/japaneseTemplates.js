import { STUDY_NOTEBOOK_TYPES } from "./studyReview.js";

export const JAPANESE_NOTEBOOK_TYPES = STUDY_NOTEBOOK_TYPES;

const TEMPLATE_BY_TYPE = Object.freeze({
  vocabulary: Object.freeze({
    tag: "#jp-vocabulary",
    title: "New vocabulary",
    content: "## Reading\n\n## Meaning\n\n## Example\n\n## Collocations\n-\n\n## Related words\n- Synonym:\n- Antonym:\n\n## Context\n- JLPT:\n- Topic:\n- Lesson:\n\n#jp-vocabulary",
  }),
  kanji: Object.freeze({
    tag: "#jp-kanji",
    title: "新しい漢字",
    content: "## Character\n\n## Readings\n- On:\n- Kun:\n- Sino-Vietnamese:\n\n## Meaning\n\n## Stroke order\n- Reference:\n\n## Common compounds\n1.\n2.\n3.\n\n## Notes\n\n#jp-kanji",
  }),
  grammar: Object.freeze({
    tag: "#jp-grammar",
    title: "New grammar pattern",
    content: "## Pattern\n\n## Structure\n\n## Meaning and usage\n\n## Examples\n1.\n2.\n\n## Similar or confusing patterns\n- Similar:\n- Difference:\n\n## Notes\n\n#jp-grammar",
  }),
  output: Object.freeze({
    tag: "#jp-output",
    content: "## 今日の文\n1.\n2.\n3.\n\n## Corrections\n-\n\n## Rewritten version\n\n## Error ledger\n-\n\n#jp-output",
  }),
  planner: Object.freeze({
    tag: "#jp-planner",
    content: "## Weekly goals\n- [ ] Vocabulary:\n- [ ] Kanji:\n- [ ] Grammar:\n- [ ] Reading or listening:\n- [ ] Output practice:\n\n## Review plan\n- [ ]\n\n## End-of-week reflection\n- Completed:\n- Missed:\n- Adjustment:\n\n#jp-planner",
  }),
});

function createInvalidTemplateError() {
  return new TypeError("Invalid Japanese template input");
}

function getTemplate(type) {
  if (typeof type !== "string" || !Object.hasOwn(TEMPLATE_BY_TYPE, type)) {
    throw createInvalidTemplateError();
  }

  return TEMPLATE_BY_TYPE[type];
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
}

function weeksInIsoYear(year) {
  const januaryFirst = new Date(0);
  januaryFirst.setUTCFullYear(year, 0, 1);
  const day = januaryFirst.getUTCDay();

  return day === 4 || (day === 3 && isLeapYear(year)) ? 53 : 52;
}

function isIsoWeek(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, weekText] = match;
  const year = Number(yearText);
  const week = Number(weekText);

  return week >= 1 && week <= weeksInIsoYear(year);
}

function readExactOption(options, expectedField) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw createInvalidTemplateError();
  }

  if (Object.getPrototypeOf(options) !== Object.prototype) {
    throw createInvalidTemplateError();
  }

  const keys = Reflect.ownKeys(options);
  if (keys.length !== 1 || keys[0] !== expectedField) {
    throw createInvalidTemplateError();
  }

  const descriptor = Object.getOwnPropertyDescriptor(options, expectedField);
  if (descriptor === undefined || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
    throw createInvalidTemplateError();
  }

  return descriptor.value;
}

function assertEmptyOptions(options) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw createInvalidTemplateError();
  }

  if (Object.getPrototypeOf(options) !== Object.prototype || Reflect.ownKeys(options).length !== 0) {
    throw createInvalidTemplateError();
  }
}

export function reservedTagFor(type) {
  try {
    return getTemplate(type).tag;
  } catch {
    throw createInvalidTemplateError();
  }
}

export function createJapaneseTemplate(type, options = {}) {
  try {
    const template = getTemplate(type);

    if (type === "output") {
      const localDate = readExactOption(options, "localDate");
      if (!isCalendarDate(localDate)) {
        throw createInvalidTemplateError();
      }

      return { title: localDate, content: template.content };
    }

    if (type === "planner") {
      const isoWeek = readExactOption(options, "isoWeek");
      if (!isIsoWeek(isoWeek)) {
        throw createInvalidTemplateError();
      }

      return { title: `Japanese study plan — ${isoWeek}`, content: template.content };
    }

    assertEmptyOptions(options);
    return { title: template.title, content: template.content };
  } catch {
    throw createInvalidTemplateError();
  }
}
