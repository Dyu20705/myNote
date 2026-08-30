import { createAutosave } from "./core/autosave.js";
import { createBacklinkIndex } from "./core/backlinks.js";
import { createCommandStack } from "./core/commandStack.js";
import { createHistory } from "./core/history.js";
import { createNoteLifecycle } from "./core/noteLifecycle.js";
import { createNoteWorkspaceController } from "./core/noteWorkspaceController.js";
import {
  createEmptyNote,
  normalizeNote,
  now,
  sortByUpdatedAtDesc,
  buildBlocks,
  extractInlineTags,
  extractWikiLinks,
  hashText,
} from "./core/model.js";
import { applyNotePatch, createNotePatch, invertNotePatch } from "./core/notePatch.js";
import { createSearchClient } from "./core/searchClient.js";
import { createStore } from "./core/state.js";
import {
  deleteNoteFromDb,
  exportDatabase,
  getSettings,
  listNotesFromDb,
  migrateLegacyStorageIfNeeded,
  openDatabase,
  putNoteToDb,
  putSettings,
  resetDatabase,
} from "./core/storage.js";
import { migrateV1ReviewsToV2 } from "./core/japaneseV2Storage.js";
import { BUILTIN_THEMES } from "./core/theme/themeSchema.js";
import { applyThemeTokens } from "./core/theme/themeEngine.js";
import { getTheme } from "./core/theme/themeStorage.js";
import { createJapaneseApp } from "./japaneseApp.js";
import { createCommandRegistry } from "./ui/commandRegistry.js";
import { createListView } from "./ui/list.js";
import { createNoteEditorOverlay } from "./ui/noteEditorOverlay.js";
import { createPalette } from "./ui/palette.js";
import { createThemeSwitcher } from "./ui/themeSwitcher.js";
import { createEditorToolbar } from "./ui/editorToolbar.js";
import {
  insertBold,
  insertItalic,
  insertStrikethrough,
  insertInlineCode,
  insertLink,
  cycleHeading,
  insertTaskItem,
} from "./core/markdownActions.js";
import {
  presentApplicationRecoveryState,
  presentBoardState,
  presentDerivedState,
  presentNoteState,
} from "./ui/statePresentation.js";

const AUTOSAVE_DEBOUNCE = 350;

const els = {
  noteCount: document.getElementById("noteCount"),
  saveState: document.getElementById("saveState"),
  retryNoteSaveButton: document.getElementById("retryNoteSaveButton"),
  noteStatusAnnouncement: document.getElementById("noteStatusAnnouncement"),
  boardStatusRegion: document.getElementById("boardStatusRegion"),
  boardStatusMessage: document.getElementById("boardStatusMessage"),
  searchInput: document.getElementById("searchInput"),
  newNoteButton: document.getElementById("newNoteButton"),
  newJapaneseNoteButton: document.getElementById("newJapaneseNoteButton"),
  refreshButton: document.getElementById("refreshButton"),
  saveButton: document.getElementById("saveButton"),
  noteList: document.getElementById("noteList"),
  titleInput: document.getElementById("titleInput"),
  contentInput: document.getElementById("contentInput"),
  editorToolbar: document.getElementById("editorToolbar"),
  noteEditorOverlay: document.getElementById("noteEditorOverlay"),
  noteEditorOverlayLabel: document.getElementById("noteEditorOverlayLabel"),
  closeNoteEditorButton: document.getElementById("closeNoteEditorButton"),
  pinNoteButton: document.getElementById("pinNoteButton"),
  activeNoteLabel: document.getElementById("activeNoteLabel"),
  backlinksList: document.getElementById("backlinksList"),
  commandPalette: document.getElementById("commandPalette"),
  commandInput: document.getElementById("commandInput"),
  commandList: document.getElementById("commandList"),
  reviewDialog: document.getElementById("reviewDialog"),
  themeSwitcherDialog: document.getElementById("themeSwitcherDialog"),
  closeThemeSwitcherButton: document.getElementById("closeThemeSwitcherButton"),
  themeList: document.getElementById("themeList"),
  cancelThemeSwitcherButton: document.getElementById("cancelThemeSwitcherButton"),
  applyThemeSwitcherButton: document.getElementById("applyThemeSwitcherButton"),
  applicationRecovery: document.getElementById("applicationRecovery"),
  applicationRecoveryMessage: document.getElementById("applicationRecoveryMessage"),
  retryApplicationStorageButton: document.getElementById("retryApplicationStorageButton"),
  resetApplicationDataButton: document.getElementById("resetApplicationDataButton"),
  applicationResetDialog: document.getElementById("applicationResetDialog"),
  cancelApplicationResetButton: document.getElementById("cancelApplicationResetButton"),
  confirmApplicationResetButton: document.getElementById("confirmApplicationResetButton"),
};

const store = createStore({
  db: null,
  notes: [],
  activeId: null,
  filteredIds: [],
  query: "",
  dirty: false,
  saveMessage: "Ready",
  savePhase: "idle",
  lastPersistenceFailure: "",
  emptyLabel: "Ready",
  backlinksMap: new Map(),
  saveRevision: 0,
  recentIds: [],
  metrics: {
    renderMs: 0,
    searchMs: 0,
    workerMs: 0,
    autosaveMs: 0,
    memoryMb: 0,
  },
});

const history = createHistory();
const commandStack = createCommandStack();
const searchClient = createSearchClient();
const backlinkIndex = createBacklinkIndex();
const commandRegistry = createCommandRegistry({ sequenceTimeoutMs: 450 });
let noteWorkspace = null;
let enrolledDeleteHandler = null;
let workspaceFlushDepth = 0;
let reconcileInFlight = false;
let compositionActive = false;
let palette = null;
let noteEditorOverlay = null;
let japaneseApp = null;
let lastNoteAnnouncementKey = "";
let applicationStorageUnavailable = false;
let applicationResetFailed = false;
let resetOpener = null;
let applicationStartInFlight = null;

