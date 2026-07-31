import { getActiveBacklinkIndex } from "./core/backlinks.js";
import { getActiveCommandStack } from "./core/commandStack.js";
import { getActiveHistory } from "./core/history.js";
import { createJapaneseActions } from "./core/japaneseActions.js";
import { advanceReviewSession, createJapaneseAppState } from "./core/japaneseState.js";
import { getActiveSearchClient } from "./core/searchClient.js";
import { getActiveStore } from "./core/state.js";
import {
  deleteNoteFromDb,
  deleteNoteWithReviewFromDb,
  listStudyReviewsFromDb,
  putJapaneseNoteWithReviewToDb,
  putNoteToDb,
  putStudyReviewToDb,
  restoreNoteWithReviewToDb,
} from "./core/storage.js";
import { registerPaletteCommands } from "./ui/palette.js";

const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = "japanese.css";
document.head.append(stylesheet);

const store = getActiveStore();
const commandStack = getActiveCommandStack();
const history = getActiveHistory();
const searchClient = getActiveSearchClient();
const backlinkIndex = getActiveBacklinkIndex();

if (!store || !commandStack || !history || !searchClient || !backlinkIndex) {
  throw new Error("Application runtime is unavailable");
}

const elements = {
  notesButton: document.querySelector("#notesWorkspaceButton"),
  japaneseButton: document.querySelector("#japaneseWorkspaceButton"),
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
  noteList: document.querySelector("#noteList"),
  noteCount: document.querySelector("#noteCount"),
  searchInput: document.querySelector("#searchInput"),
  titleInput: document.querySelector("#titleInput"),
  contentInput: document.querySelector("#contentInput"),
  activeNoteLabel: document.querySelector("#activeNoteLabel"),
  backlinksList: document.querySelector("#backlinksList"),
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

let initialized = false;
let initializing = false;
let lastNotesReference = null;
let synchronizingSlice = false;
let reviewOpener = elements.startReview;
let readyResolve;
let readyReject;
const ready = new Promise((resolve, reject) => {
  readyResolve = resolve;
  readyReject = reject;
});

const workspaceViews = {
  notes: { query: "", activeId: null },
  japanese: { query: "", activeId: null },
};

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
      await searchClient.upsert(note);
    },
    async remove(noteId) {
      backlinkIndex.remove(noteId);
      await searchClient.remove(noteId);
    },
  },
  history,
});

const originalSearchQuery = searchClient.query.bind(searchClient);
searchClient.query = async (queryText) => {
  const ids = await originalSearchQuery(queryText);
  const state = store.getState();
  if (state.workspace !== "japanese") {
    return ids;
  }
  const allowed = new Set(state.japaneseNoteIds || []);
  return ids.filter((id) => allowed.has(id));
};

function templateOptions(type, context) {
  if (type === "output") {
    return { localDate: context.localDate };
  }
  if (type === "planner") {
    return { isoWeek: context.isoWeek };
  }
  return {};
}

function waitForListRender() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      resolve();
    };
    const observer = new MutationObserver(finish);
    observer.observe(elements.noteList, { childList: true, subtree: true });
    const timeoutId = setTimeout(finish, 300);
  });
}

