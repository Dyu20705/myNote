import { validateStudyReview } from "./studyReview.js";

export const STUDY_RATINGS = Object.freeze(["again", "hard", "good", "easy"]);

const INITIAL_REVIEW_FIELDS = Object.freeze(["noteId", "notebookType", "nowIso"]);
const ZONED_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):?(\d{2}))$/;
const SECONDS_PER_DAY = 86400n;

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

function civilFromDays(daysSinceUnixEpoch) {
  const shiftedDays = daysSinceUnixEpoch + 719468n;
  const era = shiftedDays >= 0n
    ? shiftedDays / 146097n
    : (shiftedDays - 146096n) / 146097n;
  const dayOfEra = shiftedDays - era * 146097n;
  const yearOfEra = (dayOfEra - dayOfEra / 1460n + dayOfEra / 36524n - dayOfEra / 146096n) / 365n;
  let year = yearOfEra + era * 400n;
  const dayOfYear = dayOfEra - (365n * yearOfEra + yearOfEra / 4n - yearOfEra / 100n);
  const marchMonth = (5n * dayOfYear + 2n) / 153n;
  const day = dayOfYear - (153n * marchMonth + 2n) / 5n + 1n;
  const month = marchMonth < 10n ? marchMonth + 3n : marchMonth - 9n;
  year += month <= 2n ? 1n : 0n;

  return { year, month, day };
}

function padTwo(value) {
  return value.toString().padStart(2, "0");
}

function formatComputedInstant(seconds, fraction) {
  const days = seconds >= 0n ? seconds / SECONDS_PER_DAY : (seconds - (SECONDS_PER_DAY - 1n)) / SECONDS_PER_DAY;
  const secondsOfDay = seconds - days * SECONDS_PER_DAY;
  const { year, month, day } = civilFromDays(days);

  if (year < 0n || year > 9999n) {
    throw createInvalidSchedulerInputError();
  }

  const hour = secondsOfDay / 3600n;
  const minute = (secondsOfDay % 3600n) / 60n;
  const second = secondsOfDay % 60n;
  const renderedFraction = fraction === "" ? ".000" : `.${fraction}`;

  return `${year.toString().padStart(4, "0")}-${padTwo(month)}-${padTwo(day)}T${padTwo(hour)}:${padTwo(minute)}:${padTwo(second)}${renderedFraction}Z`;
}

function addSecondsToValidatedInstant(timestamp, secondsToAdd) {
  const instant = parseValidatedInstant(timestamp);
  return formatComputedInstant(instant.seconds + secondsToAdd, instant.fraction);
}

function ensureSafeInterval(interval) {
  if (!Number.isSafeInteger(interval) || interval < 0) {
    throw createInvalidSchedulerInputError();
  }

  return interval;
}

function normalizeEase(value) {
  return Math.round(value * 100) / 100;
}

function addIntervalDays(nowIso, interval) {
  return addSecondsToValidatedInstant(nowIso, BigInt(interval) * SECONDS_PER_DAY);
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

export function rateReview(review, rating, nowIso) {
  const validReview = validateStudyReview(review);
  if (!STUDY_RATINGS.includes(rating)) {
    throw createInvalidSchedulerInputError();
  }

  const validNowIso = validateCallerTime(nowIso);
  if (validReview.status === "suspended") {
    throw createInvalidSchedulerInputError();
  }

  const previousInterval = validReview.interval;
  let status;
  let interval;
  let ease;
  let nextReviewAt;

  if (rating === "again") {
    status = "learning";
    interval = 0;
    ease = Math.max(1.3, normalizeEase(validReview.ease - 0.2));
    nextReviewAt = addSecondsToValidatedInstant(validNowIso, 600n);
  } else if (rating === "hard") {
    status = previousInterval === 0 ? "learning" : "review";
    interval = ensureSafeInterval(Math.ceil(Math.max(previousInterval, 1) * 1.2));
    ease = Math.max(1.3, normalizeEase(validReview.ease - 0.15));
    nextReviewAt = addIntervalDays(validNowIso, interval);
  } else if (rating === "good") {
    status = "review";
    interval = previousInterval === 0
      ? 1
      : previousInterval === 1
        ? 3
        : Math.max(previousInterval + 1, Math.round(previousInterval * validReview.ease));
    interval = ensureSafeInterval(interval);
    ease = validReview.ease;
    nextReviewAt = addIntervalDays(validNowIso, interval);
  } else {
    status = "review";
    interval = previousInterval === 0
      ? 4
      : Math.max(previousInterval + 1, Math.round(previousInterval * validReview.ease * 1.3));
    interval = ensureSafeInterval(interval);
    ease = Math.min(3, normalizeEase(validReview.ease + 0.15));
    nextReviewAt = addIntervalDays(validNowIso, interval);
  }

  try {
    return validateStudyReview({
      noteId: validReview.noteId,
      notebookType: validReview.notebookType,
      status,
      lastReviewedAt: validNowIso,
      nextReviewAt,
      interval,
      ease,
    });
  } catch {
    throw createInvalidSchedulerInputError();
  }
}