function formatDate(iso) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function noteMap(notes) {
  return new Map(notes.map((note) => [note.id, note]));
}

function activeNote(state = store.getState()) {
  return state.notes.find((note) => note.id === state.activeId) ?? null;
}

export function getActiveNoteId() {
  return store.getState().activeId;
}

function setBacklinksFromIndex() {
  store.setState({ backlinksMap: backlinkIndex.toMap() });
}

function updateMetrics(patch) {
  const current = store.getState().metrics;
  store.setState({ metrics: { ...current, ...patch } });
}

function bumpSaveRevision() {
  const next = store.getState().saveRevision + 1;
  store.setState({ saveRevision: next });
  return next;
}

function runAction(action) {
  const result = Promise.resolve().then(action);
  result.catch(() => {});
  return result;
}

function presentationState(tone) {
  if (tone === "danger") return "error";
  return tone || "";
}

function renderNoteAnnouncement(presentation) {
  if (!els.noteStatusAnnouncement) return;
  if (presentation.announce === "off" || !presentation.message) {
    els.noteStatusAnnouncement.textContent = "";
    lastNoteAnnouncementKey = "";
    return;
  }
  const key = `${presentation.kind}:${presentation.message}`;
  if (key === lastNoteAnnouncementKey) return;
  lastNoteAnnouncementKey = key;
  els.noteStatusAnnouncement.setAttribute(
    "aria-live",
    presentation.announce === "assertive" ? "assertive" : "polite",
  );
  els.noteStatusAnnouncement.textContent = presentation.message;
}

function renderTopline() {
  const state = store.getState();
  const count = state.notes.length;
  els.noteCount.textContent = `${count} note${count === 1 ? "" : "s"}`;
  els.activeNoteLabel.textContent = state.emptyLabel || "Ready";

  const derivedUnavailable = state.saveMessage === "Saved locally; search index unavailable"
    && !state.dirty
    && state.savePhase === "idle";
  const presentation = derivedUnavailable && !state.lastPersistenceFailure
    ? presentDerivedState({ searchUnavailable: true })
    : presentNoteState({
        dirty: state.dirty,
        phase: state.savePhase,
        failureKind: state.lastPersistenceFailure,
      });

  els.saveState.textContent = presentation.message;
  els.saveState.dataset.state = presentationState(presentation.tone);
  els.retryNoteSaveButton.hidden = presentation.actionId !== "retry-save";
  renderNoteAnnouncement(presentation);

  const createFailure = state.lastPersistenceFailure === "create"
    ? presentNoteState({ dirty: false, phase: "idle", failureKind: "create" })
    : null;
  els.boardStatusRegion.hidden = !createFailure;
  els.boardStatusMessage.textContent = createFailure?.message || "";
}

function renderEditor() {
  const note = activeNote();
  els.titleInput.value = note?.title ?? "";
  els.contentInput.value = note?.content ?? "";
  const pinned = note?.pinned === true;
  els.pinNoteButton.disabled = !note;
  els.pinNoteButton.setAttribute("aria-pressed", String(pinned));
  els.pinNoteButton.setAttribute("aria-label", pinned ? "Unpin note" : "Pin note");
  els.pinNoteButton.title = pinned ? "Unpin note" : "Pin note";
}

function renderBacklinks() {
  const state = store.getState();
  const current = activeNote(state);
  els.backlinksList.replaceChildren();
  if (!current) {
    return;
  }

  const ids = [...(state.backlinksMap.get(current.id) || new Set())];
  if (ids.length === 0) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No backlinks yet";
    els.backlinksList.append(empty);
    return;
  }

  const byId = noteMap(state.notes);
  for (const id of ids) {
    const note = byId.get(id);
    if (!note) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "backlink-item";
    button.textContent = note.title;
    button.addEventListener("click", () => {
      runAction(() => setActiveNote(note.id));
    });
    els.backlinksList.append(button);
  }
}

function boardPresentation(state) {
  const japanese = state.workspace === "japanese";
  const japaneseIds = new Set(Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds : []);
  const total = japanese ? japaneseIds.size : state.notes.length;
  const visible = japanese
    ? state.filteredIds.filter((id) => japaneseIds.has(id)).length
    : state.filteredIds.length;
  return presentBoardState({ total, visible, japanese });
}

const listView = createListView({
  container: els.noteList,
  onSelect(id, opener) {
    runAction(async () => {
      if (await setActiveNote(id)) {
        openNoteEditor({ opener, mode: "edit" });
      }
    });
  },
  onEmptyAction(actionId, opener) {
    if (actionId === "create-note") {
      runAction(() => executeCommand("notes.create", {
        source: "empty-state",
        target: opener,
        opener,
      }));
      return;
    }
    if (actionId === "clear-search") {
      els.searchInput.value = "";
      runAction(() => refreshSearch({ query: "" }));
      return;
    }
    if (actionId === "create-japanese-note") {
      japaneseApp?.openCreateMenu(opener);
    }
  },
  formatDate,
});

function renderList() {
  const startedAt = performance.now();
  const state = store.getState();
  listView.render({
    notesById: noteMap(state.notes),
    orderedIds: state.filteredIds,
    activeId: state.activeId,
    query: state.query,
    emptyPresentation: boardPresentation(state),
  });
  updateMetrics({ renderMs: performance.now() - startedAt });
}

function synchronizeSearchInput() {
  const query = store.getState().query;
  if (els.searchInput.value !== query) {
    els.searchInput.value = query;
  }
}

function renderAll() {
  synchronizeSearchInput();
  renderTopline();
  renderEditor();
  renderList();
  renderBacklinks();
}

function renderWorkspace(_snapshot, context = {}) {
  synchronizeSearchInput();
  renderTopline();
  renderList();
  if (context.activeChanged) {
    renderEditor();
    renderBacklinks();
  }
}

