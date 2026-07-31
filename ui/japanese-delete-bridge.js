import { getActiveBacklinkIndex } from "../core/backlinks.js";
import { getActiveCommandStack } from "../core/commandStack.js";
import { getActiveHistory } from "../core/history.js";
import { createJapaneseActions } from "../core/japaneseActions.js";
import { getActiveSearchClient } from "../core/searchClient.js";
import { getActiveStore } from "../core/state.js";
import {
  deleteNoteFromDb,
  deleteNoteWithReviewFromDb,
  putJapaneseNoteWithReviewToDb,
  putNoteToDb,
  putStudyReviewToDb,
  restoreNoteWithReviewToDb,
} from "../core/storage.js";
import { registerPaletteCommands } from "./palette.js";

const store = getActiveStore();
const commandStack = getActiveCommandStack();
const history = getActiveHistory();
const searchClient = getActiveSearchClient();
const backlinkIndex = getActiveBacklinkIndex();
const searchInput = document.querySelector("#searchInput");
const reviewDialog = document.querySelector("#reviewDialog");
const startReviewButton = document.querySelector("#startReviewButton");
const japaneseWorkspaceButton = document.querySelector("#japaneseWorkspaceButton");

function pad(value) {
  return String(value).padStart(2, "0");
}

function currentContext() {
  const date = new Date();
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const weekYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86_400_000) + 1) / 7);

  return {
    nowIso: date.toISOString(),
    localDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    isoWeek: `${weekYear}-W${pad(week)}`,
  };
}

function database() {
  const db = store?.getState().db;
  if (!db) {
    throw new Error("Local database is unavailable");
  }
  return db;
}

function isEnrolledActiveNote() {
  if (!store) {
    return false;
  }
  const state = store.getState();
  return typeof state.activeId === "string"
    && state.studyReviews?.some((review) => review.noteId === state.activeId);
}

function refreshSharedSearch() {
  searchInput.dispatchEvent(new Event("input", { bubbles: true }));
}

if (store && commandStack && history && searchClient && backlinkIndex && searchInput) {
  const actions = createJapaneseActions({
    getState: store.getState,
    setState: store.setState,
    commandStack,
    persist: {
      createPair(note, review) {
        return putJapaneseNoteWithReviewToDb(database(), note, review);
      },
      deleteWithReview(noteId) {
        return deleteNoteWithReviewFromDb(database(), noteId);
      },
      restorePair(note, review) {
        return restoreNoteWithReviewToDb(database(), note, review);
      },
      putReview(review) {
        return putStudyReviewToDb(database(), review);
      },
      putNote(note) {
        return putNoteToDb(database(), note);
      },
      deleteNote(noteId) {
        return deleteNoteFromDb(database(), noteId);
      },
    },
    derived: {
      async upsert(note, previousNote) {
        backlinkIndex.upsert(note, previousNote);
        store.setState({ backlinksMap: backlinkIndex.toMap() });
        await searchClient.upsert(note);
        refreshSharedSearch();
      },
      async remove(noteId) {
        backlinkIndex.remove(noteId);
        store.setState({ backlinksMap: backlinkIndex.toMap() });
        await searchClient.remove(noteId);
        refreshSharedSearch();
      },
    },
    history,
  });

  async function deleteEnrolledActiveNote() {
    const noteId = store.getState().activeId;
    if (!noteId || !isEnrolledActiveNote()) {
      return false;
    }
    await actions.deleteNote(noteId, currentContext());
    return true;
  }

  registerPaletteCommands(() => isEnrolledActiveNote()
    ? [{
      id: "delete",
      title: "Delete active note",
      run: deleteEnrolledActiveNote,
    }]
    : []);

  window.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.key !== "Delete"
      || (target instanceof HTMLElement && target.matches("input, textarea"))
      || !isEnrolledActiveNote()) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    deleteEnrolledActiveNote().catch(() => undefined);
  }, { capture: true });
}

if (reviewDialog && startReviewButton && japaneseWorkspaceButton) {
  reviewDialog.addEventListener("close", () => {
    if (startReviewButton.disabled) {
      japaneseWorkspaceButton.focus();
    }
  });
}
