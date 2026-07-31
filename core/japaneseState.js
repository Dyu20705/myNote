import { deriveStudyDashboard } from "./studyDashboard.js";
import { isDue } from "./studyScheduler.js";
import { validateStudyReview } from "./studyReview.js";

export const JAPANESE_STATUS_LIMIT = 20;

const WORKSPACES = Object.freeze(["notes", "japanese"]);

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

function buildNoteMap(notes, statusMap) {
  const groups = new Map();
  let invalidCount = 0;

  for (const candidate of notes) {
    const parsed = readNote(candidate);
    if (!parsed) {
      invalidCount += 1;
      continue;
    }
    const group = groups.get(parsed.id) ?? [];
    group.push(parsed);
    groups.set(parsed.id, group);
  }

  if (invalidCount > 0) {
    addStatus(statusMap, "invalid-note", undefined, invalidCount);
  }

  const result = new Map();
  for (const [noteId, group] of groups) {
    group.sort((left, right) => compareText(noteSortKey(left), noteSortKey(right)));
    result.set(noteId, group[0]);
    if (group.length > 1) {
      addStatus(statusMap, "duplicate-note", noteId, group.length - 1);
    }
  }
  return result;
}

function buildReviewMap(reviews, statusMap) {
  const groups = new Map();
  let invalidCount = 0;

  for (const candidate of reviews) {
    let valid;
    try {
      valid = validateStudyReview(candidate);
    } catch {
      invalidCount += 1;
      continue;
    }

    const group = groups.get(valid.noteId) ?? [];
    group.push(valid);
    groups.set(valid.noteId, group);
  }

  if (invalidCount > 0) {
    addStatus(statusMap, "invalid-review", undefined, invalidCount);
  }

  const result = new Map();
  for (const [noteId, group] of groups) {
    group.sort((left, right) => compareText(reviewSortKey(left), reviewSortKey(right)));
    result.set(noteId, group[0]);
    if (group.length > 1) {
      addStatus(statusMap, "duplicate-review", noteId, group.length - 1);
    }
  }
  return result;
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

function readQueueInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) {
    throw createInvalidStateInputError();
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 3 || !["notes", "reviews", "nowIso"].every((key) => keys.includes(key))) {
    throw createInvalidStateInputError();
  }
  if (!Array.isArray(input.notes) || !Array.isArray(input.reviews)) {
    throw createInvalidStateInputError();
  }
  return input;
}

export function buildDueReviewQueue(input) {
  try {
    const { notes, reviews, nowIso } = readQueueInput(input);
    const statusMap = new Map();
    const notesById = buildNoteMap(notes, statusMap);
    const reviewsById = buildReviewMap(reviews, statusMap);
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

    const finalized = finalizeStatus(statusMap);
    return {
      queue: queue.map(({ noteId, notebookType }) => ({ noteId, notebookType })),
      status: finalized.status,
      statusOmitted: finalized.statusOmitted,
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

function readAppInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) {
    throw createInvalidStateInputError();
  }
  const fields = ["notes", "reviews", "nowIso", "localDate", "isoWeek"];
  const keys = Reflect.ownKeys(input);
  if (keys.length !== fields.length || !fields.every((field) => keys.includes(field))
    || !Array.isArray(input.notes) || !Array.isArray(input.reviews)) {
    throw createInvalidStateInputError();
  }
  return input;
}

export function createJapaneseAppState(input) {
  try {
    const { notes, reviews, nowIso, localDate, isoWeek } = readAppInput(input);
    const statusMap = new Map();
    const notesById = buildNoteMap(notes, statusMap);
    const reviewsById = buildReviewMap(reviews, statusMap);
    const queueResult = buildDueReviewQueue({ notes, reviews, nowIso });
    for (const entry of queueResult.status) {
      addStatus(statusMap, entry.code, entry.noteId, entry.count);
    }

    const studyReviews = [...reviewsById.values()]
      .sort((left, right) => compareText(left.noteId, right.noteId))
      .map((review) => ({ ...review }));
    const japaneseNoteIds = studyReviews
      .filter((review) => {
        const note = notesById.get(review.noteId);
        return note !== undefined && !note.archived;
      })
      .map((review) => review.noteId)
      .sort(compareText);
    const finalized = finalizeStatus(statusMap);

    return {
      workspace: "notes",
      studyReviews,
      japaneseNoteIds,
      studyDashboard: deriveStudyDashboard({ notes, reviews, nowIso, localDate, isoWeek }),
      studyStatus: finalized.status,
      studyStatusOmitted: finalized.statusOmitted,
      studyContext: { nowIso, localDate, isoWeek },
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
    if (input === null || typeof input !== "object" || Array.isArray(input)
      || Object.getPrototypeOf(input) !== Object.prototype
      || Reflect.ownKeys(input).length !== 1
      || Reflect.ownKeys(input)[0] !== "nowIso") {
      throw createInvalidStateInputError();
    }
    const result = buildDueReviewQueue({
      notes: state.notes,
      reviews: state.studyReviews,
      nowIso: input.nowIso,
    });
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