async function refreshSearch(options = {}) {
  if (options.source === "derived" && workspaceFlushDepth > 0) {
    const state = store.getState();
    return {
      stale: true,
      query: state.query,
      ids: [...state.filteredIds],
      activeId: state.activeId,
    };
  }

  const state = store.getState();
  return noteWorkspace.refresh({
    query: Object.hasOwn(options, "query") ? options.query : state.query,
    preferredId: Object.hasOwn(options, "preferredId") ? options.preferredId : state.activeId,
    emptyLabel: options.emptyLabel || state.emptyLabel || "Ready",
    synchronizeEditor: options.synchronizeEditor === true,
  });
}

function readEditorDraft() {
  return {
    title: els.titleInput.value.trim() || "Untitled",
    content: els.contentInput.value.replace(/\r\n/g, "\n").trimEnd(),
  };
}

function mergeDraftIntoNote(note, draft) {
  const tags = [...new Set([...note.tags, ...extractInlineTags(draft.content)])];
  const links = extractWikiLinks(draft.content);
  return normalizeNote({
    ...note,
    ...draft,
    tags,
    links,
    blocks: buildBlocks(draft.content),
    updatedAt: now(),
    version: note.version + 1,
    checksum: hashText(`${draft.title}\n${draft.content}`),
  });
}

function upsertNoteInMemory(note, activeId = note.id, options = {}) {
  const { preserveEditorDraft = false } = options;
  const state = store.getState();
  const existing = state.notes.find((item) => item.id === note.id);
  const notes = existing
    ? [note, ...state.notes.filter((item) => item.id !== note.id)].sort(sortByUpdatedAtDesc)
    : [note, ...state.notes].sort(sortByUpdatedAtDesc);
  const recentIds = [activeId, ...state.recentIds.filter((item) => item !== activeId)].slice(0, 20);
  store.setState({
    notes,
    activeId,
    recentIds,
    dirty: preserveEditorDraft ? state.dirty : false,
  });

  if (preserveEditorDraft) {
    renderTopline();
    renderList();
    renderBacklinks();
  } else {
    renderAll();
  }
}

function removeNoteInMemory(id, preferredActiveId = null) {
  const state = store.getState();
  const notes = state.notes.filter((note) => note.id !== id).sort(sortByUpdatedAtDesc);
  const nextActiveId = preferredActiveId && notes.some((note) => note.id === preferredActiveId)
    ? preferredActiveId
    : notes[0]?.id ?? null;
  store.setState({
    notes,
    activeId: nextActiveId,
    recentIds: state.recentIds.filter((item) => item !== id),
    dirty: false,
  });
  renderAll();
}

const noteLifecycle = createNoteLifecycle({
  persistUpsert(note) {
    return putNoteToDb(store.getState().db, note);
  },
  persistRemove(id) {
    return deleteNoteFromDb(store.getState().db, id);
  },
  commitUpsert(note, context) {
    const preserveEditorDraft = context.revision !== null
      && store.getState().saveRevision !== context.revision;
    upsertNoteInMemory(note, context.activeId, { preserveEditorDraft });
  },
  commitRemove(id, context) {
    removeNoteInMemory(id, context.preferredActiveId);
  },
  async updateDerivedUpsert(note, context) {
    backlinkIndex.upsert(note, context.previousNote);
    setBacklinksFromIndex();
    renderBacklinks();
    await searchClient.upsert(note);
    await refreshSearch({ source: "derived" });
  },
  async updateDerivedRemove(id) {
    backlinkIndex.remove(id);
    setBacklinksFromIndex();
    renderBacklinks();
    await searchClient.remove(id);
    await refreshSearch({ source: "derived" });
  },
  onCanonicalFailure() {
    store.setState({ saveMessage: "Storage unavailable" });
  },
  onDerivedFailure() {
    store.setState({ saveMessage: "Saved locally; search index unavailable" });
  },
  onSuccess() {
    store.setState({ saveMessage: "Saved locally" });
  },
});

function classifyFailureKind(op, fallback = "edit") {
  const value = String(op || fallback);
  if (value.includes("create")) return "create";
  if (value.includes("archive")) return "archive";
  if (value.includes("pin")) return "pin";
  if (value.includes("delete") || value.includes("remove")) return "delete";
  return "edit";
}

function openNoteEditor({ opener = document.activeElement, mode = "edit" } = {}) {
  if (!activeNote() || !noteEditorOverlay) return false;
  noteEditorOverlay.open({ opener, mode });
  editorToolbar?.syncSelection();
  return true;
}

function focusEditor(opener = document.activeElement) {
  if (openNoteEditor({ opener, mode: "edit" })) {
    queueMicrotask(() => els.contentInput.focus());
  }
}

function focusSearch() {
  els.searchInput.focus();
  els.searchInput.select();
}

function markDirtyAndQueueSave() {
  bumpSaveRevision();
  store.setState({ dirty: true });
  renderTopline();
  autosave.queue();
}

async function applyUpsertNote(note, options = {}) {
  const { activeId = note.id, historyOp = null, revision = null } = options;
  if (revision !== null && store.getState().saveRevision !== revision) return;

  const startedAt = performance.now();
  const previousNote = store.getState().notes.find((item) => item.id === note.id) ?? null;
  try {
    const outcome = await noteLifecycle.upsert(note, { activeId, revision, previousNote });
    store.setState({ lastPersistenceFailure: "" });
    if (historyOp) history.record({ ...historyOp, timestamp: now() });
    return outcome;
  } catch (error) {
    store.setState({
      lastPersistenceFailure: classifyFailureKind(historyOp?.op, "edit"),
    });
    throw error;
  } finally {
    renderTopline();
    updateMetrics({ autosaveMs: performance.now() - startedAt });
  }
}

