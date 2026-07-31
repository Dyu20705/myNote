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
import { createListView } from "./ui/list.js";
import { createPalette } from "./ui/palette.js";

const AUTOSAVE_DEBOUNCE = 350;
const DOUBLE_G_TIMEOUT = 450;

const els = {
  noteCount: document.getElementById("noteCount"),
  saveState: document.getElementById("saveState"),
  searchInput: document.getElementById("searchInput"),
  newNoteButton: document.getElementById("newNoteButton"),
  saveButton: document.getElementById("saveButton"),
  noteList: document.getElementById("noteList"),
  titleInput: document.getElementById("titleInput"),
  contentInput: document.getElementById("contentInput"),
  activeNoteLabel: document.getElementById("activeNoteLabel"),
  backlinksList: document.getElementById("backlinksList"),
  commandPalette: document.getElementById("commandPalette"),
  commandInput: document.getElementById("commandInput"),
  commandList: document.getElementById("commandList"),
  metricsState: document.getElementById("metricsState"),
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
  lastGAt: 0,
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
let noteWorkspace = null;
let enrolledDeleteHandler = null;

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

function renderMetrics() {
  const metrics = store.getState().metrics;
  if (!els.metricsState) {
    return;
  }
  els.metricsState.textContent = `render:${metrics.renderMs.toFixed(1)}ms search:${metrics.searchMs.toFixed(1)}ms worker:${metrics.workerMs.toFixed(1)}ms autosave:${metrics.autosaveMs.toFixed(1)}ms mem:${metrics.memoryMb.toFixed(1)}MB`;
}

function updateMetrics(patch) {
  const current = store.getState().metrics;
  store.setState({ metrics: { ...current, ...patch } });
  renderMetrics();
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
  els.activeNoteLabel.textContent = activeNote(state) ? "Editing" : state.emptyLabel || "Ready";
  els.saveState.textContent = state.dirty ? "Unsaved changes" : state.saveMessage;
}

function renderEditor() {
  const note = activeNote();
  els.titleInput.value = note?.title ?? "";
  els.contentInput.value = note?.content ?? "";
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
  onSelect(id) {
    runAction(() => setActiveNote(id));
  },
  onDelete(id) {
    if (activeNote()?.id === id) {
      runAction(() => deleteActiveNote());
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

function renderAll() {
  const state = store.getState();
  if (els.searchInput.value !== state.query) {
    els.searchInput.value = state.query;
  }
  renderTopline();
  renderEditor();
  renderList();
  renderBacklinks();
}

async function refreshSearch(options = {}) {
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
    await refreshSearch();
  },
  async updateDerivedRemove(id) {
    backlinkIndex.remove(id);
    setBacklinksFromIndex();
    renderBacklinks();
    await searchClient.remove(id);
    await refreshSearch();
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

function focusEditor() {
  els.contentInput.focus();
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

noteWorkspace = createNoteWorkspaceController({
  getState: store.getState,
  setState: store.setState,
  query: searchClient.query,
  flush: autosave.flush,
  onSearchMetrics(elapsed) {
    updateMetrics({ searchMs: elapsed, workerMs: elapsed });
  },
  onRender: renderAll,
});

async function createNote(seed = {}) {
  await autosave.flush();
  const note = createEmptyNote(seed);
  const state = store.getState();
  const previousQuery = state.query;
  const previousActiveId = state.activeId;
  const revision = bumpSaveRevision();

  await commandStack.execute({
    do: async () => {
      store.setState({ query: "" });
      await applyUpsertNote(note, {
        activeId: note.id,
        revision,
        historyOp: { op: "create", noteId: note.id, version: note.version },
      });
      focusEditor();
    },
    undo: async () => {
      store.setState({ query: previousQuery });
      await applyRemoveNote(note.id, {
        preferredActiveId: previousActiveId,
        revision: bumpSaveRevision(),
        historyOp: { op: "undo-create", noteId: note.id },
      });
    },
  });
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

const paletteCommands = [
  { id: "new", title: "New note", run: () => createNote() },
  { id: "daily", title: "Open daily note", run: () => openDailyNote() },
  { id: "search", title: "Focus search", run: () => focusSearch() },
  { id: "code", title: "Insert code block", run: () => insertCodeBlock() },
  { id: "pin", title: "Toggle pin active note", run: () => mutateActiveNote((note) => ({ ...note, pinned: !note.pinned }), "pin") },
  { id: "archive", title: "Archive active note", run: () => mutateActiveNote((note) => ({ ...note, archived: true }), "archive") },
  { id: "delete", title: "Delete active note", run: () => deleteActiveNote() },
  { id: "recent", title: "Switch recent note", run: () => switchRecentNote() },
  { id: "undo", title: "Undo last command", run: () => undoLastCommand() },
  { id: "redo", title: "Redo last command", run: () => redoLastCommand() },
  { id: "export-md", title: "Export all as Markdown", run: () => exportMarkdown() },
  { id: "export-json", title: "Export all as JSON", run: () => exportJson() },
  { id: "recovery-reset", title: "Safe mode: reset local database", run: () => resetLocalData() },
];

const palette = createPalette({
  root: els.commandPalette,
  input: els.commandInput,
  list: els.commandList,
  onRun(command) {
    runAction(() => command.run());
  },
});

function shouldHandleGlobalKey(event) {
  if (palette.isOpen()) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  return !target.matches("input, textarea");
}

els.searchInput.addEventListener("input", (event) => {
  runAction(() => refreshSearch({ query: event.target.value.trim() }));
});
els.newNoteButton.addEventListener("click", () => {
  runAction(() => createNote());
});
els.saveButton.addEventListener("click", () => {
  runAction(() => autosave.flush());
});

for (const field of [els.titleInput, els.contentInput]) {
  field.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      runAction(() => autosave.flush());
      return;
    }
    if (event.key === "Tab" && event.target === els.contentInput) {
      event.preventDefault();
      const start = els.contentInput.selectionStart;
      const end = els.contentInput.selectionEnd;
      els.contentInput.value = `${els.contentInput.value.slice(0, start)}  ${els.contentInput.value.slice(end)}`;
      els.contentInput.selectionStart = els.contentInput.selectionEnd = start + 2;
      markDirtyAndQueueSave();
    }
  });
  field.addEventListener("blur", () => {
    runAction(() => autosave.flush());
  });
}

els.titleInput.addEventListener("input", markDirtyAndQueueSave);
els.contentInput.addEventListener("input", markDirtyAndQueueSave);

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    palette.open(paletteCommands);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    runAction(() => createNote());
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
    if (shouldHandleGlobalKey(event)) {
      event.preventDefault();
      runAction(() => undoLastCommand());
    }
    return;
  }
  if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && event.shiftKey)
    || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y")) {
    if (shouldHandleGlobalKey(event)) {
      event.preventDefault();
      runAction(() => redoLastCommand());
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Tab") {
    event.preventDefault();
    runAction(() => switchRecentNote());
    return;
  }
  if (palette.isOpen() && event.key === "Escape") {
    event.preventDefault();
    palette.close();
    return;
  }
  if (!shouldHandleGlobalKey(event)) {
    return;
  }
  if (event.key === "/") {
    event.preventDefault();
    focusSearch();
    return;
  }
  if (event.key === "j") {
    event.preventDefault();
    runAction(() => moveSelection(1));
    return;
  }
  if (event.key === "k") {
    event.preventDefault();
    runAction(() => moveSelection(-1));
    return;
  }
  if (event.key === "G") {
    event.preventDefault();
    runAction(() => jumpBoundary(true));
    return;
  }
  if (event.key === "g") {
    const currentAt = Date.now();
    const state = store.getState();
    if (currentAt - state.lastGAt <= DOUBLE_G_TIMEOUT) {
      event.preventDefault();
      runAction(() => jumpBoundary(false));
      store.setState({ lastGAt: 0 });
      return;
    }
    store.setState({ lastGAt: currentAt });
  }
  if (event.key === "i") {
    event.preventDefault();
    focusEditor();
  }
  if (event.key === "Delete") {
    event.preventDefault();
    runAction(() => deleteActiveNote());
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
    history,
    searchClient,
    backlinkIndex,
    workspace: noteWorkspace,
    registerEnrolledDelete,
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
    await createNote({ title: "Untitled", content: "" });
    return;
  }
  await refreshSearch({ emptyLabel: "No notes" });
  renderMetrics();
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
