import { createJapaneseActions } from "./core/japaneseActions.js";
import { JapaneseNoteFilter } from "./core/japaneseFilters.js";
import { advanceReviewSession } from "./core/japaneseState.js";
import { createJapaneseWorkspaceCoordinator } from "./core/japaneseWorkspaceCoordinator.js";
import {
  deleteNoteFromDb,
  deleteNoteWithReviewFromDb,
  listStudyReviewsFromDb,
  putJapaneseNoteWithReviewToDb,
  putNoteToDb,
  putStudyReviewToDb,
  restoreNoteWithReviewToDb,
} from "./core/storage.js";
import { createJapaneseFilterController } from "./ui/japanese-filters.js";
import { registerPaletteCommands } from "./ui/palette.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function localDateOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isoWeekOf(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const year = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86_400_000) + 1) / 7);
  return `${year}-W${pad(week)}`;
}

function currentContext() {
  const date = new Date();
  return {
    nowIso: date.toISOString(),
    localDate: localDateOf(date),
    isoWeek: isoWeekOf(date),
  };
}

function validateRuntime(runtime) {
  const valid = runtime
    && runtime.store
    && runtime.commandStack
    && runtime.history
    && runtime.searchClient
    && runtime.backlinkIndex
    && runtime.workspace
    && typeof runtime.workspace.refresh === "function"
    && typeof runtime.registerEnrolledDelete === "function";
  if (!valid) {
    throw new TypeError("Invalid Japanese application runtime");
  }
}

function collectElements(document) {
  return {
    notesButton: document.querySelector("#notesWorkspaceButton"),
    japaneseButton: document.querySelector("#japaneseWorkspaceButton"),
    filtersRoot: document.querySelector("#japaneseFilters"),
    filterDateFrom: document.querySelector("#japaneseDateFrom"),
    filterDateTo: document.querySelector("#japaneseDateTo"),
    filterNotebookType: document.querySelector("#japaneseNoteType"),
    clearFilters: document.querySelector("#clearJapaneseFilters"),
    filterStatus: document.querySelector("#japaneseFilterStatus"),
    dashboard: document.querySelector("#japaneseDashboard"),
    dueCount: document.querySelector("#japaneseDueCount"),
    newVocabulary: document.querySelector("#japaneseNewVocabulary"),
    dueKanji: document.querySelector("#japaneseDueKanji"),
    grammarTotal: document.querySelector("#japaneseGrammarTotal"),
    outputStreak: document.querySelector("#japaneseOutputStreak"),
    plannerProgress: document.querySelector("#japanesePlannerProgress"),
    repairCount: document.querySelector("#japaneseRepairCount"),
    repairList: document.querySelector("#japaneseRepairList"),
    startReview: document.querySelector("#startReviewButton"),
    quickCreateButtons: [...document.querySelectorAll("[data-japanese-template]")],
    titleInput: document.querySelector("#titleInput"),
    reviewDialog: document.querySelector("#reviewDialog"),
    closeReview: document.querySelector("#closeReviewButton"),
    reviewProgress: document.querySelector("#reviewProgress"),
    reviewStatus: document.querySelector("#reviewStatus"),
    reviewNoteTitle: document.querySelector("#reviewNoteTitle"),
    reviewContent: document.querySelector("#reviewContent"),
    revealReview: document.querySelector("#revealReviewButton"),
    reviewRatings: document.querySelector("#reviewRatings"),
    reviewComplete: document.querySelector("#reviewComplete"),
  };
}

function repairEntries(state) {
  const entries = new Map();
  const sources = [
    ...(state.studyDashboard?.needsRepair || []),
    ...(state.studyStatus || []),
  ];
  for (const entry of sources) {
    const key = `${entry.code}\u0000${entry.noteId ?? ""}`;
    const current = entries.get(key);
    if (current) {
      current.count = Math.max(current.count, entry.count || 1);
    } else {
      entries.set(key, {
        code: entry.code,
        noteId: entry.noteId,
        count: entry.count || 1,
      });
    }
  }
  return [...entries.values()]
    .sort((left, right) => {
      const byCode = left.code.localeCompare(right.code);
      return byCode || String(left.noteId || "").localeCompare(String(right.noteId || ""));
    })
    .slice(0, 20);
}