async function applyRemoveNote(id, options = {}) {
  const { preferredActiveId = null, historyOp = null, revision = null } = options;
  if (revision !== null && store.getState().saveRevision !== revision) return;

  const startedAt = performance.now();
  try {
    const outcome = await noteLifecycle.remove(id, { preferredActiveId, revision });
    store.setState({ lastPersistenceFailure: "" });
    if (historyOp) history.record({ ...historyOp, timestamp: now() });
    return outcome;
  } catch (error) {
    store.setState({
      lastPersistenceFailure: classifyFailureKind(historyOp?.op, "delete"),
    });
    throw error;
  } finally {
    renderTopline();
    updateMetrics({ autosaveMs: performance.now() - startedAt });
  }
}

async function saveCurrentNote() {
  const state = store.getState();
  const note = activeNote(state);
  if (!note || !state.dirty) return;

  const draft = readEditorDraft();
  if (note.title === draft.title && note.content === draft.content) {
    store.setState({ dirty: false, lastPersistenceFailure: "" });
    renderTopline();
    return;
  }

  const next = mergeDraftIntoNote(note, draft);
  const patch = createNotePatch(note, next);
  const inversePatch = invertNotePatch(patch);
  const revision = state.saveRevision;
  store.setState({ savePhase: "saving", lastPersistenceFailure: "" });
  renderTopline();
  try {
    await commandStack.execute({
      do: async () => {
        const current = store.getState().notes.find((item) => item.id === note.id);
        if (!current) return;
        const patched = normalizeNote({ ...applyNotePatch(current, patch), id: current.id });
        await applyUpsertNote(patched, {
          activeId: patched.id,
          revision,
          historyOp: { op: "edit", noteId: patched.id, version: patched.version, patch },
        });
      },
      undo: async () => {
        const current = store.getState().notes.find((item) => item.id === note.id);
        if (!current) return;
        const restored = normalizeNote({ ...applyNotePatch(current, inversePatch), id: current.id });
        await applyUpsertNote(restored, {
          activeId: restored.id,
          revision: bumpSaveRevision(),
          historyOp: { op: "undo-edit", noteId: restored.id, version: restored.version, patch: inversePatch },
        });
      },
    });
  } finally {
    store.setState({ savePhase: "idle" });
    renderTopline();
  }

  if (next.version % 10 === 0) {
    const notes = store.getState().notes;
    history.snapshot({
      notes: notes.map((item) => ({ id: item.id, version: item.version, updatedAt: item.updatedAt })),
    });
  }
}

const autosave = createAutosave({
  delayMs: AUTOSAVE_DEBOUNCE,
  onSave: saveCurrentNote,
});

noteEditorOverlay = createNoteEditorOverlay({
  dialog: els.noteEditorOverlay,
  closeButton: els.closeNoteEditorButton,
  modeLabel: els.noteEditorOverlayLabel,
  titleInput: els.titleInput,
  board: els.noteList,
  beforeClose: () => {
    editorToolbar?.hide();
    return autosave.flush();
  },
  fallbackFocus: () => (els.newNoteButton.hidden ? els.newJapaneseNoteButton : els.newNoteButton),
});

async function reconcileCurrentView() {
  if (reconcileInFlight) return false;
  const restoreFocus = document.activeElement === els.refreshButton;
  reconcileInFlight = true;
  els.refreshButton.disabled = true;
  els.refreshButton.setAttribute("aria-busy", "true");
  try {
    await autosave.flush();
    await refreshSearch();
    return true;
  } finally {
    reconcileInFlight = false;
    els.refreshButton.disabled = false;
    els.refreshButton.removeAttribute("aria-busy");
    const focusWasLost = document.activeElement === document.body
      || document.activeElement === null;
    if (restoreFocus && focusWasLost) els.refreshButton.focus();
  }
}

async function flushWorkspace() {
  const canonicalChanged = store.getState().dirty;
  workspaceFlushDepth += 1;
  try {
    await autosave.flush();
    return canonicalChanged;
  } finally {
    workspaceFlushDepth -= 1;
  }
}

noteWorkspace = createNoteWorkspaceController({
  getState: store.getState,
  setState: store.setState,
  query: (queryText) => {
    const workspace = store.getState().workspace || document.body.dataset.workspace || "notes";
    if (workspace === "archive") {
      return searchClient.query(`is:archived ${queryText}`.trim());
    }
    return searchClient.query(queryText);
  },
  flush: flushWorkspace,
  onSearchMetrics(elapsed) {
    updateMetrics({ searchMs: elapsed, workerMs: elapsed });
  },
  onRender: renderWorkspace,
});

async function createNote(seed = {}, options = {}) {
  await autosave.flush();
  store.setState({ lastPersistenceFailure: "" });
  renderTopline();
  const note = createEmptyNote(seed);
  const state = store.getState();
  const previousActiveId = state.activeId;
  const revision = bumpSaveRevision();

  await commandStack.execute({
    do: async () => {
      await applyUpsertNote(note, {
        activeId: note.id,
        revision,
        historyOp: { op: "create", noteId: note.id, version: note.version },
      });
    },
    undo: async () => {
      await applyRemoveNote(note.id, {
        preferredActiveId: previousActiveId,
        revision: bumpSaveRevision(),
        historyOp: { op: "undo-create", noteId: note.id },
      });
    },
  });
  if (options.openEditor !== false) {
    openNoteEditor({ opener: options.opener, mode: "create" });
  }
  return note;
}

async function deleteActiveNote() {
  await autosave.flush();
  const note = activeNote();
  if (!note) return;
  store.setState({ lastPersistenceFailure: "" });
  renderTopline();

  if (enrolledDeleteHandler) {
    try {
      if (await enrolledDeleteHandler(note.id)) {
        store.setState({ lastPersistenceFailure: "" });
        renderTopline();
        return;
      }
    } catch (error) {
      store.setState({ lastPersistenceFailure: "delete" });
      renderTopline();
      throw error;
    }
  }

  const state = store.getState();
  const nextNote = state.notes.find((candidate) => candidate.id !== note.id);
  const preferredActiveId = nextNote?.id ?? null;
  const revision = bumpSaveRevision();
  await commandStack.execute({
    do: async () => {
      await applyRemoveNote(note.id, {
        preferredActiveId,
        revision,
        historyOp: { op: "delete", noteId: note.id, version: note.version },
      });
    },
    undo: async () => {
      await applyUpsertNote(note, {
        activeId: note.id,
        revision: bumpSaveRevision(),
        historyOp: { op: "undo-delete", noteId: note.id, version: note.version },
      });
    },
  });
}

