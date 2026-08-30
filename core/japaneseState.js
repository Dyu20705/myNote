import { deriveStudyDashboard } from "./studyDashboard.js";
import { isDue } from "./studyScheduler.js";
import { validateStudyReview } from "./studyReview.js";

export const JAPANESE_STATUS_LIMIT = 20;

const WORKSPACES = Object.freeze(["notes", "japanese", "archive"]);

function createInvalidStateInputError() {
  return new TypeError("Invalid Japanese state input");
}

function compareText(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function readDataProperty(object, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function readNote(candidate) {
  try {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)
      || Object.getPrototypeOf(candidate) !== Object.prototype) {
      return null;
    }

    const id = readDataProperty(candidate, "id");
    const title = readDataProperty(candidate, "title");
    const content = readDataProperty(candidate, "content");
    const archived = readDataProperty(candidate, "archived");
    if (typeof id !== "string" || id.length === 0
      || typeof title !== "string"
      || typeof content !== "string"
      || typeof archived !== "boolean") {
      return null;
    }

    return { id, title, content, archived };
  } catch {
    return null;
  }
}

function noteSortKey(note) {
  return JSON.stringify([note.title, note.content, note.archived]);
}

function reviewSortKey(review) {
  return JSON.stringify([
    review.notebookType,
    review.status,
    review.lastReviewedAt,
    review.nextReviewAt,
    review.interval,
    review.ease,
  ]);
}

function addStatus(statusMap, code, noteId, count = 1) {
  const safeNoteId = typeof noteId === "string" ? noteId : undefined;
  const key = `${code}\u0000${safeNoteId ?? ""}`;
  const existing = statusMap.get(key);
  if (existing) {
    existing.count += count;
    return;
  }

  const entry = { code };
  if (safeNoteId !== undefined) {
    entry.noteId = safeNoteId;
  }
  entry.count = count;
  statusMap.set(key, entry);
}

function finalizeStatus(statusMap) {
  const ordered = [...statusMap.values()].sort((left, right) => {
    const byCode = compareText(left.code, right.code);
    return byCode !== 0 ? byCode : compareText(left.noteId ?? "", right.noteId ?? "");
  });
  return {
    status: ordered.slice(0, JAPANESE_STATUS_LIMIT).map((entry) => ({ ...entry })),
    statusOmitted: Math.max(0, ordered.length - JAPANESE_STATUS_LIMIT),
  };
}

function analyzeRecords(notes, reviews) {
  const statusMap = new Map();
  const noteGroups = new Map();
  const reviewGroups = new Map();
  let invalidNotes = 0;
  let invalidReviews = 0;

  for (const candidate of notes) {
    const note = readNote(candidate);
    if (!note) {
      invalidNotes += 1;
      continue;
    }
    const group = noteGroups.get(note.id) ?? [];
    group.push(note);
    noteGroups.set(note.id, group);
  }

  for (const candidate of reviews) {
    try {
      const review = validateStudyReview(candidate);
      const group = reviewGroups.get(review.noteId) ?? [];
      group.push(review);
      reviewGroups.set(review.noteId, group);
    } catch {
      invalidReviews += 1;
    }
  }

  if (invalidNotes > 0) {
    addStatus(statusMap, "invalid-note", undefined, invalidNotes);
  }
  if (invalidReviews > 0) {
    addStatus(statusMap, "invalid-review", undefined, invalidReviews);
  }

  const notesById = new Map();
  for (const [noteId, group] of noteGroups) {
    group.sort((left, right) => compareText(noteSortKey(left), noteSortKey(right)));
    notesById.set(noteId, group[0]);
    if (group.length > 1) {
      addStatus(statusMap, "duplicate-note", noteId, group.length - 1);
    }
  }

  const reviewsById = new Map();
  for (const [noteId, group] of reviewGroups) {
    group.sort((left, right) => compareText(reviewSortKey(left), reviewSortKey(right)));
    reviewsById.set(noteId, group[0]);
    if (group.length > 1) {
      addStatus(statusMap, "duplicate-review", noteId, group.length - 1);
    }
  }

  return { notesById, reviewsById, statusMap };
}

function assertExactObject(input, fields) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) {
    throw createInvalidStateInputError();
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || !fields.every((field) => keys.includes(field))) {
    throw createInvalidStateInputError();
  }
}

function deriveDueQueue(notes, reviews, nowIso) {
  const { notesById, reviewsById, statusMap } = analyzeRecords(notes, reviews);
  const queue = [];

  for (const review of reviewsById.values()) {
    const note = notesById.get(review.noteId);
    if (!note) {
      addStatus(statusMap, "orphan-review", review.noteId);
      continue;
    }
    if (note.archived) {
      addStatus(statusMap, "archived-note", review.noteId);
      continue;
    }
    if (isDue(review, nowIso)) {
      queue.push({
        noteId: review.noteId,
        notebookType: review.notebookType,
        nextReviewAt: review.nextReviewAt,
      });
    }
  }

  queue.sort((left, right) => {
    const byTime = compareText(left.nextReviewAt, right.nextReviewAt);
    return byTime !== 0 ? byTime : compareText(left.noteId, right.noteId);
  });

  return {
    notesById,
    reviewsById,
    queue: queue.map(({ noteId, notebookType }) => ({ noteId, notebookType })),
    ...finalizeStatus(statusMap),
  };
}

