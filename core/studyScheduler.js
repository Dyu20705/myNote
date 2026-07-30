import { validateStudyReview } from "./studyReview.js";

export const STUDY_RATINGS = Object.freeze(["again", "hard", "good", "easy"]);

const INITIAL_REVIEW_FIELDS = Object.freeze(["noteId", "notebookType", "nowIso"]);
const ZONED_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):?(\d{2}))$/;

function createInvalidSchedulerInputError() {
  return new TypeError("Invalid study scheduler input");
}

function readInitialReviewInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) {
    throw createInvalidSchedulerInputError();
  }

  const keys = Reflect.ownKeys(input);
  if (keys.length !== INITIAL_REVIEW_FIELDS.length || !INITIAL_REVIEW_FIELDS.every((field) => keys.includes(field))) {
    throw createInvalidSchedulerInputError();
  }

  const values = {};
  for (const field of INITIAL_REVIEW_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      throw createInvalidSchedulerInputError();
    }
    values[field] = descriptor.value;
  }

  return values;
}

function validateCallerTime(nowIso) {
  try {
    return validateStudyReview({
      noteId: "scheduler-time",
      notebookType: "vocabulary",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: nowIso,
      interval: 0,
      ease: 2.5,
    }).nextReviewAt;
  } catch {
    throw createInvalidSchedulerInputError();
  }
}

function daysFromCivil(year, month, day) {
  const adjustedYear = month <= 2n ? year - 1n : year;
  const era = adjustedYear >= 0n ? adjustedYear / 400n : (adjustedYear - 399n) / 400n;
  const yearOfEra = adjustedYear - era * 400n;
  const marchMonth = month > 2n ? month - 3n : month + 9n;
  const dayOfYear = (153n * marchMonth + 2n) / 5n + day - 1n;
  const dayOfEra = yearOfEra * 365n + yearOfEra / 4n - yearOfEra / 100n + dayOfYear;

  return era * 146097n + dayOfEra - 719468n;
}

function parseValidatedInstant(timestamp) {
  const match = ZONED_TIMESTAMP.exec(timestamp);
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, , sign, offsetHourText, offsetMinuteText] = match;
  const seconds = daysFromCivil(BigInt(yearText), BigInt(monthText), BigInt(dayText)) * 86400n
    + BigInt(hourText) * 3600n
    + BigInt(minuteText) * 60n
    + BigInt(secondText ?? "0");
  const offset = sign === undefined
    ? 0n
    : (BigInt(offsetHourText) * 3600n + BigInt(offsetMinuteText) * 60n) * (sign === "+" ? 1n : -1n);

  return { seconds: seconds - offset, fraction: fractionText ?? "" };
}

function compareFractions(left, right) {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftDigit = index < left.length ? left.charCodeAt(index) : 48;
    const rightDigit = index < right.length ? right.charCodeAt(index) : 48;
    if (leftDigit !== rightDigit) {
      return leftDigit < rightDigit ? -1 : 1;
    }
  }

  return 0;
}

function compareValidatedInstants(leftTimestamp, rightTimestamp) {
  const left = parseValidatedInstant(leftTimestamp);
  const right = parseValidatedInstant(rightTimestamp);
  if (left.seconds !== right.seconds) {
    return left.seconds < right.seconds ? -1 : 1;
  }

  return compareFractions(left.fraction, right.fraction);
}

export function createInitialReview(input) {
  try {
    const { noteId, notebookType, nowIso } = readInitialReviewInput(input);
    const nextReviewAt = validateCallerTime(nowIso);

    return validateStudyReview({
      noteId,
      notebookType,
      status: "new",
      lastReviewedAt: null,
      nextReviewAt,
      interval: 0,
      ease: 2.5,
    });
  } catch {
    throw createInvalidSchedulerInputError();
  }
}

export function isDue(review, nowIso) {
  const validReview = validateStudyReview(review);
  const validNowIso = validateCallerTime(nowIso);

  if (validReview.status === "suspended") {
    return false;
  }

  return compareValidatedInstants(validReview.nextReviewAt, validNowIso) <= 0;
}
