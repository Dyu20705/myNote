const notesById = new Map();
const tokenIndex = new Map();
const noteTokens = new Map();
const MAX_QUERY_LENGTH = 300;
const MAX_NOTES_PER_REBUILD = 50000;
const MAX_TEXT_LENGTH = 200000;

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter(Boolean);
}

function dateIsToday(iso) {
  const now = new Date();
  const date = new Date(iso);
  return (
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()
  );
}

function fuzzySubsequence(pattern, text) {
  let left = 0;
  for (let right = 0; right < text.length && left < pattern.length; right += 1) {
    if (pattern[left] === text[right]) {
      left += 1;
    }
  }
  return left === pattern.length;
}

function addToken(token, noteId) {
  if (!tokenIndex.has(token)) {
    tokenIndex.set(token, new Set());
  }
  tokenIndex.get(token).add(noteId);
}

function removeToken(token, noteId) {
  const entry = tokenIndex.get(token);
  if (!entry) {
    return;
  }
  entry.delete(noteId);
  if (entry.size === 0) {
    tokenIndex.delete(token);
  }
}

function tokensForNote(note) {
  const textTokens = tokenize(`${note.title} ${note.content}`);
  const tagTokens = (note.tags || []).map((tag) => `tag:${tag}`);
  const linkTokens = (note.links || []).map((link) => `link:${String(link).toLowerCase()}`);
  const metaTokens = [note.pinned ? "is:pinned" : "", note.archived ? "is:archived" : ""].filter(Boolean);
  return new Set([...textTokens, ...tagTokens, ...linkTokens, ...metaTokens]);
}

function normalizeNotePayload(note) {
  if (!note || typeof note !== "object" || typeof note.id !== "string") {
    return null;
  }

  const title = String(note.title || "").slice(0, 1000);
  const content = String(note.content || "").slice(0, MAX_TEXT_LENGTH);
  const tags = Array.isArray(note.tags) ? note.tags.map((item) => String(item || "").toLowerCase()).slice(0, 200) : [];
  const links = Array.isArray(note.links) ? note.links.map((item) => String(item || "").toLowerCase()).slice(0, 200) : [];

  return {
    ...note,
    title,
    content,
    tags,
    links,
    searchBlob: String(note.searchBlob || `${title} ${content} ${tags.join(" ")} ${links.join(" ")}`).slice(0, MAX_TEXT_LENGTH),
    updatedAt: typeof note.updatedAt === "string" ? note.updatedAt : new Date(0).toISOString(),
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
  };
}

function removeNoteById(id) {
  const previousTokens = noteTokens.get(id);
  if (previousTokens) {
    for (const token of previousTokens) {
      removeToken(token, id);
    }
    noteTokens.delete(id);
  }
  notesById.delete(id);
}

function upsertNote(note) {
  const safeNote = normalizeNotePayload(note);
  if (!safeNote) {
    return;
  }

  removeNoteById(safeNote.id);
  notesById.set(safeNote.id, safeNote);

  const nextTokens = tokensForNote(safeNote);
  noteTokens.set(safeNote.id, nextTokens);
  for (const token of nextTokens) {
    addToken(token, safeNote.id);
  }
}

function rebuildIndex(notes) {
  notesById.clear();
  tokenIndex.clear();
  noteTokens.clear();

  for (const note of (notes || []).slice(0, MAX_NOTES_PER_REBUILD)) {
    upsertNote(note);
  }
}

function intersectSets(left, right) {
  if (!left) {
    return new Set(right);
  }

  const next = new Set();
  for (const id of left) {
    if (right.has(id)) {
      next.add(id);
    }
  }
  return next;
}

function runQuery(rawQuery) {
  const query = String(rawQuery || "").trim().toLowerCase().slice(0, MAX_QUERY_LENGTH);
  const tokens = query.split(/\s+/).filter(Boolean);
  const isArchived = tokens.includes("is:archived");
  const notes = [...notesById.values()].filter((note) => isArchived ? note.archived : !note.archived);

  if (tokens.length === 0 || (tokens.length === 1 && isArchived)) {
    return notes
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((note) => note.id);
  }

  let candidateSet = null;

  const scoreTokens = [];

  for (const token of tokens) {
    if (token.startsWith("tag:")) {
      const exact = tokenIndex.get(token);
      if (!exact) {
        return [];
      }
      candidateSet = intersectSets(candidateSet, exact);
      continue;
    }

    if (token === "is:pinned" || token === "is:archived") {
      const exact = tokenIndex.get(token);
      if (!exact) {
        return [];
      }
      candidateSet = intersectSets(candidateSet, exact);
      continue;
    }

    if (token === "updated:today") {
      const todaySet = new Set(notes.filter((note) => dateIsToday(note.updatedAt)).map((note) => note.id));
      candidateSet = intersectSets(candidateSet, todaySet);
      continue;
    }

    scoreTokens.push(token);

    const fromIndex = tokenIndex.get(token);
    if (fromIndex) {
      candidateSet = intersectSets(candidateSet, fromIndex);
      continue;
    }

    const current = candidateSet ? [...candidateSet].map((id) => notesById.get(id)).filter(Boolean) : notes;
    const fuzzy = new Set(
      current
        .filter((note) => note.searchBlob.includes(token) || fuzzySubsequence(token, note.searchBlob))
        .map((note) => note.id)
    );
    candidateSet = intersectSets(candidateSet, fuzzy);
  }

  const candidates = (candidateSet ? [...candidateSet] : notes.map((note) => note.id))
    .map((id) => notesById.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const scoreA = scoreNote(a, scoreTokens);
      const scoreB = scoreNote(b, scoreTokens);
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return candidates.map((note) => note.id);
}

function scoreNote(note, tokens) {
  let score = 0;
  const title = String(note.title || "").toLowerCase();
  const titleWords = tokenize(title);

  if (note.pinned) {
    score += 15;
  }

  const ageDays = Math.max(0, (Date.now() - new Date(note.updatedAt).getTime()) / 86400000);
  score += Math.max(0, 20 - ageDays);

  for (const token of tokens) {
    if (titleWords.includes(token)) {
      score += 55;
      continue;
    }

    if (title.includes(token)) {
      score += 35;
      continue;
    }

    if (titleWords.some((word) => word.startsWith(token))) {
      score += 20;
      continue;
    }

    if (note.searchBlob.includes(token)) {
      score += 8;
    }
  }

  return score;
}

function validateMessageShape(data) {
  if (!data || typeof data !== "object") {
    return "Malformed message";
  }
  if (typeof data.id !== "number" || typeof data.type !== "string") {
    return "Invalid message envelope";
  }
  if (typeof data.payload !== "object" || data.payload === null) {
    return "Invalid payload";
  }
  return "";
}

self.onmessage = (event) => {
  const validationError = validateMessageShape(event.data);
  if (validationError) {
    self.postMessage({ id: -1, ok: false, error: validationError });
    return;
  }

  const { id, type, payload } = event.data;

  if (type === "rebuild") {
    rebuildIndex(payload.notes || []);
    self.postMessage({ id, ok: true, result: true });
    return;
  }

  if (type === "query") {
    const result = runQuery(payload.query || "");
    self.postMessage({ id, ok: true, result });
    return;
  }

  if (type === "upsert") {
    upsertNote(payload.note);
    self.postMessage({ id, ok: true, result: true });
    return;
  }

  if (type === "remove") {
    removeNoteById(payload.id);
    self.postMessage({ id, ok: true, result: true });
    return;
  }

  self.postMessage({ id, ok: false, error: "Unknown message type" });
};
