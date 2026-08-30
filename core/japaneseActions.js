import {
  createJapaneseTemplate,
  findEnrolledOutputNoteId,
  findEnrolledPlannerNoteId,
} from "./japaneseTemplates.js";
import { createEmptyNote } from "./model.js";
import {
  advanceReviewSession,
  createJapaneseAppState,
  revealCurrentReview,
  selectWorkspace,
  startReviewSession,
} from "./japaneseState.js";
import { createInitialReview, rateReview as scheduleReview } from "./studyScheduler.js";

function createInvalidActionsInputError() {
  return new TypeError("Invalid Japanese actions input");
}

function clone(value) {
  return structuredClone(value);
}

function compareText(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function sortNotes(notes) {
  return [...notes].sort((left, right) => {
    const leftUpdated = typeof left.updatedAt === "string" ? left.updatedAt : "";
    const rightUpdated = typeof right.updatedAt === "string" ? right.updatedAt : "";
    const byUpdated = compareText(rightUpdated, leftUpdated);
    return byUpdated !== 0 ? byUpdated : compareText(left.id, right.id);
  });
}

function readDependencies(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw createInvalidActionsInputError();
  }

  const {
    getState,
    setState,
    commandStack,
    persist,
    derived,
    history,
    createNote = createEmptyNote,
  } = input;
  if (typeof getState !== "function" || typeof setState !== "function"
    || typeof commandStack?.execute !== "function"
    || typeof persist?.createPair !== "function"
    || typeof persist?.deleteWithReview !== "function"
    || typeof persist?.restorePair !== "function"
    || typeof persist?.putReview !== "function"
    || typeof persist?.putNote !== "function"
    || typeof persist?.deleteNote !== "function"
    || typeof derived?.upsert !== "function"
    || typeof derived?.remove !== "function"
    || typeof history?.record !== "function"
    || typeof createNote !== "function") {
    throw createInvalidActionsInputError();
  }

  return { getState, setState, commandStack, persist, derived, history, createNote };
}

function contextFrom(state, supplied = {}) {
  const context = {
    nowIso: supplied.nowIso ?? state.studyContext?.nowIso,
    localDate: supplied.localDate ?? state.studyContext?.localDate,
    isoWeek: supplied.isoWeek ?? state.studyContext?.isoWeek,
  };
  if (typeof context.nowIso !== "string"
    || typeof context.localDate !== "string"
    || typeof context.isoWeek !== "string") {
    throw createInvalidActionsInputError();
  }
  return context;
}

function addVisibleStatus(state, code, noteId) {
  const entry = noteId === undefined
    ? { code, count: 1 }
    : { code, noteId, count: 1 };
  const current = Array.isArray(state.studyStatus) ? state.studyStatus : [];
  const key = `${code}\u0000${noteId ?? ""}`;
  const status = [];
  let merged = false;
  for (const item of current) {
    const itemKey = `${item.code}\u0000${item.noteId ?? ""}`;
    if (itemKey === key) {
      status.push({ ...item, count: item.count + 1 });
      merged = true;
    } else {
      status.push({ ...item });
    }
  }
  if (!merged) {
    status.push(entry);
  }
  status.sort((left, right) => {
    const byCode = compareText(left.code, right.code);
    return byCode !== 0 ? byCode : compareText(left.noteId ?? "", right.noteId ?? "");
  });
  return {
    ...state,
    studyStatus: status.slice(0, 20),
    studyStatusOmitted: (state.studyStatusOmitted ?? 0) + Math.max(0, status.length - 20),
  };
}

