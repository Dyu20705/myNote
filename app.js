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
  listNotesFromDb,
  migrateLegacyStorageIfNeeded,
  openDatabase,
  putNoteToDb,
  resetDatabase,
} from "./core/storage.js";
import { createJapaneseApp } from "./japaneseApp.js";
import { createCommandRegistry } from "./ui/commandRegistry.js";
import { createListView } from "./ui/list.js";
import { createNoteEditorOverlay } from "./ui/noteEditorOverlay.js";
import { createPalette } from "./ui/palette.js";

const AUTOSAVE_DEBOUNCE = 350;

const els = {
  noteCount: document.getElementById("noteCount"),
  saveState: document.getElementById("saveState"),
  searchInput: document.getElementById("searchInput"),
  newNoteButton: document.getElementById("newNoteButton"),
  newJapaneseNoteButton: document.getElementById("newJapaneseNoteButton"),
  refreshButton: document.getElementById("refreshButton"),
  saveButton: document.getElementById("saveButton"),
  noteList: document.getElementById("noteList"),
  titleInput: document.getElementById("titleInput"),
  contentInput: document.getElementById("contentInput"),
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
};

const store = createStore({
  db: null,
  notes: [],
  activeId: null,
  filteredIds: [],
  query: "",
  dirty: false,
  saveMessage: "Ready",
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

function renderTopline() {
  const state = store.getState();
  const count = state.notes.length;
  els.noteCount.textContent = `${count} note${count === 1 ? "" : "s"}`;
  els.activeNoteLabel.textContent = state.emptyLabel || "Ready";
  const storageUnavailable = state.saveMessage === "Storage unavailable"
    || state.saveMessage === "Safe mode: storage unavailable";
  const savePresentation = storageUnavailable
    ? { label: state.saveMessage, state: "error" }
    : state.dirty
      ? { label: "Unsaved", state: "warning" }
      : state.saveMessage === "Saved locally"
      ? { label: "Saved", state: "success" }
      : state.saveMessage === "Saved locally; search index unavailable"
        ? { label: "Saved · Search unavailable", state: "warning" }
        : { label: state.saveMessage, state: "" };
  els.saveState.textContent = savePresentation.label;
  els.saveState.dataset.state = savePresentation.state;
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
    if (!note) {
      continue;
    }
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

const listView = createListView({
  container: els.noteList,
  onSelect(id, opener) {
    runAction(async () => {
      if (await setActiveNote(id)) {
        openNoteEditor({ opener, mode: "edit" });
      }
    });
  },
  onDelete(id) {
    if (activeNote()?.id === id) {
      runAction(() => executeCommand("notes.delete", { source: "list-control" }));
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

function openNoteEditor({ opener = document.activeElement, mode = "edit" } = {}) {
  if (!activeNote() || !noteEditorOverlay) {
    return false;
  }
  noteEditorOverlay.open({ opener, mode });
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
  if (revision !== null && store.getState().saveRevision !== revision) {
    return;
  }

  const startedAt = performance.now();
  const previousNote = store.getState().notes.find((item) => item.id === note.id) ?? null;
  try {
    await noteLifecycle.upsert(note, { activeId, revision, previousNote });
    if (historyOp) {
      history.record({ ...historyOp, timestamp: now() });
    }
  } finally {
    renderTopline();
    updateMetrics({ autosaveMs: performance.now() - startedAt });
  }
}

async function applyRemoveNote(id, options = {}) {
  const { preferredActiveId = null, historyOp = null, revision = null } = options;
  if (revision !== null && store.getState().saveRevision !== revision) {
    return;
  }

  const startedAt = performance.now();
  try {
    await noteLifecycle.remove(id, { preferredActiveId, revision });
    if (historyOp) {
      history.record({ ...historyOp, timestamp: now() });
    }
  } finally {
    renderTopline();
    updateMetrics({ autosaveMs: performance.now() - startedAt });
  }
}

async function saveCurrentNote() {
  const state = store.getState();
  const note = activeNote(state);
  if (!note || !state.dirty) {
    return;
  }

  const draft = readEditorDraft();
  if (note.title === draft.title && note.content === draft.content) {
    store.setState({ dirty: false });
    renderTopline();
    return;
  }

  const next = mergeDraftIntoNote(note, draft);
  const patch = createNotePatch(note, next);
  const inversePatch = invertNotePatch(patch);
  const revision = state.saveRevision;
  await commandStack.execute({
    do: async () => {
      const current = store.getState().notes.find((item) => item.id === note.id);
      if (!current) {
        return;
      }
      const patched = normalizeNote({ ...applyNotePatch(current, patch), id: current.id });
      await applyUpsertNote(patched, {
        activeId: patched.id,
        revision,
        historyOp: { op: "edit", noteId: patched.id, version: patched.version, patch },
      });
    },
    undo: async () => {
      const current = store.getState().notes.find((item) => item.id === note.id);
      if (!current) {
        return;
      }
      const restored = normalizeNote({ ...applyNotePatch(current, inversePatch), id: current.id });
      await applyUpsertNote(restored, {
        activeId: restored.id,
        revision: bumpSaveRevision(),
        historyOp: { op: "undo-edit", noteId: restored.id, version: restored.version, patch: inversePatch },
      });
    },
  });

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
  beforeClose: () => autosave.flush(),
  fallbackFocus: () => (els.newNoteButton.hidden ? els.newJapaneseNoteButton : els.newNoteButton),
});

async function reconcileCurrentView() {
  if (reconcileInFlight) {
    return false;
  }

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
    if (restoreFocus && focusWasLost) {
      els.refreshButton.focus();
    }
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
  query: searchClient.query,
  flush: flushWorkspace,
  onSearchMetrics(elapsed) {
    updateMetrics({ searchMs: elapsed, workerMs: elapsed });
  },
  onRender: renderWorkspace,
});

async function createNote(seed = {}, options = {}) {
  await autosave.flush();
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
  if (!note) {
    return;
  }
  if (enrolledDeleteHandler && await enrolledDeleteHandler(note.id)) {
    return;
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

function triggerDownload(blob, filename) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(store.getState().notes, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, "myNote-export.json");
}

async function resetLocalData() {
  const shouldReset = window.confirm("This will clear local note data on this device. Continue?");
  if (!shouldReset) {
    return;
  }
  try {
    await resetDatabase();
    window.location.reload();
  } catch {
    store.setState({ saveMessage: "Recovery reset failed" });
    renderTopline();
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
  if (!note) {
    return;
  }
  const next = normalizeNote({ ...mutator(note), updatedAt: now(), version: note.version + 1 });
  const patch = createNotePatch(note, next);
  const inversePatch = invertNotePatch(patch);
  const revision = bumpSaveRevision();
  await commandStack.execute({
    do: async () => {
      const current = store.getState().notes.find((item) => item.id === note.id);
      if (!current) {
        return;
      }
      const patched = normalizeNote({ ...applyNotePatch(current, patch), id: current.id });
      await applyUpsertNote(patched, {
        activeId: patched.id,
        revision,
        historyOp: { op: opName, noteId: patched.id, version: patched.version, patch },
      });
    },
    undo: async () => {
      const current = store.getState().notes.find((item) => item.id === note.id);
      if (!current) {
        return;
      }
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
  if (state.recentIds.length >= 2) {
    await setActiveNote(state.recentIds[1]);
  }
}

async function undoLastCommand() {
  await autosave.flush();
  if (await commandStack.undo()) {
    await refreshSearch();
  }
}

async function redoLastCommand() {
  await autosave.flush();
  if (await commandStack.redo()) {
    await refreshSearch();
  }
}

function targetKind(target) {
  if (!(target instanceof HTMLElement)) {
    return "other";
  }
  if (target.isContentEditable) {
    return "contenteditable";
  }
  if (target.matches("textarea")) {
    return "textarea";
  }
  if (target.matches("select")) {
    return "select";
  }
  if (target.matches("input")) {
    return "input";
  }
  if (target.matches("button")) {
    return "button";
  }
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

const unregisterApplicationCommands = [
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
    isAvailable: () => Boolean(activeNote()),
    unavailableReason: () => "No active note to archive",
    run: () => mutateActiveNote((note) => ({ ...note, archived: true }), "archive"),
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
    title: "Safe mode: reset local database",
    description: "Clear local note data after explicit confirmation",
    run: () => resetLocalData(),
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
  if (asynchronous || outcome.handled) {
    event.preventDefault();
  }
  if (asynchronous) {
    outcome.catch(() => undefined);
  }
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
    if (memory) {
      updateMetrics({ memoryMb: memory.usedJSHeapSize / (1024 * 1024) });
    }
  }, 6000);
}

function registerEnrolledDelete(handler) {
  if (typeof handler !== "function" || enrolledDeleteHandler) {
    throw new TypeError("Invalid enrolled delete handler");
  }
  enrolledDeleteHandler = handler;
  return () => {
    if (enrolledDeleteHandler === handler) {
      enrolledDeleteHandler = null;
    }
  };
}

createJapaneseApp({
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
  const loaded = (await listNotesFromDb(db))
    .map(normalizeNote)
    .filter(Boolean)
    .sort(sortByUpdatedAtDesc);
  store.setState({
    db,
    notes: loaded,
    activeId: loaded[0]?.id ?? null,
    saveMessage: "Saved locally",
    recentIds: loaded[0]?.id ? [loaded[0].id] : [],
  });

  await searchClient.rebuild(loaded);
  backlinkIndex.rebuild(loaded);
  setBacklinksFromIndex();
  if (loaded.length === 0) {
    await createNote({ title: "Untitled", content: "" }, { openEditor: false });
    return;
  }
  await refreshSearch({ emptyLabel: "No notes" });
}

bootstrap().catch(() => {
  store.setState({ saveMessage: "Safe mode: storage unavailable" });
  renderTopline();
  window.setTimeout(() => {
    const shouldRecover = window.confirm(
      "myNote failed to initialize local storage. Do you want to reset local database and restart in safe mode?"
    );
    if (shouldRecover) {
      runAction(() => resetLocalData());
    }
  }, 50);
});

export const commandRuntime = Object.freeze({
  registry: commandRegistry,
  execute: executeCommand,
  snapshot: () => commandRegistry.snapshot(commandContext()),
  destroy() {
    for (const unregister of unregisterApplicationCommands) {
      unregister();
    }
    palette.destroy();
    noteEditorOverlay.destroy();
    commandRegistry.destroy();
  },
});