function setActiveNote(id) {
  return noteWorkspace.select(id);
}

function moveSelection(step) {
  return noteWorkspace.moveSelection(step);
}

function jumpBoundary(toBottom = false) {
  return noteWorkspace.jumpBoundary(toBottom);
}

function insertCodeBlock() {
  const field = els.contentInput;
  const before = field.value.slice(0, field.selectionStart);
  const after = field.value.slice(field.selectionEnd);
  const snippet = "\n```txt\n\n```\n";
  field.value = `${before}${snippet}${after}`;
  field.selectionStart = field.selectionEnd = before.length + 8;
  field.focus();
  markDirtyAndQueueSave();
}

function handleToolbarAction(actionId) {
  const field = els.contentInput;
  if (!field) return;
  const value = field.value;
  const start = field.selectionStart ?? 0;
  const end = field.selectionEnd ?? 0;
  let result;

  switch (actionId) {
    case "bold":
      result = insertBold(value, start, end);
      break;
    case "italic":
      result = insertItalic(value, start, end);
      break;
    case "strikethrough":
      result = insertStrikethrough(value, start, end);
      break;
    case "code":
      result = insertInlineCode(value, start, end);
      break;
    case "link":
      result = insertLink(value, start, end);
      break;
    case "heading":
      result = cycleHeading(value, start);
      break;
    case "task":
      result = insertTaskItem(value, start);
      break;
    case "kanji-draw":
      executeCommand("notes.kanji-ink", {
        source: "editor-toolbar",
        target: field,
      });
      return;
    default:
      return;
  }

  if (result) {
    field.value = result.value;
    field.selectionStart = result.selectionStart;
    field.selectionEnd = result.selectionEnd;
    field.focus();
    markDirtyAndQueueSave();
  }
}

function triggerDownload(blob, filename) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

async function exportJson() {
  const db = store.getState().db;
  const data = await exportDatabase(db);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, "myNote-export.json");
}

function openResetConfirmation(opener = document.activeElement) {
  resetOpener = opener instanceof HTMLElement ? opener : els.resetApplicationDataButton;
  if (!els.applicationResetDialog.open) els.applicationResetDialog.showModal();
  queueMicrotask(() => els.cancelApplicationResetButton.focus());
  return true;
}

function closeResetConfirmation() {
  if (els.applicationResetDialog.open) els.applicationResetDialog.close();
  if (resetOpener instanceof HTMLElement && resetOpener.isConnected) resetOpener.focus();
}

async function performResetLocalData() {
  els.confirmApplicationResetButton.disabled = true;
  els.confirmApplicationResetButton.setAttribute("aria-busy", "true");
  try {
    await resetDatabase();
    window.location.reload();
  } catch {
    applicationResetFailed = true;
    if (els.applicationResetDialog.open) els.applicationResetDialog.close();
    renderApplicationRecovery();
    els.resetApplicationDataButton.focus();
  } finally {
    els.confirmApplicationResetButton.disabled = false;
    els.confirmApplicationResetButton.removeAttribute("aria-busy");
  }
}

function exportMarkdown() {
  const output = store.getState().notes
    .map((note) => {
      const tagLine = note.tags.length ? `\nTags: ${note.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      return `# ${note.title}\n\nUpdated: ${note.updatedAt}${tagLine}\n\n${note.content}`;
    })
    .join("\n\n---\n\n");
  triggerDownload(new Blob([output], { type: "text/markdown" }), "myNote-export.md");
}

async function openDailyNote() {
  const dateId = new Date().toISOString().slice(0, 10);
  const found = store.getState().notes.find((note) => note.title === dateId);
  if (found) {
    await setActiveNote(found.id);
    openNoteEditor({ mode: "edit" });
    return;
  }
  await createNote({ title: dateId, tags: ["daily"] });
}

async function mutateActiveNote(mutator, opName) {
  await autosave.flush();
  const note = activeNote();
  if (!note) return;
  store.setState({ lastPersistenceFailure: "" });
  renderTopline();
  const next = normalizeNote({ ...mutator(note), updatedAt: now(), version: note.version + 1 });
  const patch = createNotePatch(note, next);
  const inversePatch = invertNotePatch(patch);
  const revision = bumpSaveRevision();
  await commandStack.execute({
    do: async () => {
      const current = store.getState().notes.find((item) => item.id === note.id);
      if (!current) return;
      const patched = normalizeNote({ ...applyNotePatch(current, patch), id: current.id });
      await applyUpsertNote(patched, {
        activeId: patched.id,
        revision,
        historyOp: { op: opName, noteId: patched.id, version: patched.version, patch },
      });
    },
    undo: async () => {
      const current = store.getState().notes.find((item) => item.id === note.id);
      if (!current) return;
      const restored = normalizeNote({ ...applyNotePatch(current, inversePatch), id: current.id });
      await applyUpsertNote(restored, {
        activeId: restored.id,
        revision: bumpSaveRevision(),
        historyOp: { op: `undo-${opName}`, noteId: restored.id, version: restored.version, patch: inversePatch },
      });
    },
  });
}

async function switchRecentNote() {
  const state = store.getState();
  if (state.recentIds.length >= 2) await setActiveNote(state.recentIds[1]);
}

async function undoLastCommand() {
  await autosave.flush();
  if (await commandStack.undo()) await refreshSearch();
}

async function redoLastCommand() {
  await autosave.flush();
  if (await commandStack.redo()) await refreshSearch();
}

function targetKind(target) {
  if (!(target instanceof HTMLElement)) return "other";
  if (target.isContentEditable) return "contenteditable";
  if (target.matches("textarea")) return "textarea";
  if (target.matches("select")) return "select";
  if (target.matches("input")) return "input";
  if (target.matches("button")) return "button";
  return "other";
}