export function buildDueReviewQueue(input) {
  try {
    if ("limit" in input) {
      assertExactObject(input, ["notes", "reviews", "nowIso", "limit"]);
    } else {
      assertExactObject(input, ["notes", "reviews", "nowIso"]);
    }
    if (!Array.isArray(input.notes) || !Array.isArray(input.reviews)) {
      throw createInvalidStateInputError();
    }
    const result = deriveDueQueue(input.notes, input.reviews, input.nowIso);
    return {
      queue: result.queue,
      status: result.status,
      statusOmitted: result.statusOmitted,
    };
  } catch {
    throw createInvalidStateInputError();
  }
}

function createIdleSession() {
  return {
    status: "idle",
    queue: [],
    index: 0,
    currentNoteId: null,
    revealed: false,
    message: null,
    pendingRating: null,
  };
}

export function createJapaneseAppState(input) {
  try {
    assertExactObject(input, ["notes", "reviews", "nowIso", "localDate", "isoWeek"]);
    if (!Array.isArray(input.notes) || !Array.isArray(input.reviews)) {
      throw createInvalidStateInputError();
    }

    const result = deriveDueQueue(input.notes, input.reviews, input.nowIso);
    const studyReviews = [...result.reviewsById.values()]
      .sort((left, right) => compareText(left.noteId, right.noteId))
      .map((review) => ({ ...review }));
    const japaneseNoteIds = studyReviews
      .filter((review) => {
        const note = result.notesById.get(review.noteId);
        return note !== undefined && !note.archived;
      })
      .map((review) => review.noteId)
      .sort(compareText);

    return {
      workspace: "notes",
      studyReviews,
      japaneseNoteIds,
      studyDashboard: deriveStudyDashboard(input),
      studyStatus: result.status,
      studyStatusOmitted: result.statusOmitted,
      studyContext: {
        nowIso: input.nowIso,
        localDate: input.localDate,
        isoWeek: input.isoWeek,
      },
      reviewSession: createIdleSession(),
    };
  } catch {
    throw createInvalidStateInputError();
  }
}

function assertState(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    throw createInvalidStateInputError();
  }
}

export function selectWorkspace(state, workspace) {
  try {
    assertState(state);
    if (!WORKSPACES.includes(workspace)) {
      throw createInvalidStateInputError();
    }
    return { ...state, workspace };
  } catch {
    throw createInvalidStateInputError();
  }
}

export function startReviewSession(state, input) {
  try {
    assertState(state);
    const hasLimit = "limit" in input;
    if (hasLimit) {
      assertExactObject(input, ["nowIso", "limit"]);
    } else {
      assertExactObject(input, ["nowIso"]);
    }
    const buildInput = {
      notes: state.notes,
      reviews: state.studyReviews,
      nowIso: input.nowIso,
    };
    if (hasLimit) buildInput.limit = input.limit;
    const result = buildDueReviewQueue(buildInput);
    const queue = result.queue.map((item) => ({ ...item }));
    return {
      ...state,
      studyStatus: result.status,
      studyStatusOmitted: result.statusOmitted,
      reviewSession: {
        status: queue.length === 0 ? "complete" : "active",
        queue,
        index: 0,
        currentNoteId: queue[0]?.noteId ?? null,
        revealed: false,
        message: null,
        pendingRating: null,
      },
    };
  } catch {
    throw createInvalidStateInputError();
  }
}

export function revealCurrentReview(state) {
  try {
    assertState(state);
    if (state.reviewSession?.status !== "active") {
      return state;
    }
    return {
      ...state,
      reviewSession: {
        ...state.reviewSession,
        revealed: true,
      },
    };
  } catch {
    throw createInvalidStateInputError();
  }
}

export function advanceReviewSession(state, message = null) {
  try {
    assertState(state);
    const session = state.reviewSession;
    if (!session || session.status !== "active") {
      return state;
    }
    if (message !== null && typeof message !== "string") {
      throw createInvalidStateInputError();
    }

    const nextIndex = session.index + 1;
    const next = session.queue[nextIndex];
    return {
      ...state,
      reviewSession: {
        ...session,
        status: next ? "active" : "complete",
        index: nextIndex,
        currentNoteId: next?.noteId ?? null,
        revealed: false,
        message,
        pendingRating: null,
      },
    };
  } catch {
    throw createInvalidStateInputError();
  }
}