async function refreshExistingWorkspace(preferredId = null) {
  const rendered = waitForListRender();
  elements.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
  await rendered;

  const state = store.getState();
  const permittedPreferred = preferredId && (state.workspace !== "japanese"
    || state.japaneseNoteIds.includes(preferredId));
  const button = permittedPreferred
    ? elements.noteList.querySelector(`.note-item[data-id="${CSS.escape(preferredId)}"]`)
    : elements.noteList.querySelector(".note-item");

  if (button) {
    if (store.getState().activeId === button.dataset.id) {
      store.setState({ activeId: null });
    }
    button.click();
    return;
  }

  elements.titleInput.value = "";
  elements.contentInput.value = "";
  elements.activeNoteLabel.textContent = state.workspace === "japanese" ? "No Japanese notes" : "No notes";
  elements.backlinksList.replaceChildren();
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

function renderDashboard(state = store.getState()) {
  if (!state.studyDashboard) {
    return;
  }

  const japanese = state.workspace === "japanese";
  document.body.dataset.workspace = japanese ? "japanese" : "notes";
  elements.notesButton.setAttribute("aria-pressed", String(!japanese));
  elements.japaneseButton.setAttribute("aria-pressed", String(japanese));
  elements.dashboard.hidden = !japanese;

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
  elements.startReview.disabled = !activeSession && dashboard.dueCount === 0;
  const noteCount = state.notes?.length || 0;
  elements.noteCount.textContent = `${noteCount} ${noteCount === 1 ? "note" : "notes"}`;
}

function synchronizeJapaneseSlice(state) {
  if (!initialized || synchronizingSlice || state.notes === lastNotesReference) {
    return;
  }
  lastNotesReference = state.notes;
  synchronizingSlice = true;
  try {
    const context = state.studyContext || currentContext();
    const slice = createJapaneseAppState({
      notes: state.notes,
      reviews: state.studyReviews || [],
      nowIso: context.nowIso,
      localDate: context.localDate,
      isoWeek: context.isoWeek,
    });
    store.setState({
      studyReviews: slice.studyReviews,
      japaneseNoteIds: slice.japaneseNoteIds,
      studyDashboard: slice.studyDashboard,
      studyStatus: slice.studyStatus,
      studyStatusOmitted: slice.studyStatusOmitted,
      studyContext: slice.studyContext,
      workspace: state.workspace,
      reviewSession: state.reviewSession,
    });
  } finally {
    synchronizingSlice = false;
  }
}

store.subscribe((state) => {
  synchronizeJapaneseSlice(state);
  renderDashboard(state);
});

async function switchWorkspace(workspace) {
  await ready;
  const state = store.getState();
  const currentWorkspace = state.workspace === "japanese" ? "japanese" : "notes";
  workspaceViews[currentWorkspace] = {
    query: elements.searchInput.value,
    activeId: state.activeId,
  };

  actions.chooseWorkspace(workspace);
  const target = workspaceViews[workspace];
  elements.searchInput.value = target.query;
  const fallbackId = workspace === "japanese"
    ? store.getState().japaneseNoteIds[0] || null
    : store.getState().notes[0]?.id || null;
  await refreshExistingWorkspace(target.activeId || fallbackId);
  const nextState = store.getState();
  workspaceViews[workspace].activeId = nextState.activeId;
  renderDashboard(nextState);
}

async function quickCreate(type) {
  await ready;
  const context = currentContext();
  const note = await actions.createJapaneseNote(type, templateOptions(type, context), context);
  actions.chooseWorkspace("japanese");
  workspaceViews.japanese.activeId = note.id;
  elements.searchInput.value = "";
  workspaceViews.japanese.query = "";
  await refreshExistingWorkspace(note.id);
  renderDashboard();
  elements.titleInput.focus();
  return note;
}

const quickCreateCommands = [
  ["vocabulary", "Create vocabulary note"],
  ["kanji", "Create kanji note"],
  ["grammar", "Create grammar note"],
  ["output", "Create today’s output note"],
  ["planner", "Create this week’s planner"],
].map(([type, title]) => ({
  id: `japanese-create-${type}`,
  title,
  run: () => quickCreate(type),
}));

registerPaletteCommands(() => quickCreateCommands);

elements.notesButton.addEventListener("click", () => {
  switchWorkspace("notes").catch(() => undefined);
});

elements.japaneseButton.addEventListener("click", () => {
  switchWorkspace("japanese").catch(() => undefined);
});

for (const button of document.querySelectorAll("[data-japanese-template]")) {
  button.addEventListener("click", () => {
    quickCreate(button.dataset.japaneseTemplate).catch(() => undefined);
  });
}

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
  await ready;
  reviewOpener = elements.startReview;
  if (store.getState().reviewSession?.status !== "active") {
    actions.startReview(currentContext().nowIso);
  }
  renderReview();
  if (!elements.reviewDialog.open) {
    elements.reviewDialog.showModal();
  }
  const state = store.getState();
  if (state.reviewSession?.status === "active") {
    if (state.reviewSession.revealed) {
      elements.reviewRatings.querySelector("button")?.focus();
    } else {
      elements.revealReview.focus();
    }
  } else {
    elements.closeReview.focus();
  }
}

elements.startReview.addEventListener("click", () => {
  openReview().catch(() => undefined);
});

elements.closeReview.addEventListener("click", () => {
  elements.reviewDialog.close();
});

elements.reviewDialog.addEventListener("close", () => {
  renderDashboard();
  reviewOpener?.focus();
});

elements.revealReview.addEventListener("click", () => {
  actions.revealReview();
  renderReview();
  elements.reviewRatings.querySelector("button")?.focus();
});

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

elements.noteList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".note-item-delete");
  if (!deleteButton) {
    return;
  }
  const noteButton = deleteButton.closest(".note-item-container")?.querySelector(".note-item");
  const noteId = noteButton?.dataset.id;
  if (!noteId || !store.getState().studyReviews?.some((review) => review.noteId === noteId)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  actions.deleteNote(noteId, currentContext())
    .then(() => refreshExistingWorkspace(store.getState().activeId))
    .catch(() => undefined);
}, true);

async function initialize(state) {
  const previousActiveId = state.activeId;
  const reviews = await listStudyReviewsFromDb(state.db);
  const context = currentContext();
  await actions.bootstrap({
    db: state.db,
    notes: state.notes,
    reviews,
    ...context,
  });
  store.setState({ activeId: previousActiveId });
  workspaceViews.notes.activeId = previousActiveId;
  workspaceViews.notes.query = state.query || "";
  lastNotesReference = store.getState().notes;
  initialized = true;
  renderDashboard();
  readyResolve();
}

function beginInitialization(state) {
  if (initialized || initializing || !state.db || !Array.isArray(state.notes)) {
    return;
  }
  initializing = true;
  initialize(state).catch((error) => {
    readyReject(error);
  }).finally(() => {
    initializing = false;
  });
}

beginInitialization(store.getState());
store.subscribe(beginInitialization);
