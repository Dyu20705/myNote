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
import { presentJapaneseReviewState } from "./ui/statePresentation.js";

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
    && runtime.commandRegistry
    && typeof runtime.commandRegistry.register === "function"
    && typeof runtime.commandRegistry.execute === "function"
    && typeof runtime.commandRegistry.snapshot === "function"
    && typeof runtime.getCommandContext === "function"
    && typeof runtime.registerEnrolledDelete === "function"
    && typeof runtime.openNoteEditor === "function";
  if (!valid) {
    throw new TypeError("Invalid Japanese application runtime");
  }
}

function collectElements(document) {
  return {
    notesButton: document.querySelector("#notesWorkspaceButton"),
    japaneseButton: document.querySelector("#japaneseWorkspaceButton"),
    archiveButton: document.querySelector("#archiveWorkspaceButton"),
    noteNavigationTitle: document.querySelector("#noteNavigationTitle"),
    searchBox: document.querySelector(".search-box"),
    searchInput: document.querySelector("#searchInput"),
    newNoteButton: document.querySelector("#newNoteButton"),
    japaneseCreate: document.querySelector("#japaneseCreate"),
    newJapaneseNote: document.querySelector("#newJapaneseNoteButton"),
    japaneseCreateMenu: document.querySelector("#japaneseCreateMenu"),
    subviewNavigation: document.querySelector("#japaneseSubviewNavigation"),
    notesSubview: document.querySelector("#japaneseNotesSubviewButton"),
    reviewSubview: document.querySelector("#japaneseReviewSubviewButton"),
    reviewDueLabel: document.querySelector("#japaneseReviewDueLabel"),
    notesSummary: document.querySelector("#japaneseNotesSummary"),
    notesDueCount: document.querySelector("#japaneseNotesDueCount"),
    summaryReview: document.querySelector("#japaneseSummaryReviewButton"),
    availabilityStatus: document.querySelector("#japaneseAvailabilityStatus"),
    stateAnnouncement: document.querySelector("#japaneseStateAnnouncement"),
    filterTools: document.querySelector("#japaneseFilterTools"),
    filtersRoot: document.querySelector("#japaneseFilters"),
    filterToggle: document.querySelector("#japaneseFilterToggle"),
    commonFilters: [...document.querySelectorAll("[data-japanese-common-filter]")],
    filterChips: document.querySelector("#japaneseFilterChips"),
    filterDateFrom: document.querySelector("#japaneseDateFrom"),
    filterDateTo: document.querySelector("#japaneseDateTo"),
    filterNotebookType: document.querySelector("#japaneseNoteType"),
    clearFilters: document.querySelector("#clearJapaneseFilters"),
    filterStatus: document.querySelector("#japaneseFilterStatus"),
    noteList: document.querySelector("#noteList"),
    dashboard: document.querySelector("#japaneseDashboard"),
    dueCount: document.querySelector("#japaneseDueCount"),
    newVocabulary: document.querySelector("#japaneseNewVocabulary"),
    dueKanji: document.querySelector("#japaneseDueKanji"),
    grammarTotal: document.querySelector("#japaneseGrammarTotal"),
    outputStreak: document.querySelector("#japaneseOutputStreak"),
    plannerProgress: document.querySelector("#japanesePlannerProgress"),
    repairCount: document.querySelector("#japaneseRepairCount"),
    repairList: document.querySelector("#japaneseRepairList"),
    repairRegion: document.querySelector("#japaneseRepairRegion"),
    reviewOverview: document.querySelector("#japaneseReviewOverview"),
    startReview: document.querySelector("#startReviewButton"),
    reviewEntry: document.querySelector("#japaneseReviewEntryButton"),
    reviewEntryCount: document.querySelector("#japaneseReviewEntryCount"),
    reviewEntryReason: document.querySelector("#japaneseReviewEntryReason"),
    studyDetailsToggle: document.querySelector("#japaneseStudyDetailsToggle"),
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
    const code = typeof entry?.code === "string" && entry.code ? entry.code : "study-data-invalid";
    const count = Number.isFinite(entry?.count) && entry.count > 0 ? entry.count : 1;
    const current = entries.get(code);
    entries.set(code, Math.max(current || 0, count));
  }
  return [...entries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 20)
    .map(([code, count]) => ({ code, count }));
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
    commandRegistry,
    history,
    searchClient,
    backlinkIndex,
  } = runtime;
  const workspace = runtime.workspace;
  let studyDetailsOpen = false;
  let quickCreatePending = false;
  let reviewPhase = "ready";
  let lastJapaneseAnnouncementKey = "";

  function persistenceDatabase() {
    const database = store.getState().db;
    if (!database) {
      throw new Error("Local database is unavailable");
    }
    return database;
  }

  function clearJapaneseAnnouncement() {
    elements.stateAnnouncement.textContent = "";
    elements.stateAnnouncement.setAttribute("aria-live", "polite");
    lastJapaneseAnnouncementKey = "";
  }

  function announceJapanese(message, key, announce = "polite") {
    if (!message) return;
    const politeness = announce === "assertive" ? "assertive" : "polite";
    elements.stateAnnouncement.setAttribute("aria-live", politeness);
    const normalizedKey = `${politeness}:${key || message}`;
    if (normalizedKey === lastJapaneseAnnouncementKey) return;
    lastJapaneseAnnouncementKey = normalizedKey;
    elements.stateAnnouncement.textContent = message;
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
    const japanese = state.workspace === "japanese";
    const archive = state.workspace === "archive";
    const unavailable = Boolean(state.studyDataUnavailable);
    document.body.dataset.workspace = state.workspace || "notes";
    document.body.dataset.japaneseSubview = "notes";
    elements.notesButton.setAttribute("aria-pressed", String(state.workspace === "notes" || !state.workspace));
    elements.japaneseButton.setAttribute("aria-pressed", String(japanese));
    elements.archiveButton?.setAttribute("aria-pressed", String(archive));
    
    if (japanese) {
      elements.noteNavigationTitle.textContent = "Japanese Notes";
    } else if (archive) {
      elements.noteNavigationTitle.textContent = "Archive";
    } else {
      elements.noteNavigationTitle.textContent = "Notes";
    }
    
    elements.searchInput.placeholder = japanese ? "Search Japanese notes" : (archive ? "Search archive" : "Search notes");
    elements.searchBox.hidden = false;
    elements.newNoteButton.hidden = japanese;
    elements.japaneseCreate.hidden = !japanese;
    elements.subviewNavigation.hidden = true;
    elements.notesSubview.setAttribute("aria-pressed", "false");
    elements.reviewSubview.setAttribute("aria-pressed", "false");
    elements.notesSummary.hidden = true;
    elements.filterTools.hidden = !japanese;
    elements.noteList.hidden = false;
    elements.dashboard.hidden = !japanese || !studyDetailsOpen;
    elements.reviewOverview.hidden = true;
    elements.reviewEntry.hidden = !japanese;
    elements.studyDetailsToggle.hidden = !japanese;
    elements.studyDetailsToggle.setAttribute("aria-expanded", String(studyDetailsOpen));

    const unavailableMessage = unavailable && japanese
      ? "Japanese study data is unavailable. Ordinary Notes are still available."
      : "";
    elements.availabilityStatus.hidden = !unavailableMessage;
    elements.availabilityStatus.textContent = unavailableMessage;
    if (unavailableMessage) {
      announceJapanese(unavailableMessage, "study-data-unavailable");
    } else if (reviewPhase !== "rating-failed") {
      clearJapaneseAnnouncement();
    }

    const dashboard = state.studyDashboard || {
      dueCount: 0,
      newVocabulary: 0,
      dueKanji: 0,
      grammarTotal: 0,
      outputStreak: 0,
      plannerProgress: { completed: 0, total: 0 },
      needsRepair: [],
      needsRepairOmitted: 0,
    };
    elements.dueCount.textContent = String(dashboard.dueCount);
    elements.notesDueCount.textContent = String(dashboard.dueCount);
    elements.reviewDueLabel.textContent = `${dashboard.dueCount} due`;
    elements.reviewEntryCount.textContent = String(dashboard.dueCount);
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
      item.textContent = `${repair.code} ×${repair.count}`;
      return item;
    }));
    elements.repairRegion.hidden = !japanese || !studyDetailsOpen || repairs.length === 0;

    const activeSession = state.reviewSession?.status === "active";
    elements.startReview.textContent = activeSession ? "Resume review" : "Start review";
    elements.startReview.disabled = unavailable || (!activeSession && dashboard.dueCount === 0);
    elements.reviewEntry.disabled = unavailable || (!activeSession && dashboard.dueCount === 0);
    const reviewEntryReason = unavailable
      ? "Japanese study data is unavailable"
      : !activeSession && dashboard.dueCount === 0
        ? "No Japanese reviews are due"
        : activeSession
          ? "Resume the active Japanese review"
          : "Start due Japanese reviews";
    elements.reviewEntry.title = reviewEntryReason;
    elements.reviewEntryReason.textContent = reviewEntryReason;

    const quickCreateAvailability = new Map(commandRegistry
      .snapshot(runtime.getCommandContext())
      .filter((command) => command.id.startsWith("japanese.create."))
      .map((command) => [command.id, command]));
    for (const button of elements.quickCreateButtons) {
      const command = quickCreateAvailability.get(button.dataset.commandId);
      button.disabled = !command?.available;
      button.title = command?.available ? "" : command?.unavailableReason || "";
    }
    elements.newJapaneseNote.disabled = unavailable || quickCreatePending;
  }

  const filterController = createJapaneseFilterController({
    elements: {
      root: elements.filterTools,
      panel: elements.filtersRoot,
      toggle: elements.filterToggle,
      commonFilters: elements.commonFilters,
      chips: elements.filterChips,
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

  function quickCreateUnavailableReason() {
    if (store.getState().studyDataUnavailable) {
      return "Japanese study data is unavailable";
    }
    if (quickCreatePending) {
      return "Japanese note creation is already in progress";
    }
    return "";
  }

  async function runQuickCreate(type, opener) {
    quickCreatePending = true;
    elements.japaneseCreate.setAttribute("aria-busy", "true");
    elements.japaneseCreateMenu.hidden = true;
    elements.newJapaneseNote.setAttribute("aria-expanded", "false");
    renderDashboard();
    try {
      const note = await coordinator.quickCreate(type);
      runtime.openNoteEditor({ opener, mode: "create" });
      return note;
    } finally {
      quickCreatePending = false;
      elements.japaneseCreate.removeAttribute("aria-busy");
      renderDashboard();
    }
  }

  const quickCreateCommands = [
    ["vocabulary", "Create vocabulary note"],
    ["kanji", "Create kanji note"],
    ["grammar", "Create grammar note"],
    ["output", "Create today’s output note"],
    ["planner", "Create this week’s planner"],
  ].map(([type, title]) => ({
    id: `japanese.create.${type}`,
    title,
    description: `${title} from the canonical Japanese template`,
    shortcuts: [],
    scope: "shell",
    isAvailable: () => !store.getState().studyDataUnavailable && !quickCreatePending,
    unavailableReason: quickCreateUnavailableReason,
    run: (context) => runQuickCreate(type, context.opener),
  }));
  const unregisterCommands = quickCreateCommands.map((command) => commandRegistry.register(command));
  const unregisterDelete = runtime.registerEnrolledDelete(async (noteId) => {
    const state = store.getState();
    if (state.studyDataUnavailable && state.workspace === "japanese") {
      return true;
    }
    const enrolled = state.studyReviews?.some((review) => review.noteId === noteId);
    if (!enrolled) return false;
    await coordinator.deleteNote(noteId);
    return true;
  });
  const unsubscribeDashboard = store.subscribe(renderDashboard);

  elements.notesButton.addEventListener("click", () => {
    elements.japaneseCreateMenu.hidden = true;
    elements.newJapaneseNote.setAttribute("aria-expanded", "false");
    studyDetailsOpen = false;
    coordinator.switchWorkspace("notes").catch(() => undefined);
  });
  elements.japaneseButton.addEventListener("click", () => {
    studyDetailsOpen = false;
    coordinator.switchWorkspace("japanese").catch(() => undefined);
  });
  elements.archiveButton?.addEventListener("click", () => {
    elements.japaneseCreateMenu.hidden = true;
    elements.newJapaneseNote.setAttribute("aria-expanded", "false");
    studyDetailsOpen = false;
    coordinator.switchWorkspace("archive").catch(() => undefined);
  });
  elements.notesSubview.addEventListener("click", () => {
    studyDetailsOpen = false;
    renderDashboard();
  });
  elements.reviewSubview.addEventListener("click", () => {
    openReview(elements.reviewSubview).catch(() => undefined);
  });
  elements.summaryReview.addEventListener("click", () => {
    openReview(elements.summaryReview).catch(() => undefined);
  });
  elements.studyDetailsToggle.addEventListener("click", () => {
    studyDetailsOpen = !studyDetailsOpen;
    renderDashboard();
  });
  elements.newJapaneseNote.addEventListener("click", () => {
    const open = elements.japaneseCreateMenu.hidden;
    elements.japaneseCreateMenu.hidden = !open;
    elements.newJapaneseNote.setAttribute("aria-expanded", String(open));
    if (open) elements.quickCreateButtons[0]?.focus();
  });
  for (const button of elements.quickCreateButtons) {
    button.addEventListener("click", () => {
      elements.japaneseCreateMenu.hidden = true;
      elements.newJapaneseNote.setAttribute("aria-expanded", "false");
      Promise.resolve(commandRegistry.execute(
        button.dataset.commandId,
        runtime.getCommandContext({
          source: "control",
          opener: button,
          target: button,
        }),
      )).catch(() => undefined);
    });
  }
  elements.japaneseCreateMenu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      elements.japaneseCreateMenu.hidden = true;
      elements.newJapaneseNote.setAttribute("aria-expanded", "false");
      elements.newJapaneseNote.focus();
    }
  });

  let reviewOpener = elements.reviewEntry;

  function renderReview() {
    let state = store.getState();
    let session = state.reviewSession;
    while (session?.status === "active") {
      const note = state.notes.find((item) => item.id === session.currentNoteId);
      if (note && !note.archived) break;
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
      if (reviewPhase !== "rating-failed") clearJapaneseAnnouncement();
      renderDashboard(state);
      return;
    }

    const note = state.notes.find((item) => item.id === session.currentNoteId);
    const presentation = presentJapaneseReviewState({ phase: reviewPhase });
    elements.reviewProgress.textContent = `Item ${session.index + 1} of ${session.queue.length}`;
    elements.reviewNoteTitle.textContent = note.title;
    elements.reviewContent.textContent = note.content;
    if (reviewPhase === "rating-pending" || reviewPhase === "rating-failed") {
      elements.reviewStatus.textContent = presentation.message;
    } else {
      elements.reviewStatus.textContent = session.message
        || (session.revealed ? "Choose a rating" : "Content hidden until reveal");
    }
    if (reviewPhase === "rating-failed") {
      announceJapanese(presentation.message, "rating-failed", presentation.announce);
    } else if (!state.studyDataUnavailable) {
      clearJapaneseAnnouncement();
    }
  }

  async function openReview(opener = elements.reviewEntry) {
    await coordinator.ready;
    reviewOpener = opener;
    if (store.getState().reviewSession?.status !== "active") {
      actions.startReview(currentContext().nowIso);
    }
    reviewPhase = "ready";
    renderReview();
    if (!elements.reviewDialog.open) elements.reviewDialog.showModal();
    const session = store.getState().reviewSession;
    if (session?.status === "active") {
      if (session.revealed) elements.reviewRatings.querySelector("button")?.focus();
      else elements.revealReview.focus();
    } else {
      elements.closeReview.focus();
    }
  }

  async function submitRating(rating) {
    const session = store.getState().reviewSession;
    if (session?.status !== "active" || !session.currentNoteId || !session.revealed) return;
    const buttons = [...elements.reviewRatings.querySelectorAll("button")];
    const retryButton = elements.reviewRatings.querySelector(`[data-review-rating="${rating}"]`);
    let failed = false;
    reviewPhase = "rating-pending";
    renderReview();
    for (const button of buttons) button.disabled = true;
    try {
      await actions.rateReview(session.currentNoteId, rating, currentContext().nowIso);
      reviewPhase = "ready";
    } catch {
      reviewPhase = "rating-failed";
      failed = true;
    } finally {
      for (const button of buttons) button.disabled = false;
    }
    renderReview();
    if (failed) retryButton?.focus();
  }

  elements.startReview.addEventListener("click", () => {
    openReview(elements.startReview).catch(() => undefined);
  });
  elements.reviewEntry.addEventListener("click", () => {
    openReview(elements.reviewEntry).catch(() => undefined);
  });
  elements.closeReview.addEventListener("click", () => {
    elements.reviewDialog.close();
  });
  elements.reviewDialog.addEventListener("close", () => {
    reviewPhase = "ready";
    clearJapaneseAnnouncement();
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
    if (!store.getState().reviewSession?.revealed) return;
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
    openCreateMenu() {
      if (elements.newJapaneseNote.disabled) return false;
      elements.japaneseCreateMenu.hidden = false;
      elements.newJapaneseNote.setAttribute("aria-expanded", "true");
      elements.quickCreateButtons[0]?.focus();
      return true;
    },
    destroy() {
      filterController.destroy();
      for (const unregisterCommand of unregisterCommands) unregisterCommand();
      unregisterDelete();
      unregisterResultPolicy();
      unsubscribeDashboard();
      coordinator.destroy();
    },
  };
}
