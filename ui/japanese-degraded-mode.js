import { getActiveStore } from "../core/state.js";

const notesButton = document.querySelector("#notesWorkspaceButton");
const japaneseButton = document.querySelector("#japaneseWorkspaceButton");
const searchInput = document.querySelector("#searchInput");
const quickCreateButtons = [...document.querySelectorAll("[data-japanese-template]")];

let requestedWorkspace = "notes";
let studyDataUnavailable = false;

export function isJapaneseStudyDataUnavailable() {
  return studyDataUnavailable;
}

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
  const store = getActiveStore();
  if (!store || studyDataUnavailable) {
    return;
  }

  studyDataUnavailable = true;
  for (const button of quickCreateButtons) {
    button.disabled = true;
  }

  store.setState({
    workspace: requestedWorkspace,
    studyReviews: [],
    japaneseNoteIds: [],
    studyDashboard: degradedDashboard(),
    studyStatus: [{ code: "study-data-unavailable", count: 1 }],
    studyStatusOmitted: 0,
    reviewSession: idleReviewSession(),
  });
  refreshWorkspaceList();
}

window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.code !== "INVALID_STUDY_REVIEW") {
    return;
  }
  event.preventDefault();
  installDegradedState();
});

notesButton?.addEventListener("click", () => {
  requestedWorkspace = "notes";
  const store = getActiveStore();
  if (!studyDataUnavailable || !store) {
    return;
  }
  store.setState({ workspace: requestedWorkspace });
  refreshWorkspaceList();
});

japaneseButton?.addEventListener("click", () => {
  requestedWorkspace = "japanese";
  const store = getActiveStore();
  if (!studyDataUnavailable || !store) {
    return;
  }
  store.setState({ workspace: requestedWorkspace });
  refreshWorkspaceList();
});
