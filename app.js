const STORAGE_KEY = "my-note-atlas-v1";
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

const seedNotes = [
  {
    id: uid(),
    title: "Thread Mode concept",
    content:
      "Write the main note once, then let side thoughts spin off into separate branches.\n\n#idea #product\n- Main source of truth remains intact\n- Side tasks should not break the narrative\n- Shopping notes can live in a separate thread",
    createdAt: now(),
    updatedAt: now(),
    snapshots: [],
  },
  {
    id: uid(),
    title: "Smart Bento Grid",
    content:
      "Context-aware canvas that groups nearby thoughts by time, project, and intent.\n\n#design #ai\n- Pull related notes together\n- Reduce manual folder management\n- Show the shape of work instead of the shape of files",
    createdAt: now(),
    updatedAt: now(),
    snapshots: [],
  },
  {
    id: uid(),
    title: "Spatial Recall demo",
    content:
      "Capture a small visual context whenever a note changes. Review should feel like zooming back into a memory map.\n\n#review #memory\n- Review by place, not just query\n- Attach snapshots to moments\n- Make recall feel physical",
    createdAt: now(),
    updatedAt: now(),
    snapshots: [],
  },
];

const state = {
  notes: loadNotes(),
  activeId: null,
  query: "",
};

const els = {
  noteCount: document.getElementById("noteCount"),
  syncState: document.getElementById("syncState"),
  searchInput: document.getElementById("searchInput"),
  newNoteButton: document.getElementById("newNoteButton"),
  saveButton: document.getElementById("saveButton"),
  noteList: document.getElementById("noteList"),
  titleInput: document.getElementById("titleInput"),
  contentInput: document.getElementById("contentInput"),
  autoSignals: document.getElementById("autoSignals"),
  activeNoteLabel: document.getElementById("activeNoteLabel"),
  threadCount: document.getElementById("threadCount"),
  threadView: document.getElementById("threadView"),
  recallView: document.getElementById("recallView"),
  bentoGrid: document.getElementById("bentoGrid"),
  bentoSummary: document.getElementById("bentoSummary"),
  noteItemTemplate: document.getElementById("noteItemTemplate"),
};

function loadNotes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return seedNotes;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return seedNotes;
    }

    return parsed.map((note) => ({
      ...note,
      snapshots: Array.isArray(note.snapshots) ? note.snapshots : [],
    }));
  } catch {
    return seedNotes;
  }
}

function persistNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
  els.syncState.textContent = "Saved locally in your browser";
}

function createNote() {
  const timestamp = now();
  const note = {
    id: uid(),
    title: "Untitled thought",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    snapshots: [],
  };

  state.notes = [note, ...state.notes];
  state.activeId = note.id;
  els.syncState.textContent = "New note ready for capture";
  render();
  focusEditor();
}

function activeNote() {
  return state.notes.find((note) => note.id === state.activeId) ?? null;
}

function updateActiveNote(partial) {
  const note = activeNote();
  if (!note) {
    return;
  }

  const updatedAt = now();
  const nextSnapshot = buildSnapshot(note, partial);
  const nextNote = {
    ...note,
    ...partial,
    updatedAt,
    snapshots: [nextSnapshot, ...(note.snapshots ?? [])].slice(0, 6),
  };

  state.notes = state.notes.map((item) => (item.id === note.id ? nextNote : item));
  persistNotes();
  render();
}

function saveCurrentNote() {
  const note = activeNote();
  if (!note) {
    createNote();
    return;
  }

  const title = els.titleInput.value.trim() || "Untitled thought";
  const content = els.contentInput.value.trimEnd();
  updateActiveNote({ title, content });
}

function buildSnapshot(note, partial) {
  const content = partial.content ?? note.content;
  const tags = extractTags(content);
  const summary = content.slice(0, 140).replace(/\s+/g, " ") || "Empty note";

  return {
    id: uid(),
    createdAt: now(),
    title: partial.title ?? note.title,
    summary,
    tags,
    cursorHint: createCursorHint(content),
  };
}