export function createJapaneseApp({ runtime, document = globalThis.document }) {
  validateRuntime(runtime);
  if (!document || typeof document.querySelector !== "function") {
    throw new TypeError("Invalid Japanese application document");
  }

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "japanese.css";
  stylesheet.dataset.japaneseStylesheet = "true";
  if (!document.head.querySelector("[data-japanese-stylesheet]")) {
    document.head.append(stylesheet);
  }

  const elements = collectElements(document);
  const {
    store,
    commandStack,
    history,
    searchClient,
    backlinkIndex,
  } = runtime;
  const workspace = runtime.workspace;

  function persistenceDatabase() {
    const database = store.getState().db;
    if (!database) {
      throw new Error("Local database is unavailable");
    }
    return database;
  }

  const actions = createJapaneseActions({
    getState: store.getState,
    setState: store.setState,
    commandStack,
    persist: {
      createPair(note, review) {
        return putJapaneseNoteWithReviewToDb(persistenceDatabase(), note, review);
      },
      deleteWithReview(noteId) {
        return deleteNoteWithReviewFromDb(persistenceDatabase(), noteId);
      },
      restorePair(note, review) {
        return restoreNoteWithReviewToDb(persistenceDatabase(), note, review);
      },
      putReview(review) {
        return putStudyReviewToDb(persistenceDatabase(), review);
      },
      putNote(note) {
        return putNoteToDb(persistenceDatabase(), note);
      },
      deleteNote(noteId) {
        return deleteNoteFromDb(persistenceDatabase(), noteId);
      },
    },
    derived: {
      async upsert(note, previousNote) {
        backlinkIndex.upsert(note, previousNote);
        store.setState({ backlinksMap: backlinkIndex.toMap() });
        await searchClient.upsert(note);
      },
      async remove(noteId) {
        backlinkIndex.remove(noteId);
        store.setState({ backlinksMap: backlinkIndex.toMap() });
        await searchClient.remove(noteId);
      },
    },
    history,
  });

  const japaneseNoteFilter = new JapaneseNoteFilter({ getState: store.getState });
  const unregisterResultPolicy = searchClient.registerResultPolicy(japaneseNoteFilter);
  const coordinator = createJapaneseWorkspaceCoordinator({
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    actions,
    noteWorkspace: workspace,
    loadReviews: listStudyReviewsFromDb,
    getContext: currentContext,
  });

  function renderDashboard(state = store.getState()) {
    if (!state.studyDashboard) {
      return;
    }

    const japanese = state.workspace === "japanese";
    const unavailable = Boolean(state.studyDataUnavailable);
    document.body.dataset.workspace = japanese ? "japanese" : "notes";
    elements.notesButton.setAttribute("aria-pressed", String(!japanese));
    elements.japaneseButton.setAttribute("aria-pressed", String(japanese));
    elements.dashboard.hidden = !japanese;
    for (const button of elements.quickCreateButtons) {
      button.disabled = unavailable;
    }

    const dashboard = state.studyDashboard;
    elements.dueCount.textContent = String(dashboard.dueCount);
    elements.newVocabulary.textContent = String(dashboard.newVocabulary);
    elements.dueKanji.textContent = String(dashboard.dueKanji);
    elements.grammarTotal.textContent = String(dashboard.grammarTotal);
    elements.outputStreak.textContent = `${dashboard.outputStreak} ${dashboard.outputStreak === 1 ? "day" : "days"}`;
    elements.plannerProgress.textContent = `${dashboard.plannerProgress.completed} / ${dashboard.plannerProgress.total}`;

    const repairs = repairEntries(state);
    const omitted = (dashboard.needsRepairOmitted || 0) + (state.studyStatusOmitted || 0);
    elements.repairCount.textContent = omitted > 0
      ? `${repairs.length}+ (${omitted} omitted)`
      : String(repairs.length);
    elements.repairList.replaceChildren(...repairs.map((repair) => {
      const item = document.createElement("li");
      const target = repair.noteId ? ` · ${repair.noteId}` : "";
      item.textContent = `${repair.code}${target} ×${repair.count}`;
      return item;
    }));

    const activeSession = state.reviewSession?.status === "active";
    elements.startReview.textContent = activeSession ? "Resume review" : "Start review";
    elements.startReview.disabled = unavailable || (!activeSession && dashboard.dueCount === 0);
  }

  const filterController = createJapaneseFilterController({
    elements: {
      root: elements.filtersRoot,
      dateFrom: elements.filterDateFrom,
      dateTo: elements.filterDateTo,
      notebookType: elements.filterNotebookType,
      clear: elements.clearFilters,
      status: elements.filterStatus,
    },
    filter: japaneseNoteFilter,
    getState: store.getState,
    subscribe: store.subscribe,
    requestRefresh: coordinator.refreshCurrent,
  });

  const quickCreateCommands = [
    ["vocabulary", "Create vocabulary note"],
    ["kanji", "Create kanji note"],
    ["grammar", "Create grammar note"],
    ["output", "Create today’s output note"],
    ["planner", "Create this week’s planner"],
  ].map(([type, title]) => ({
    id: `japanese-create-${type}`,
    title,
    run: async () => {
      const note = await coordinator.quickCreate(type);
      elements.titleInput.focus();
      return note;
    },
  }));
  const unregisterCommands = registerPaletteCommands(() => (
    store.getState().studyDataUnavailable ? [] : quickCreateCommands
  ));
  const unregisterDelete = runtime.registerEnrolledDelete(async (noteId) => {
    const state = store.getState();
    if (state.studyDataUnavailable && state.workspace === "japanese") {
      return true;
    }
    const enrolled = state.studyReviews?.some((review) => review.noteId === noteId);
    if (!enrolled) {
      return false;
    }
    await coordinator.deleteNote(noteId);
    return true;
  });
  const unsubscribeDashboard = store.subscribe(renderDashboard);

  elements.notesButton.addEventListener("click", () => {
    coordinator.switchWorkspace("notes").catch(() => undefined);
  });
  elements.japaneseButton.addEventListener("click", () => {
    coordinator.switchWorkspace("japanese").catch(() => undefined);
  });
  for (const button of elements.quickCreateButtons) {
    button.addEventListener("click", () => {
      coordinator.quickCreate(button.dataset.japaneseTemplate)
        .then(() => elements.titleInput.focus())
        .catch(() => undefined);
    });
  }

  let reviewOpener = elements.startReview;

  function renderReview() {
    let state = store.getState();
    let session = state.reviewSession;
    while (session?.status === "active") {
      const note = state.notes.find((item) => item.id === session.currentNoteId);
      if (note && !note.archived) {
        break;
      }
      const message = note ? "Skipped archived note" : "Skipped missing note";
      store.setState((current) => advanceReviewSession(current, message));
      state = store.getState();
      session = state.reviewSession;
    }

    const complete = session?.status !== "active";
    elements.reviewComplete.hidden = !complete;
    elements.revealReview.hidden = complete;
    elements.reviewRatings.hidden = complete || !session.revealed;
    elements.reviewContent.hidden = complete || !session.revealed;
    if (complete) {
      elements.reviewProgress.textContent = "";
      elements.reviewStatus.textContent = "Review complete";
      elements.reviewNoteTitle.textContent = "";
      elements.reviewContent.textContent = "";
      renderDashboard(state);
      return;
    }

    const note = state.notes.find((item) => item.id === session.currentNoteId);
    elements.reviewProgress.textContent = `Item ${session.index + 1} of ${session.queue.length}`;
    elements.reviewNoteTitle.textContent = note.title;
    elements.reviewContent.textContent = note.content;
    elements.reviewStatus.textContent = session.message
      || (session.revealed ? "Choose a rating" : "Content hidden until reveal");
  }

  async function openReview() {
    await coordinator.ready;
    reviewOpener = elements.startReview;
    if (store.getState().reviewSession?.status !== "active") {
      actions.startReview(currentContext().nowIso);
    }
    renderReview();
    if (!elements.reviewDialog.open) {
      elements.reviewDialog.showModal();
    }
    const session = store.getState().reviewSession;
    if (session?.status === "active") {
      if (session.revealed) {
        elements.reviewRatings.querySelector("button")?.focus();
      } else {
        elements.revealReview.focus();
      }
    } else {
      elements.closeReview.focus();
    }
  }

  async function submitRating(rating) {
    const session = store.getState().reviewSession;
    if (session?.status !== "active" || !session.currentNoteId || !session.revealed) {
      return;
    }
    const buttons = [...elements.reviewRatings.querySelectorAll("button")];
    for (const button of buttons) {
      button.disabled = true;
    }
    try {
      await actions.rateReview(session.currentNoteId, rating, currentContext().nowIso);
    } catch {
      renderReview();
    } finally {
      for (const button of buttons) {
        button.disabled = false;
      }
    }
    renderReview();
  }

  elements.startReview.addEventListener("click", () => {
    openReview().catch(() => undefined);
  });
  elements.closeReview.addEventListener("click", () => {
    elements.reviewDialog.close();
  });
  elements.reviewDialog.addEventListener("close", () => {
    renderDashboard();
    const focusTarget = reviewOpener && !reviewOpener.disabled
      ? reviewOpener
      : elements.japaneseButton;
    focusTarget?.focus();
  });
  elements.revealReview.addEventListener("click", () => {
    actions.revealReview();
    renderReview();
    elements.reviewRatings.querySelector("button")?.focus();
  });
  for (const button of elements.reviewRatings.querySelectorAll("[data-review-rating]")) {
    button.addEventListener("click", () => {
      submitRating(button.dataset.reviewRating).catch(() => undefined);
    });
  }
  elements.reviewDialog.addEventListener("keydown", (event) => {
    if (!store.getState().reviewSession?.revealed) {
      return;
    }
    const ratings = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
    const rating = ratings[event.key];
    if (rating) {
      event.preventDefault();
      submitRating(rating).catch(() => undefined);
    }
  });

  coordinator.ready.then(() => renderDashboard()).catch(() => undefined);

  return {
    ready: coordinator.ready,
    destroy() {
      filterController.destroy();
      unregisterCommands();
      unregisterDelete();
      unregisterResultPolicy();
      unsubscribeDashboard();
      coordinator.destroy();
    },
  };
}
