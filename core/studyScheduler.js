import { validateStudyReview } from "./studyReview.js";

export const STUDY_RATINGS = Object.freeze(["again", "hard", "good", "easy"]);

const INITIAL_REVIEW_FIELDS = Object.freeze(["noteId", "notebookType", "nowIso"]);

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

  return Date.parse(validReview.nextReviewAt) <= Date.parse(validNowIso);
}
