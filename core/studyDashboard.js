import { createJapaneseTemplate } from "./japaneseTemplates.js";
import { parseDocument } from "./parser/index.js";
import { isDue } from "./studyScheduler.js";
import { validateStudyReview } from "./studyReview.js";

export const STUDY_DASHBOARD_REPAIR_LIMIT = 20;

const DASHBOARD_INPUT_FIELDS = Object.freeze([
  "notes",
  "reviews",
  "nowIso",
  "localDate",
  "isoWeek",
]);

function createInvalidDashboardInputError() {
  const error = new TypeError("Invalid study dashboard input");
  error.code = "INVALID_STUDY_DASHBOARD_INPUT";
  return error;
}

function readExactInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)
    || Object.getPrototypeOf(input) !== Object.prototype) {
    throw createInvalidDashboardInputError();
  }

  const keys = Reflect.ownKeys(input);
  if (keys.length !== DASHBOARD_INPUT_FIELDS.length
    || !DASHBOARD_INPUT_FIELDS.every((field) => keys.includes(field))) {
    throw createInvalidDashboardInputError();
  }

  const values = {};
  for (const field of DASHBOARD_INPUT_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(input, field);
    if (descriptor === undefined || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      throw createInvalidDashboardInputError();
    }
    values[field] = descriptor.value;
  }

  if (!Array.isArray(values.notes) || !Array.isArray(values.reviews)) {
    throw createInvalidDashboardInputError();
  }

  return values;
}

function validateContext(nowIso, localDate, isoWeek) {
  isDue({
    noteId: "study-dashboard-time",
    notebookType: "vocabulary",
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: "2000-01-01T00:00:00.000Z",
    interval: 0,
    ease: 2.5,
  }, nowIso);

  const outputTemplate = createJapaneseTemplate("output", { localDate });
  const plannerTemplate = createJapaneseTemplate("planner", { isoWeek });

  return {
    currentLocalDate: outputTemplate.title,
    currentPlannerTitle: plannerTemplate.title,
  };
}

function readDataProperty(object, key) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  if (descriptor === undefined || !Object.hasOwn(descriptor, "value")) {
    return undefined;
  }
  return descriptor.value;
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

function compareText(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function addRepair(repairs, code, noteId, count = 1) {
  const normalizedNoteId = typeof noteId === "string" ? noteId : undefined;
  const key = `${code}\u0000${normalizedNoteId ?? ""}`;
  const existing = repairs.get(key);
  if (existing) {
    existing.count += count;
    return;
  }

  const repair = { code };
  if (normalizedNoteId !== undefined) {
    repair.noteId = normalizedNoteId;
  }
  repair.count = count;
  repairs.set(key, repair);
}

function buildNoteMap(notes, repairs) {
  const groups = new Map();
  let invalidCount = 0;

  for (const candidate of notes) {
    const note = readNote(candidate);
    if (!note) {
      invalidCount += 1;
      continue;
    }

    const group = groups.get(note.id) ?? [];
    group.push(note);
    groups.set(note.id, group);
  }

  if (invalidCount > 0) {
    addRepair(repairs, "invalid-note", undefined, invalidCount);
  }

  const notesById = new Map();
  for (const [noteId, group] of groups) {
    group.sort((left, right) => compareText(noteSortKey(left), noteSortKey(right)));
    notesById.set(noteId, group[0]);
    if (group.length > 1) {
      addRepair(repairs, "duplicate-note", noteId, group.length - 1);
    }
  }

  return notesById;
}

function buildReviewMap(reviews, repairs) {
  const groups = new Map();
  let invalidCount = 0;

  for (const candidate of reviews) {
    let review;
    try {
      review = validateStudyReview(candidate);
    } catch {
      invalidCount += 1;
      continue;
    }

    const group = groups.get(review.noteId) ?? [];
    group.push(review);
    groups.set(review.noteId, group);
  }

  if (invalidCount > 0) {
    addRepair(repairs, "invalid-review", undefined, invalidCount);
  }

  const reviewsByNoteId = new Map();
  for (const [noteId, group] of groups) {
    group.sort((left, right) => compareText(reviewSortKey(left), reviewSortKey(right)));
    reviewsByNoteId.set(noteId, group[0]);
    if (group.length > 1) {
      addRepair(repairs, "duplicate-review", noteId, group.length - 1);
    }
  }

  return reviewsByNoteId;
}

function daysFromCivil(year, month, day) {
  const yearValue = BigInt(year);
  const monthValue = BigInt(month);
  const dayValue = BigInt(day);
  const adjustedYear = monthValue <= 2n ? yearValue - 1n : yearValue;
  const era = adjustedYear >= 0n ? adjustedYear / 400n : (adjustedYear - 399n) / 400n;
  const yearOfEra = adjustedYear - era * 400n;
  const marchMonth = monthValue > 2n ? monthValue - 3n : monthValue + 9n;
  const dayOfYear = (153n * marchMonth + 2n) / 5n + dayValue - 1n;
  const dayOfEra = yearOfEra * 365n + yearOfEra / 4n - yearOfEra / 100n + dayOfYear;
  return era * 146097n + dayOfEra - 719468n;
}

function calendarDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  try {
    createJapaneseTemplate("output", { localDate: value });
  } catch {
    return null;
  }

  return daysFromCivil(match[1], match[2], match[3]);
}

