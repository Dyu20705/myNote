const STORAGE_KEY = "my-note-v2";
const AUTOSAVE_DELAY = 400;

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const state = {
  notes: loadNotes(),
  activeId: null,
  query: "",
  dirty: false,
  saveTimer: 0,
  saveMessage: "Saved locally",
};

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
};

function loadNotes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeNote).filter(Boolean).sort(sortByUpdatedAtDesc);
  } catch {
    return [];
  }
}

function normalizeNote(note) {
  if (!note || typeof note !== "object") {
    return null;
  }

  const updatedAt = typeof note.updatedAt === "string" ? note.updatedAt : now();

  return {
    id: typeof note.id === "string" ? note.id : uid(),
    title: typeof note.title === "string" && note.title.trim() ? note.title.trim() : "Untitled",
    content: typeof note.content === "string" ? note.content : "",
    createdAt: typeof note.createdAt === "string" ? note.createdAt : updatedAt,
    updatedAt,
  };
}

function sortByUpdatedAtDesc(left, right) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function activeNote() {
  return state.notes.find((note) => note.id === state.activeId) ?? null;
}

function readEditor() {
  return {
    title: els.titleInput.value.trim() || "Untitled",
    content: els.contentInput.value.trimEnd(),
  };
}

function updateActiveNoteFromEditor() {
  const note = activeNote();
  if (!note) {
    return false;
  }

  const draft = readEditor();
  if (note.title === draft.title && note.content === draft.content) {
    return false;
  }

  const nextNote = {
    ...note,
    ...draft,
    updatedAt: now(),
  };

  state.notes = [nextNote, ...state.notes.filter((item) => item.id !== note.id)].sort(sortByUpdatedAtDesc);
  return true;
}

function persistNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
    state.dirty = false;
    state.saveMessage = "Saved locally";
    els.saveState.textContent = "Saved locally";
    return true;
  } catch {
    state.saveMessage = "Storage unavailable";
    els.saveState.textContent = "Storage unavailable";
    return false;
  }
}

function renderTopline() {
  const count = state.notes.length;
  els.noteCount.textContent = `${count} note${count === 1 ? "" : "s"}`;
  els.activeNoteLabel.textContent = activeNote() ? "Editing" : "Ready";
  els.saveState.textContent = state.dirty ? "Unsaved changes" : state.saveMessage;
}

function renderEditor() {
  const note = activeNote();
  els.titleInput.value = note?.title ?? "";
  els.contentInput.value = note?.content ?? "";
}

function matchesQuery(note, query) {
  if (!query) {
    return true;
  }

  return `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase());
}

function renderList() {
  const notes = state.notes.filter((note) => matchesQuery(note, state.query));
  els.noteList.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.query ? "No notes match this search." : "No notes yet. Create one to start.";
    els.noteList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const note of notes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "note-item";

    if (note.id === state.activeId) {
      button.classList.add("active");
    }

    const title = document.createElement("strong");
    title.className = "note-item-title";
    title.textContent = note.title;

    const date = document.createElement("span");
    date.className = "note-item-date";
    date.textContent = formatDate(note.updatedAt);

    const preview = document.createElement("p");
    preview.className = "note-item-preview";
    preview.textContent = note.content.trim().replace(/\s+/g, " ").slice(0, 120) || "Empty note";

    button.append(title, date, preview);
    button.addEventListener("click", () => setActiveNote(note.id));
    fragment.append(button);
  }

  els.noteList.append(fragment);
}

function renderAll() {
  renderTopline();
  renderEditor();
  renderList();
}

function saveCurrentNote() {
  window.clearTimeout(state.saveTimer);
  state.saveTimer = 0;

  if (!state.dirty && activeNote()) {
    return;
  }

  const noteUpdated = updateActiveNoteFromEditor();
  if (!noteUpdated && activeNote()) {
    state.dirty = false;
    renderTopline();
    return;
  }

  persistNotes();
  renderTopline();
  renderList();
}

function createNote() {
  saveCurrentNote();

  const timestamp = now();
  const note = {
    id: uid(),
    title: "Untitled",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  state.notes = [note, ...state.notes].sort(sortByUpdatedAtDesc);
  state.activeId = note.id;
  state.query = "";
  els.searchInput.value = "";
  state.dirty = false;

  persistNotes();
  renderAll();
  focusEditor();
}

function setActiveNote(id) {
  if (id === state.activeId) {
    return;
  }

  saveCurrentNote();
  state.activeId = id;
  state.dirty = false;
  renderEditor();
  renderTopline();
  renderList();
}

function focusEditor() {
  els.titleInput.focus();
  els.titleInput.select();
}

function queueAutosave() {
  state.dirty = true;
  els.saveState.textContent = "Unsaved changes";
  window.clearTimeout(state.saveTimer);
  state.saveTimer = window.setTimeout(saveCurrentNote, AUTOSAVE_DELAY);
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  renderList();
});

els.newNoteButton.addEventListener("click", createNote);
els.saveButton.addEventListener("click", saveCurrentNote);

for (const field of [els.titleInput, els.contentInput]) {
  field.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      saveCurrentNote();
    }
  });
}

els.titleInput.addEventListener("input", queueAutosave);
els.contentInput.addEventListener("input", queueAutosave);

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
  }
});

function bootstrap() {
  if (state.notes.length === 0) {
    const timestamp = now();
    state.notes = [
      {
        id: uid(),
        title: "Untitled",
        content: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ];
    persistNotes();
  }

  state.activeId = state.notes[0]?.id ?? null;
  renderAll();
}

bootstrap();