function platformName() {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "darwin" : "win32";
}

function commandContext(overrides = {}) {
  const target = overrides.target instanceof EventTarget
    ? overrides.target
    : document.activeElement;
  const reviewOpen = Boolean(els.reviewDialog?.open);
  const editorOpen = Boolean(els.noteEditorOverlay?.open);
  const paletteOpen = Boolean(palette?.isOpen());
  const editorTarget = target === els.titleInput || target === els.contentInput;
  const activeScope = reviewOpen
    ? "review-modal"
    : paletteOpen
      ? "palette"
      : editorOpen || editorTarget
        ? "editor"
        : "shell";

  return {
    platform: platformName(),
    workspace: store.getState().workspace || document.body.dataset.workspace || "notes",
    activeScope,
    targetKind: targetKind(target),
    paletteOpen,
    modalScope: reviewOpen ? "review-modal" : editorOpen ? "editor" : null,
    compositionActive,
    focusToken: target instanceof HTMLElement ? target.id || activeScope : activeScope,
    opener: target instanceof HTMLElement ? target : document.activeElement,
    source: "application",
    ...overrides,
  };
}

function executeCommand(id, overrides = {}) {
  return commandRegistry.execute(id, commandContext(overrides));
}

function registerCommand(command) {
  return commandRegistry.register({
    shortcuts: [],
    scope: "shell",
    isAvailable: () => true,
    unavailableReason: () => "",
    ...command,
  });
}

palette = createPalette({
  root: els.commandPalette,
  input: els.commandInput,
  list: els.commandList,
  registry: commandRegistry,
  getContext: commandContext,
});

let themeSwitcher;
if (els.themeSwitcherDialog && els.themeList) {
  themeSwitcher = createThemeSwitcher({
    dialog: els.themeSwitcherDialog,
    listElement: els.themeList,
    closeButton: els.closeThemeSwitcherButton,
    cancelButton: els.cancelThemeSwitcherButton,
    applyButton: els.applyThemeSwitcherButton,
    dbProvider: () => store.getState().db,
    onApply: async (theme) => {
      const db = store.getState().db;
      if (db) {
        await putSettings(db, "app", {
          activeThemeId: theme.id,
          isCustomTheme: !BUILTIN_THEMES[theme.id],
        });
      }
    },
  });
}

let editorToolbar;
if (els.editorToolbar && els.contentInput) {
  editorToolbar = createEditorToolbar({
    container: els.editorToolbar,
    textarea: els.contentInput,
    onAction: handleToolbarAction,
  });
}