export function createJapaneseActions(input) {
  const {
    getState,
    setState,
    commandStack,
    persist,
    derived,
    history,
    createNote,
  } = readDependencies(input);

  function buildCommittedState(notes, reviews, context, options = {}) {
    const current = getState();
    const derivedState = createJapaneseAppState({
      notes,
      reviews,
      nowIso: context.nowIso,
      localDate: context.localDate,
      isoWeek: context.isoWeek,
    });
    return {
      notes: clone(sortNotes(notes)),
      workspace: options.workspace ?? current.workspace ?? derivedState.workspace,
      studyReviews: derivedState.studyReviews,
      japaneseNoteIds: derivedState.japaneseNoteIds,
      studyDashboard: derivedState.studyDashboard,
      studyStatus: derivedState.studyStatus,
      studyStatusOmitted: derivedState.studyStatusOmitted,
      studyContext: derivedState.studyContext,
      reviewSession: options.reviewSession ?? current.reviewSession ?? derivedState.reviewSession,
      activeId: options.activeId === undefined ? current.activeId : options.activeId,
    };
  }

  function commitData(notes, reviews, context, options = {}) {
    return setState(buildCommittedState(notes, reviews, context, options));
  }

  async function updateDerived(kind, note, previousNote = null) {
    try {
      if (kind === "upsert") {
        await derived.upsert(note, previousNote);
      } else {
        await derived.remove(note);
      }
    } catch {
      setState((state) => addVisibleStatus(state, "derived-index-unavailable"));
    }
  }

  function record(op, noteId, extra = {}) {
    history.record({ op, noteId, ...extra });
  }

  async function bootstrap({ db, notes, reviews, nowIso, localDate, isoWeek }) {
    const context = { nowIso, localDate, isoWeek };
    const base = createJapaneseAppState({ notes, reviews, ...context });
    setState({
      db,
      notes: clone(sortNotes(notes)),
      activeId: notes[0]?.id ?? null,
      workspace: "notes",
      studyReviews: base.studyReviews,
      japaneseNoteIds: base.japaneseNoteIds,
      studyDashboard: base.studyDashboard,
      studyStatus: base.studyStatus,
      studyStatusOmitted: base.studyStatusOmitted,
      studyContext: base.studyContext,
      reviewSession: base.reviewSession,
    });
    return getState();
  }

  function findExistingTemplate(type, context) {
    const state = getState();
    if (type === "output") {
      const noteId = findEnrolledOutputNoteId({
        notes: state.notes,
        reviews: state.studyReviews,
        localDate: context.localDate,
      });
      return noteId ? state.notes.find((note) => note.id === noteId) : undefined;
    }
    if (type === "planner") {
      const noteId = findEnrolledPlannerNoteId({
        notes: state.notes,
        reviews: state.studyReviews,
        isoWeek: context.isoWeek,
      });
      return noteId ? state.notes.find((note) => note.id === noteId) : undefined;
    }
    return undefined;
  }

  async function createJapaneseNote(type, options = {}, suppliedContext = {}) {
    const state = getState();
    const context = contextFrom(state, suppliedContext);
    const existing = findExistingTemplate(type, context);
    if (existing) {
      setState({ activeId: existing.id });
      return existing;
    }

    const template = createJapaneseTemplate(type, options);
    const note = createNote(template);
    const review = createInitialReview({
      noteId: note.id,
      notebookType: type,
      nowIso: context.nowIso,
    });

    await commandStack.execute({
      do: async () => {
        await persist.createPair(note, review);
        const current = getState();
        commitData(
          [note, ...current.notes.filter((item) => item.id !== note.id)],
          [review, ...current.studyReviews.filter((item) => item.noteId !== note.id)],
          context,
          { activeId: note.id },
        );
        await updateDerived("upsert", note, null);
        record("create-japanese", note.id, { notebookType: type });
      },
      undo: async () => {
        await persist.deleteWithReview(note.id);
        const current = getState();
        commitData(
          current.notes.filter((item) => item.id !== note.id),
          current.studyReviews.filter((item) => item.noteId !== note.id),
          context,
          { activeId: current.notes.find((item) => item.id !== note.id)?.id ?? null },
        );
        await updateDerived("remove", note.id);
        record("undo-create-japanese", note.id, { notebookType: type });
      },
    });

    return note;
  }

  async function deleteNote(noteId, suppliedContext = {}) {
    const state = getState();
    const note = state.notes.find((item) => item.id === noteId);
    if (!note) {
      return false;
    }
    const review = state.studyReviews.find((item) => item.noteId === noteId);
    const context = contextFrom(state, suppliedContext);

    await commandStack.execute({
      do: async () => {
        if (review) {
          await persist.deleteWithReview(noteId);
        } else {
          await persist.deleteNote(noteId);
        }
        const current = getState();
        const remainingNotes = current.notes.filter((item) => item.id !== noteId);
        const remainingReviews = current.studyReviews.filter((item) => item.noteId !== noteId);
        commitData(remainingNotes, remainingReviews, context, {
          activeId: remainingNotes[0]?.id ?? null,
        });
        await updateDerived("remove", noteId);
        record("delete", noteId, review ? { notebookType: review.notebookType } : {});
      },
      undo: async () => {
        if (review) {
          await persist.restorePair(note, review);
        } else {
          await persist.putNote(note);
        }
        const current = getState();
        commitData(
          [note, ...current.notes.filter((item) => item.id !== noteId)],
          review
            ? [review, ...current.studyReviews.filter((item) => item.noteId !== noteId)]
            : current.studyReviews,
          context,
          { activeId: noteId },
        );
        await updateDerived("upsert", note, null);
        record("undo-delete", noteId, review ? { notebookType: review.notebookType } : {});
      },
    });

    return true;
  }

  async function rateReview(noteId, rating, nowIso) {
    const state = getState();
    const previous = state.studyReviews.find((item) => item.noteId === noteId);
    if (!previous) {
      throw createInvalidActionsInputError();
    }
    const next = scheduleReview(previous, rating, nowIso);

    try {
      await persist.putReview(next);
    } catch (error) {
      setState((current) => ({
        reviewSession: {
          ...current.reviewSession,
          message: "Save failed; retry rating",
          pendingRating: { noteId, rating, nowIso },
        },
      }));
      throw error;
    }

    const current = getState();
    const reviews = [next, ...current.studyReviews.filter((item) => item.noteId !== noteId)];
    const context = contextFrom(current, { nowIso });
    const committed = buildCommittedState(current.notes, reviews, context, {
      activeId: current.activeId,
      reviewSession: current.reviewSession,
    });
    const advanced = current.reviewSession?.currentNoteId === noteId
      ? advanceReviewSession(committed, "Saved")
      : committed;
    setState(advanced);
    record("rate-review", noteId, { rating });
    return next;
  }

  function chooseWorkspace(workspace) {
    setState((state) => selectWorkspace(state, workspace));
    return getState();
  }

  function startReview(nowIso, limit) {
    setState((state) => startReviewSession(state, limit !== undefined ? { nowIso, limit } : { nowIso }));
    return getState();
  }

  function revealReview() {
    setState((state) => revealCurrentReview(state));
    return getState();
  }

  return {
    bootstrap,
    chooseWorkspace,
    createJapaneseNote,
    deleteNote,
    rateReview,
    revealReview,
    startReview,
  };
}