function plannerWeekFromTitle(title) {
  const match = /^Japanese study plan — (\d{4}-W\d{2})$/.exec(title);
  if (!match) {
    return null;
  }

  try {
    createJapaneseTemplate("planner", { isoWeek: match[1] });
    return match[1];
  } catch {
    return null;
  }
}

function deriveOutputStreak(outputDays, currentLocalDate) {
  const currentDay = calendarDay(currentLocalDate);
  let streak = 0;

  while (outputDays.has(currentDay - BigInt(streak))) {
    streak += 1;
  }

  return streak;
}

function derivePlannerProgress(candidates, repairs) {
  if (candidates.length === 0) {
    return { completed: 0, total: 0 };
  }

  candidates.sort((left, right) => compareText(left.id, right.id));
  for (const duplicate of candidates.slice(1)) {
    addRepair(repairs, "duplicate-current-planner", duplicate.id);
  }

  const taskNodes = parseDocument(candidates[0].content).ast.filter((node) => node.type === "task");
  return {
    completed: taskNodes.filter((node) => node.checked).length,
    total: taskNodes.length,
  };
}

function finalizeRepairs(repairs) {
  const ordered = [...repairs.values()].sort((left, right) => {
    const byCode = compareText(left.code, right.code);
    if (byCode !== 0) {
      return byCode;
    }
    return compareText(left.noteId ?? "", right.noteId ?? "");
  });
  const needsRepair = ordered.slice(0, STUDY_DASHBOARD_REPAIR_LIMIT).map((repair) => ({ ...repair }));

  return {
    needsRepair,
    needsRepairOmitted: Math.max(0, ordered.length - needsRepair.length),
  };
}

export function deriveStudyDashboard(input) {
  try {
    const {
      notes,
      reviews,
      nowIso,
      localDate,
      isoWeek,
    } = readExactInput(input);
    const {
      currentLocalDate,
      currentPlannerTitle,
    } = validateContext(nowIso, localDate, isoWeek);

    const repairs = new Map();
    const notesById = buildNoteMap(notes, repairs);
    const reviewsByNoteId = buildReviewMap(reviews, repairs);
    const outputDays = new Set();
    const outputDateOwners = new Map();
    const currentPlannerCandidates = [];

    let dueCount = 0;
    let newVocabulary = 0;
    let dueKanji = 0;
    let grammarTotal = 0;

    const orderedReviews = [...reviewsByNoteId.values()]
      .sort((left, right) => compareText(left.noteId, right.noteId));

    for (const review of orderedReviews) {
      const note = notesById.get(review.noteId);
      if (!note) {
        addRepair(repairs, "orphan-review", review.noteId);
        continue;
      }
      if (note.archived) {
        addRepair(repairs, "archived-note", review.noteId);
        continue;
      }

      const due = isDue(review, nowIso);
      if (due) {
        dueCount += 1;
      }
      if (review.notebookType === "vocabulary" && review.status === "new") {
        newVocabulary += 1;
      }
      if (review.notebookType === "kanji" && due) {
        dueKanji += 1;
      }
      if (review.notebookType === "grammar") {
        grammarTotal += 1;
      }

      if (review.notebookType === "output") {
        const day = calendarDay(note.title);
        if (day === null) {
          addRepair(repairs, "invalid-output-title", note.id);
        } else {
          outputDays.add(day);
          const owners = outputDateOwners.get(note.title) ?? [];
          owners.push(note.id);
          outputDateOwners.set(note.title, owners);
        }
      }

      if (review.notebookType === "planner") {
        const week = plannerWeekFromTitle(note.title);
        if (week === null) {
          addRepair(repairs, "invalid-planner-title", note.id);
        } else if (note.title === currentPlannerTitle) {
          currentPlannerCandidates.push(note);
        }
      }
    }

    for (const owners of outputDateOwners.values()) {
      owners.sort(compareText);
      for (const duplicateNoteId of owners.slice(1)) {
        addRepair(repairs, "duplicate-output-date", duplicateNoteId);
      }
    }

    const plannerProgress = derivePlannerProgress(currentPlannerCandidates, repairs);
    const repairResult = finalizeRepairs(repairs);

    return {
      dueCount,
      newVocabulary,
      dueKanji,
      grammarTotal,
      outputStreak: deriveOutputStreak(outputDays, currentLocalDate),
      plannerProgress,
      ...repairResult,
    };
  } catch (error) {
    if (error?.code === "INVALID_STUDY_DASHBOARD_INPUT") {
      throw error;
    }
    throw createInvalidDashboardInputError();
  }
}
