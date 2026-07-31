import { STUDY_NOTEBOOK_TYPES } from "./studyReview.js";

const ALL_NOTEBOOK_TYPES = "all";
const INVALID_DATE_RANGE = "INVALID_DATE_RANGE";
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year, month) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function normalizeDate(value) {
  if (typeof value !== "string") {
    return "";
  }
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return "";
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return "";
  }
  return value;
}

function normalizeNotebookType(value) {
  return STUDY_NOTEBOOK_TYPES.includes(value) ? value : ALL_NOTEBOOK_TYPES;
}

function localDateFromIso(value) {
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeFilters(filters = {}) {
  const source = filters && typeof filters === "object" && !Array.isArray(filters) ? filters : {};
  return {
    fromDate: normalizeDate(source.fromDate),
    toDate: normalizeDate(source.toDate),
    notebookType: normalizeNotebookType(source.notebookType),
  };
}

function validationError(filters) {
  return filters.fromDate && filters.toDate && filters.fromDate > filters.toDate
    ? INVALID_DATE_RANGE
    : null;
}

function noteIndex(notes) {
  return new Map((Array.isArray(notes) ? notes : [])
    .filter((note) => note && typeof note.id === "string")
    .map((note) => [note.id, note]));
}

function notebookTypeIndex(reviews) {
  const index = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    if (!review
      || typeof review.noteId !== "string"
      || !STUDY_NOTEBOOK_TYPES.includes(review.notebookType)) {
      continue;
    }
    const current = index.get(review.noteId);
    if (current && current !== review.notebookType) {
      index.set(review.noteId, null);
    } else if (!index.has(review.noteId)) {
      index.set(review.noteId, review.notebookType);
    }
  }
  return index;
}

export function filterJapaneseNoteIds(input = {}) {
  const ids = Array.isArray(input.ids) ? input.ids : [];
  const filters = normalizeFilters(input.filters);
  const hasEnrollmentBoundary = Array.isArray(input.enrolledIds);
  const enrolledIds = new Set(hasEnrollmentBoundary ? input.enrolledIds : []);
  const active = Boolean(filters.fromDate || filters.toDate || filters.notebookType !== ALL_NOTEBOOK_TYPES);

  if (!active && !hasEnrollmentBoundary) {
    return [...ids];
  }
  if (validationError(filters)) {
    return [];
  }

  const notesById = noteIndex(input.notes);
  const typesById = filters.notebookType === ALL_NOTEBOOK_TYPES
    ? null
    : notebookTypeIndex(input.reviews);

  return ids.filter((id) => {
    if (hasEnrollmentBoundary && !enrolledIds.has(id)) {
      return false;
    }
    const note = notesById.get(id);
    if (!note) {
      return false;
    }
    if (typesById && typesById.get(id) !== filters.notebookType) {
      return false;
    }
    if (!filters.fromDate && !filters.toDate) {
      return true;
    }

    const noteDate = localDateFromIso(note.createdAt);
    return Boolean(noteDate)
      && (!filters.fromDate || noteDate >= filters.fromDate)
      && (!filters.toDate || noteDate <= filters.toDate);
  });
}

export class JapaneseNoteFilter {
  id = "japanese-note-filter";
  #filters = normalizeFilters();
  #getState;

  constructor({ getState }) {
    if (typeof getState !== "function") {
      throw new TypeError("Japanese note filter requires state access");
    }
    this.#getState = getState;
  }

  getFilters() {
    return { ...this.#filters };
  }

  update(next = {}) {
    const patch = next && typeof next === "object" && !Array.isArray(next) ? next : {};
    this.#filters = normalizeFilters({ ...this.#filters, ...patch });
    return this.getFilters();
  }

  reset() {
    this.#filters = normalizeFilters();
    return this.getFilters();
  }

  isActive() {
    return Boolean(
      this.#filters.fromDate
      || this.#filters.toDate
      || this.#filters.notebookType !== ALL_NOTEBOOK_TYPES
    );
  }

  getValidationError() {
    return validationError(this.#filters);
  }

  apply(ids) {
    const state = this.#getState() || {};
    if (state.workspace !== "japanese") {
      return [...ids];
    }
    return filterJapaneseNoteIds({
      ids,
      notes: state.notes,
      reviews: state.studyReviews,
      enrolledIds: state.japaneseNoteIds,
      filters: this.#filters,
    });
  }
}

export const JAPANESE_FILTER_ERRORS = Object.freeze({
  INVALID_DATE_RANGE,
});
