export const STUDY_NOTEBOOK_TYPES = Object.freeze([
  "vocabulary",
  "kanji",
  "grammar",
  "output",
  "planner",
]);

export const STUDY_REVIEW_STATUSES = Object.freeze([
  "new",
  "learning",
  "review",
  "suspended",
]);

const ISO_DATE_TIME_WITH_ZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isIsoDateTimeWithZone(value) {
  if (typeof value !== "string") {
    return false;
  }

  const match = ISO_DATE_TIME_WITH_ZONE.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = secondText === undefined ? 0 : Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59
    && Number.isFinite(Date.parse(value));
}

function isValidStudyReview(review) {
  return review !== null
    && typeof review === "object"
    && !Array.isArray(review)
    && hasOwn(review, "noteId")
    && typeof review.noteId === "string"
    && review.noteId.length > 0
    && hasOwn(review, "notebookType")
    && STUDY_NOTEBOOK_TYPES.includes(review.notebookType)
    && hasOwn(review, "status")
    && STUDY_REVIEW_STATUSES.includes(review.status)
    && hasOwn(review, "lastReviewedAt")
    && (review.lastReviewedAt === null || isIsoDateTimeWithZone(review.lastReviewedAt))
    && hasOwn(review, "nextReviewAt")
    && isIsoDateTimeWithZone(review.nextReviewAt)
    && hasOwn(review, "interval")
    && Number.isInteger(review.interval)
    && review.interval >= 0
    && hasOwn(review, "ease")
    && Number.isFinite(review.ease)
    && review.ease >= 1.3
    && review.ease <= 3;
}

function createInvalidStudyReviewError() {
  const error = new TypeError("Invalid study review");
  error.code = "INVALID_STUDY_REVIEW";
  return error;
}

export function validateStudyReview(review) {
  if (!isValidStudyReview(review)) {
    throw createInvalidStudyReviewError();
  }

  return {
    noteId: review.noteId,
    notebookType: review.notebookType,
    status: review.status,
    lastReviewedAt: review.lastReviewedAt,
    nextReviewAt: review.nextReviewAt,
    interval: review.interval,
    ease: review.ease,
  };
}