const unregisterApplicationCommands = [
  registerCommand({
    id: "editor.bold",
    title: "Bold text",
    description: "Wrap selection in bold markdown syntax",
    shortcuts: [{ key: "b", primaryModifier: true }],
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => handleToolbarAction("bold"),
  }),
  registerCommand({
    id: "editor.italic",
    title: "Italic text",
    description: "Wrap selection in italic markdown syntax",
    shortcuts: [{ key: "i", primaryModifier: true }],
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => handleToolbarAction("italic"),
  }),
  registerCommand({
    id: "editor.strikethrough",
    title: "Strikethrough text",
    description: "Wrap selection in strikethrough markdown syntax",
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => handleToolbarAction("strikethrough"),
  }),
  registerCommand({
    id: "editor.link",
    title: "Insert link",
    description: "Insert markdown link for selection",
    shortcuts: [{ key: "k", primaryModifier: true, shiftKey: true }],
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => handleToolbarAction("link"),
  }),
  registerCommand({
    id: "editor.heading",
    title: "Cycle heading level",
    description: "Cycle current line heading level (H1, H2, H3, paragraph)",
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => handleToolbarAction("heading"),
  }),
  registerCommand({
    id: "editor.task",
    title: "Toggle task item",
    description: "Toggle task checklist item prefix for current line",
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => handleToolbarAction("task"),
  }),
  registerCommand({
    id: "palette.open",
    title: "Open command palette",
    description: "Search available application commands",
    shortcuts: [{ key: "k", primaryModifier: true }],
    scope: "global",
    run: (context) => palette.open(context.opener),
  }),
  registerCommand({
    id: "palette.close",
    title: "Close command palette",
    description: "Close the command palette and return focus",
    shortcuts: [{ key: "Escape" }],
    scope: "palette",
    run: () => palette.close(),
  }),
  registerCommand({
    id: "theme.switch",
    title: "Switch theme",
    description: "Open the theme switcher to preview and select themes",
    run: (context) => themeSwitcher?.open(context.opener),
  }),
  registerCommand({
    id: "notes.create",
    title: "New note",
    description: "Create an ordinary note",
    shortcuts: [{ key: "n", primaryModifier: true }],
    isAvailable: (context) => context.workspace === "notes",
    unavailableReason: () => "Switch to Notes workspace to create an ordinary note",
    run: (context) => createNote({}, { opener: context.opener }),
  }),
  registerCommand({
    id: "notes.daily",
    title: "Open daily note",
    description: "Open or create today’s ordinary daily note",
    run: () => openDailyNote(),
  }),
  registerCommand({
    id: "notes.search",
    title: "Focus search",
    description: "Focus the note search field",
    shortcuts: [{ key: "/" }],
    run: () => focusSearch(),
  }),
  registerCommand({
    id: "editor.save",
    title: "Save note",
    description: "Flush the active note to local storage",
    shortcuts: [{ key: "Enter", primaryModifier: true }],
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to save",
    run: () => autosave.flush(),
  }),
  registerCommand({
    id: "editor.insert-code",
    title: "Insert code block",
    description: "Insert a fenced code block into the active editor",
    scope: "editor",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: () => insertCodeBlock(),
  }),
  registerCommand({
    id: "notes.pin",
    title: "Toggle pin active note",
    description: "Pin or unpin the selected note",
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to pin",
    run: () => mutateActiveNote((note) => ({ ...note, pinned: !note.pinned }), "pin"),
  }),
  registerCommand({
    id: "notes.archive",
    title: "Archive active note",
    description: "Archive the selected note without deleting it",
    isAvailable: () => {
      const note = activeNote();
      console.log("NOTE FOR ARCHIVE", note); return note && !note.archived;
    },
    unavailableReason: () => "No active note to archive",
    run: () => mutateActiveNote((note) => ({ ...note, archived: true }), "archive"),
  }),
  registerCommand({
    id: "notes.unarchive",
    title: "Unarchive active note",
    description: "Restore the selected note from the archive",
    isAvailable: () => {
      const note = activeNote();
      return note && note.archived;
    },
    unavailableReason: () => "No archived note is active",
    run: () => mutateActiveNote((note) => ({ ...note, archived: false }), "unarchive"),
  }),
  registerCommand({
    id: "notes.delete",
    title: "Delete active note",
    description: "Delete through the shared lifecycle boundary",
    shortcuts: [{ key: "Delete" }],
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to delete",
    run: () => deleteActiveNote(),
  }),
  registerCommand({
    id: "notes.recent",
    title: "Switch recent note",
    description: "Switch to the previously active note",
    shortcuts: [{ key: "Tab", primaryModifier: true }],
    isAvailable: () => store.getState().recentIds.length >= 2,
    unavailableReason: () => "No recent note is available",
    run: () => switchRecentNote(),
  }),
  registerCommand({
    id: "history.undo",
    title: "Undo last command",
    description: "Undo the latest application command",
    shortcuts: [{ key: "z", primaryModifier: true }],
    isAvailable: () => commandStack.canUndo(),
    unavailableReason: () => "Nothing to undo",
    run: () => undoLastCommand(),
  }),
  registerCommand({
    id: "history.redo",
    title: "Redo last command",
    description: "Redo the latest undone application command",
    shortcuts: [
      { key: "z", primaryModifier: true, shiftKey: true },
      { key: "y", primaryModifier: true },
    ],
    isAvailable: () => commandStack.canRedo(),
    unavailableReason: () => "Nothing to redo",
    run: () => redoLastCommand(),
  }),
  registerCommand({
    id: "notes.next",
    title: "Select next note",
    description: "Move to the next visible note",
    shortcuts: [{ key: "j" }],
    isAvailable: () => store.getState().filteredIds.length > 0,
    unavailableReason: () => "No visible note to select",
    run: () => moveSelection(1),
  }),
  registerCommand({
    id: "notes.previous",
    title: "Select previous note",
    description: "Move to the previous visible note",
    shortcuts: [{ key: "k" }],
    isAvailable: () => store.getState().filteredIds.length > 0,
    unavailableReason: () => "No visible note to select",
    run: () => moveSelection(-1),
  }),
  registerCommand({
    id: "notes.last",
    title: "Select last note",
    description: "Move to the last visible note",
    shortcuts: [{ key: "g", shiftKey: true }],
    isAvailable: () => store.getState().filteredIds.length > 0,
    unavailableReason: () => "No visible note to select",
    run: () => jumpBoundary(true),
  }),
  registerCommand({
    id: "notes.first",
    title: "Select first note",
    description: "Move to the first visible note",
    shortcuts: [{ sequence: ["g", "g"] }],
    isAvailable: () => store.getState().filteredIds.length > 0,
    unavailableReason: () => "No visible note to select",
    run: () => jumpBoundary(false),
  }),
  registerCommand({
    id: "editor.focus",
    title: "Focus editor",
    description: "Move focus to the note editor",
    shortcuts: [{ key: "i" }],
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to edit",
    run: (context) => focusEditor(context.opener),
  }),
  registerCommand({
    id: "export.markdown",
    title: "Export all as Markdown",
    description: "Download every note as Markdown",
    run: () => exportMarkdown(),
  }),
  registerCommand({
    id: "export.json",
    title: "Export all as JSON",
    description: "Download every note as JSON",
    run: () => exportJson(),
  }),
  registerCommand({
    id: "recovery.reset",
    title: "Reset local database",
    description: "Clear local note data after explicit confirmation",
    run: (context) => openResetConfirmation(context.opener),
  }),
];

els.searchInput.addEventListener("input", (event) => {
  const query = event.target.value.trim();
  runAction(() => refreshSearch({ query }));
});
els.newNoteButton.addEventListener("click", () => {
  runAction(() => executeCommand("notes.create", { source: "control", target: els.newNoteButton }));
});
els.refreshButton.addEventListener("click", () => {
  runAction(() => reconcileCurrentView());
});
els.saveButton.addEventListener("click", () => {
  runAction(() => executeCommand("editor.save", {
    source: "control",
    target: els.contentInput,
    activeScope: "editor",
  }));
});
els.retryNoteSaveButton.addEventListener("click", () => {
  store.setState({ lastPersistenceFailure: "" });
  renderTopline();
  runAction(() => executeCommand("editor.save", {
    source: "recovery",
    target: els.contentInput,
    activeScope: "editor",
  }));
});
els.retryApplicationStorageButton.addEventListener("click", () => {
  runAction(() => startApplication());
});
els.resetApplicationDataButton.addEventListener("click", () => {
  openResetConfirmation(els.resetApplicationDataButton);
});
els.cancelApplicationResetButton.addEventListener("click", closeResetConfirmation);
els.confirmApplicationResetButton.addEventListener("click", () => {
  runAction(() => performResetLocalData());
});
els.applicationResetDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeResetConfirmation();
});

for (const field of [els.titleInput, els.contentInput]) {
  field.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && !event.shiftKey && event.target === els.contentInput) {
      event.preventDefault();
      event.stopPropagation();
      const start = els.contentInput.selectionStart;
      const end = els.contentInput.selectionEnd;
      els.contentInput.value = `${els.contentInput.value.slice(0, start)}  ${els.contentInput.value.slice(end)}`;
      els.contentInput.selectionStart = els.contentInput.selectionEnd = start + 2;
      markDirtyAndQueueSave();
    }
  });
  field.addEventListener("blur", () => {
    commandRegistry.resetSequences();
    runAction(() => autosave.flush());
  });
}

