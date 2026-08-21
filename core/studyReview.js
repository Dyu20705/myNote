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

const ISO_DATE_TIME_WITH_ZONE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):?(\d{2}))$/;
const STUDY_REVIEW_FIELDS = Object.freeze([
  "noteId",
  "notebookType",
  "status",
  "lastReviewedAt",
  "nextReviewAt",
  "interval",
  "ease",
]);

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

function hasStudyReviewFields(review) {
  return review !== null
    && typeof review === "object"
    && !Array.isArray(review)
    && STUDY_REVIEW_FIELDS.every((field) => hasOwn(review, field));
}

function copyStudyReview(review) {
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

function isValidStudyReview(review) {
  return typeof review.noteId === "string"
    && review.noteId.length > 0
    && STUDY_NOTEBOOK_TYPES.includes(review.notebookType)
    && STUDY_REVIEW_STATUSES.includes(review.status)
    && (review.lastReviewedAt === null || isIsoDateTimeWithZone(review.lastReviewedAt))
    && isIsoDateTimeWithZone(review.nextReviewAt)
    && Number.isSafeInteger(review.interval)
    && review.interval >= 0
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
  try {
    if (!hasStudyReviewFields(review)) {
      throw new Error();
    }

    const copy = copyStudyReview(review);
    if (!isValidStudyReview(copy)) {
      throw new Error();
    }

    return copy;
  } catch {
    throw createInvalidStudyReviewError();
  }
}

export const STUDY_ARTIFACT_TYPES = Object.freeze(["output", "planner"]);

export function validateStudyArtifact(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    throw new TypeError("Invalid study artifact");
  }
  
  const copy = {
    id: artifact.id,
    noteId: artifact.noteId,
    type: artifact.type,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };

  if (typeof copy.id !== "string" || copy.id.length === 0) throw new TypeError("Invalid study artifact ID");
  if (typeof copy.noteId !== "string" || copy.noteId.length === 0) throw new TypeError("Invalid study artifact noteId");
  if (!STUDY_ARTIFACT_TYPES.includes(copy.type)) throw new TypeError("Invalid study artifact type");
  if (!isIsoDateTimeWithZone(copy.createdAt)) throw new TypeError("Invalid study artifact createdAt");
  if (!isIsoDateTimeWithZone(copy.updatedAt)) throw new TypeError("Invalid study artifact updatedAt");

  return copy;
}