function createCursorHint(content) {
  const lines = content.split("\n").filter(Boolean);
  if (lines.length === 0) {
    return "Waiting for a first thought";
  }

  const firstLine = lines[0].replace(/^[-*]\s*/, "").trim();
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function extractTags(content = "") {
  const tags = [...content.matchAll(/#([\w-]+)/g)].map((match) => `#${match[1]}`);
  return [...new Set(tags)].slice(0, 6);
}

function extractMentions(content = "") {
  return [...new Set([...content.matchAll(/@([\w-]+)/g)].map((match) => `@${match[1]}`))].slice(0, 4);
}

function extractActionLines(content = "") {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .slice(0, 4);
}

function computeSignals(note) {
  const tags = extractTags(note.content);
  const mentions = extractMentions(note.content);
  const actions = extractActionLines(note.content);
  const lines = note.content.split("\n").filter(Boolean).length;
  const words = note.content.trim().split(/\s+/).filter(Boolean).length;

  return [
    `${words} words`,
    `${lines} lines`,
    `${tags.length} tags`,
    `${actions.length} actions`,
    `${mentions.length} mentions`,
  ];
}

function computeThreads(notes) {
  const allActions = [];
  const allIdeas = [];

  for (const note of notes) {
    const tags = extractTags(note.content);
    const actions = extractActionLines(note.content);
    const content = note.content.trim();

    if (actions.length > 0 || tags.some((tag) => tag.toLowerCase().includes("#todo"))) {
      allActions.push({ note, actions, tags });
    }

    if (content.length > 0 && (tags.length > 0 || content.length > 70)) {
      allIdeas.push({ note, tags, excerpt: content.slice(0, 150) });
    }
  }

  return {
    actions: allActions.slice(0, 3),
    ideas: allIdeas.slice(0, 3),
  };
}

function computeClusters(notes) {
  const clusters = new Map();

  for (const note of notes) {
    const bucket = clusterKey(note);
    if (!clusters.has(bucket)) {
      clusters.set(bucket, []);
    }

    clusters.get(bucket).push(note);
  }

  return [...clusters.entries()].map(([name, items]) => ({ name, items: items.slice(0, 3) }));
}

function clusterKey(note) {
  const tags = extractTags(note.content);
  if (tags.some((tag) => /#idea/i.test(tag))) return "Ideas";
  if (tags.some((tag) => /#design|#ui|#ux/i.test(tag))) return "Design";
  if (tags.some((tag) => /#product|#roadmap|#ship/i.test(tag))) return "Product";
  if (extractActionLines(note.content).length > 0) return "Actions";
  return "Archive";
}

function setActiveNote(id) {
  state.activeId = id;
  const note = activeNote();
  if (!note) {
    return;
  }

  els.titleInput.value = note.title;
  els.contentInput.value = note.content;
  els.activeNoteLabel.textContent = "Editing";
  render();
}

function focusEditor() {
  els.titleInput.focus();
  els.titleInput.select();
}

function render() {
  const filteredNotes = state.notes.filter((note) => matchesQuery(note, state.query));
  const note = activeNote() ?? filteredNotes[0] ?? state.notes[0] ?? null;

  if (note && note.id !== state.activeId) {
    state.activeId = note.id;
    els.titleInput.value = note.title;
    els.contentInput.value = note.content;
  }

  renderTopline();
  renderNotes(filteredNotes);
  renderSignals(note);
  renderThreads(filteredNotes);
  renderRecall(note);
  renderClusters(filteredNotes);
}

function renderTopline() {
  els.noteCount.textContent = `${state.notes.length} note${state.notes.length === 1 ? "" : "s"}`;
}

function renderNotes(notes) {
  els.noteList.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No notes match this search. Try another keyword or create a fresh thought.";
    els.noteList.append(empty);
    return;
  }

  for (const note of notes) {
    const clone = els.noteItemTemplate.content.cloneNode(true);
    const button = clone.querySelector(".note-item");
    const title = clone.querySelector(".note-item-title");
    const date = clone.querySelector(".note-item-date");
    const preview = clone.querySelector(".note-item-preview");
    const tags = clone.querySelector(".note-item-tags");

    title.textContent = note.title;
    date.textContent = formatDate(note.updatedAt);
    preview.textContent = note.content.trim().slice(0, 120) || "Empty note";

    const chipValues = extractTags(note.content).slice(0, 4);
    if (chipValues.length === 0) {
      const span = document.createElement("span");
      span.className = "tag-chip";
      span.textContent = "No tags yet";
      tags.append(span);
    } else {
      for (const chip of chipValues) {
        const span = document.createElement("span");
        span.className = "tag-chip";
        span.textContent = chip;
        tags.append(span);
      }
    }

    if (note.id === state.activeId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => setActiveNote(note.id));
    els.noteList.append(clone);
  }
}

function renderSignals(note) {
  if (!note) {
    els.autoSignals.replaceChildren();
    els.activeNoteLabel.textContent = "Ready";
    return;
  }

  els.activeNoteLabel.textContent = note.id === state.activeId ? "Editing" : "Ready";
  els.autoSignals.replaceChildren();

  for (const signal of computeSignals(note)) {
    const pill = document.createElement("span");
    pill.className = "signal-pill";
    pill.textContent = signal;
    els.autoSignals.append(pill);
  }
}

function renderThreads(notes) {
  const { actions, ideas } = computeThreads(notes);
  const branchCount = actions.length + ideas.length;
  els.threadCount.textContent = `${branchCount} branch${branchCount === 1 ? "" : "es"}`;
  els.threadView.replaceChildren();

  if (branchCount === 0) {
    els.threadView.append(emptyCard("No branches yet", "Add tags or bullet lines to split a note into live threads."));
    return;
  }

  for (const actionGroup of actions) {
    const card = document.createElement("article");
    card.className = "thread-card";

    const title = document.createElement("strong");
    title.textContent = actionGroup.note.title;

    const meta = document.createElement("div");
    meta.className = "thread-meta";
    for (const tag of actionGroup.tags.slice(0, 3)) {
      meta.append(createChip(tag, "thread-pill"));
    }

    const body = document.createElement("p");
    body.textContent = actionGroup.actions[0] ?? actionGroup.note.content.slice(0, 140);

    card.append(title, meta, body);
    els.threadView.append(card);
  }

  for (const ideaGroup of ideas) {
    const card = document.createElement("article");
    card.className = "thread-card";

    const title = document.createElement("strong");
    title.textContent = ideaGroup.note.title;

    const meta = document.createElement("div");
    meta.className = "thread-meta";
    for (const tag of ideaGroup.tags.slice(0, 3)) {
      meta.append(createChip(tag, "thread-pill"));
    }

    const body = document.createElement("p");
    body.textContent = ideaGroup.excerpt;

    card.append(title, meta, body);
    els.threadView.append(card);
  }
}

function renderRecall(note) {
  els.recallView.replaceChildren();

  if (!note || note.snapshots.length === 0) {
    els.recallView.append(emptyCard("No recall snapshots", "Saving a note will create lightweight memory frames here."));
    return;
  }

  for (const snapshot of note.snapshots.slice(0, 3)) {
    const card = document.createElement("article");
    card.className = "recall-card";

    const title = document.createElement("strong");
    title.textContent = snapshot.title;

    const body = document.createElement("p");
    body.textContent = snapshot.summary;

    const meta = document.createElement("div");
    meta.className = "recall-meta";
    meta.append(createChip(formatDate(snapshot.createdAt), "recall-pill"));
    meta.append(createChip(snapshot.cursorHint, "recall-pill"));

    card.append(title, meta, body);
    els.recallView.append(card);
  }
}

function renderClusters(notes) {
  const clusters = computeClusters(notes);
  els.bentoSummary.textContent = `${clusters.length} cluster${clusters.length === 1 ? "" : "s"}`;
  els.bentoGrid.replaceChildren();

  if (clusters.length === 0) {
    els.bentoGrid.append(emptyCard("No clusters yet", "Use #design, #idea, #product, or bullet actions to see the Bento Grid awaken."));
    return;
  }

  for (const cluster of clusters) {
    const card = document.createElement("article");
    card.className = "cluster-card";

    const title = document.createElement("strong");
    title.textContent = cluster.name;

    const meta = document.createElement("div");
    meta.className = "cluster-meta";
    meta.append(createChip(`${cluster.items.length} notes`, "cluster-pill"));

    const names = document.createElement("p");
    names.textContent = cluster.items.map((item) => item.title).join(" · ");

    card.append(title, meta, names);
    els.bentoGrid.append(card);
  }
}

function createChip(text, className) {
  const chip = document.createElement("span");
  chip.className = className;
  chip.textContent = text;
  return chip;
}

function emptyCard(title, message) {
  const card = document.createElement("div");
  card.className = "empty-state";
  card.innerHTML = `<strong>${escapeHtml(title)}</strong><br />${escapeHtml(message)}`;
  return card;
}

function matchesQuery(note, query) {
  if (!query) {
    return true;
  }

  const haystack = [note.title, note.content, ...extractTags(note.content)].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
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

let saveTimer = null;
function scheduleAutosave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveCurrentNote();
  }, 650);
}

els.titleInput.addEventListener("input", scheduleAutosave);
els.contentInput.addEventListener("input", scheduleAutosave);

window.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
  }
});

function bootstrap() {
  const first = state.notes[0];
  state.activeId = first?.id ?? null;
  if (first) {
    els.titleInput.value = first.title;
    els.contentInput.value = first.content;
  }
  persistNotes();
  render();
}

bootstrap();