els.titleInput.addEventListener("input", markDirtyAndQueueSave);
els.contentInput.addEventListener("input", markDirtyAndQueueSave);

function keyboardEventSnapshot(event) {
  return {
    type: "keydown",
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    repeat: event.repeat,
    isComposing: event.isComposing,
  };
}

window.addEventListener("compositionstart", (event) => {
  compositionActive = true;
  commandRegistry.dispatch({ type: "compositionstart" }, commandContext({ target: event.target }));
}, true);
window.addEventListener("compositionend", () => {
  compositionActive = false;
  commandRegistry.resetSequences();
}, true);
window.addEventListener("blur", () => commandRegistry.resetSequences());

window.addEventListener("keydown", (event) => {
  const outcome = commandRegistry.dispatch(
    keyboardEventSnapshot(event),
    commandContext({ target: event.target, source: "shortcut" }),
  );
  const asynchronous = outcome && typeof outcome.then === "function";
  if (asynchronous || outcome.handled) event.preventDefault();
  if (asynchronous) outcome.catch(() => undefined);
});

window.addEventListener("beforeunload", (event) => {
  if (store.getState().dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    commandRegistry.resetSequences();
    runAction(() => autosave.flush());
  }
});

if (typeof window !== "undefined") {
  window.setInterval(() => {
    const memory = performance.memory;
    if (memory) updateMetrics({ memoryMb: memory.usedJSHeapSize / (1024 * 1024) });
  }, 6000);
}

function registerEnrolledDelete(handler) {
  if (typeof handler !== "function" || enrolledDeleteHandler) {
    throw new TypeError("Invalid enrolled delete handler");
  }
  enrolledDeleteHandler = handler;
  return () => {
    if (enrolledDeleteHandler === handler) enrolledDeleteHandler = null;
  };
}

japaneseApp = createJapaneseApp({
  runtime: {
    store,
    commandStack,
    commandRegistry,
    getCommandContext: commandContext,
    history,
    searchClient,
    backlinkIndex,
    workspace: noteWorkspace,
    registerEnrolledDelete,
    openNoteEditor,
  },
  document,
});

async function bootstrap() {
  const db = await openDatabase();
  await migrateLegacyStorageIfNeeded(db, normalizeNote);
  await migrateV1ReviewsToV2(db);
  const loaded = (await listNotesFromDb(db))
    .map(normalizeNote)
    .filter(Boolean)
    .sort(sortByUpdatedAtDesc);
  const previousDb = store.getState().db;
  if (previousDb && previousDb !== db && typeof previousDb.close === "function") {
    previousDb.close();
  }
  store.setState({
    db,
    notes: loaded,
    activeId: loaded[0]?.id ?? null,
    filteredIds: loaded.map((note) => note.id),
    saveMessage: "Saved locally",
    savePhase: "idle",
    lastPersistenceFailure: "",
    recentIds: loaded[0]?.id ? [loaded[0].id] : [],
  });

  let searchUnavailable = false;
  try {
    await searchClient.rebuild(loaded);
  } catch {
    searchUnavailable = true;
    store.setState({ saveMessage: "Saved locally; search index unavailable" });
  }
  backlinkIndex.rebuild(loaded);
  setBacklinksFromIndex();

  try {
    const appSettings = await getSettings(db, "app");
    const activeThemeId = appSettings?.activeThemeId;
    if (activeThemeId) {
      const theme = await getTheme(db, activeThemeId);
      if (theme) {
        applyThemeTokens(theme);
      }
    }
  } catch (error) {
    console.warn("Could not restore persisted theme:", error);
  }

  if (searchUnavailable) {
    store.setState({
      filteredIds: loaded.map((note) => note.id),
      activeId: loaded[0]?.id ?? null,
      emptyLabel: "No notes",
    });
    renderAll();
    return;
  }

  await refreshSearch({
    preferredId: loaded[0]?.id ?? null,
    emptyLabel: "No notes",
    synchronizeEditor: true,
  });
}

function renderApplicationRecovery() {
  const presentation = presentApplicationRecoveryState({
    storageUnavailable: applicationStorageUnavailable,
    resetConfirmationOpen: els.applicationResetDialog.open,
    resetFailed: applicationResetFailed,
  });
  const visible = presentation.kind !== "ready" && presentation.kind !== "reset-confirmation";
  els.applicationRecovery.hidden = !visible;
  els.applicationRecoveryMessage.textContent = visible ? presentation.message : "";
}

async function startApplication() {
  if (applicationStartInFlight) return applicationStartInFlight;
  els.retryApplicationStorageButton.disabled = true;
  els.retryApplicationStorageButton.setAttribute("aria-busy", "true");
  applicationStartInFlight = (async () => {
    try {
      await bootstrap();
      applicationStorageUnavailable = false;
      applicationResetFailed = false;
    } catch {
      applicationStorageUnavailable = true;
    } finally {
      renderApplicationRecovery();
      els.retryApplicationStorageButton.disabled = false;
      els.retryApplicationStorageButton.removeAttribute("aria-busy");
      applicationStartInFlight = null;
    }
  })();
  return applicationStartInFlight;
}

renderApplicationRecovery();
runAction(() => startApplication());

export const commandRuntime = Object.freeze({
  registry: commandRegistry,
  execute: executeCommand,
  snapshot: () => commandRegistry.snapshot(commandContext()),
  destroy() {
    for (const unregister of unregisterApplicationCommands) unregister();
    japaneseApp?.destroy();
    palette.destroy();
    themeSwitcher?.destroy();
    editorToolbar?.destroy();
    noteEditorOverlay.destroy();
    commandRegistry.destroy();
  },
});
