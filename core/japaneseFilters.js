import { STUDY_NOTEBOOK_TYPES } from "./studyReview.js";

function pad(value) {
  return String(value).padStart(2, "0");
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

function normalizedDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function normalizedNotebookType(value) {
  return STUDY_NOTEBOOK_TYPES.includes(value) ? value : "all";
}

export function filterJapaneseNoteIds(input = {}) {
  const ids = Array.isArray(input.ids) ? input.ids : [];
  const notes = Array.isArray(input.notes) ? input.notes : [];
  const reviews = Array.isArray(input.reviews) ? input.reviews : [];
  const filters = input.filters && typeof input.filters === "object" ? input.filters : {};
  const fromDate = normalizedDate(filters.fromDate);
  const toDate = normalizedDate(filters.toDate);
  const notebookType = normalizedNotebookType(filters.notebookType);

  if (!fromDate && !toDate && notebookType === "all") {
    return [...ids];
  }

  const notesById = new Map(notes
    .filter((note) => note && typeof note.id === "string")
    .map((note) => [note.id, note]));
  const notebookTypeById = new Map(reviews
    .filter((review) => review
      && typeof review.noteId === "string"
      && STUDY_NOTEBOOK_TYPES.includes(review.notebookType))
    .map((review) => [review.noteId, review.notebookType]));

  return ids.filter((id) => {
    if (notebookType !== "all" && notebookTypeById.get(id) !== notebookType) {
      return false;
    }
    if (!fromDate && !toDate) {
      return true;
    }

    const noteDate = localDateFromIso(notesById.get(id)?.createdAt);
    if (!noteDate) {
      return false;
    }
    return (!fromDate || noteDate >= fromDate) && (!toDate || noteDate <= toDate);
  });
}
