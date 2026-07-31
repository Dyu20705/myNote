import { getActiveStore } from "../core/state.js";
import { registerPaletteCommands } from "./palette.js";

const store = getActiveStore();
const notesButton = document.querySelector("#notesWorkspaceButton");
const japaneseButton = document.querySelector("#japaneseWorkspaceButton");
const searchInput = document.querySelector("#searchInput");
const quickCreateButtons = [...document.querySelectorAll("[data-japanese-template]")];

const disabledCreateCommands = [
  ["vocabulary", "Create vocabulary note"],
  ["kanji", "Create kanji note"],
  ["grammar", "Create grammar note"],
  ["output", "Create today’s output note"],
  ["planner", "Create this week’s planner"],
].map(([type, title]) => ({
  id: `japanese-create-${type}`,
  title,
  run: () => false,
}));

let studyDataUnavailable = false;

function degradedDashboard() {
  return {
    dueCount: 0,
    newVocabulary: 0,
    dueKanji: 0,
    grammarTotal: 0,
    outputStreak: 0,
    plannerProgress: { completed: 0, total: 0 },
    needsRepair: [],
    needsRepairOmitted: 0,
  };
}

function idleReviewSession() {
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

function refreshWorkspaceList() {
  searchInput?.dispatchEvent(new Event("input", { bubbles: true }));
}

function installDegradedState() {
  if (!store || studyDataUnavailable) {
    return;
  }

  studyDataUnavailable = true;
  for (const button of quickCreateButtons) {
    button.disabled = true;
  }

  store.setState({
    workspace: "notes",
    studyReviews: [],
    japaneseNoteIds: [],
    studyDashboard: degradedDashboard(),
    studyStatus: [{ code: "study-data-unavailable", count: 1 }],
    studyStatusOmitted: 0,
    reviewSession: idleReviewSession(),
  });
}

registerPaletteCommands(() => (studyDataUnavailable ? disabledCreateCommands : []));

window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.code !== "INVALID_STUDY_REVIEW") {
    return;
  }
  event.preventDefault();
  installDegradedState();
});

notesButton?.addEventListener("click", () => {
  if (!studyDataUnavailable || !store) {
    return;
  }
  store.setState({ workspace: "notes" });
  refreshWorkspaceList();
});

japaneseButton?.addEventListener("click", () => {
  if (!studyDataUnavailable || !store) {
    return;
  }
  store.setState({ workspace: "japanese" });
  refreshWorkspaceList();
});
