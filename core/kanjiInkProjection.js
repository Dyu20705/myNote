import { validateKanjiInkEntry } from "./kanjiInkEntry.js";
import { normalizeNote } from "./model.js";

const MAX_PROJECTED_ENTRIES = 128;
const MAX_EXPORT_NOTES = 50_000;
const MAX_EXPORT_ENTRIES = 50_000;
const BUNDLE_KEYS = Object.freeze([
  "schemaVersion",
  "exportedAt",
  "notes",
  "kanjiInkEntries",
  "recognizerAttribution",
]);
const ATTRIBUTION_KEYS = Object.freeze([
  "engineId",
  "engineVersion",
  "datasetVersion",
  "source",
]);
const CANONICAL_NOTE_KEYS = Object.freeze([
  "id",
  "title",
  "content",
  "blocks",
  "tags",
  "createdAt",
  "updatedAt",
  "pinned",
  "archived",
  "links",
  "ast",
  "checksum",
  "version",
  "searchBlob",
]);
const ATTRIBUTION = Object.freeze({
  engineId: "mynote-geometric-template",
  engineVersion: "1.0.0",
  datasetVersion: "mynote-kanji-mvp-1",
  source: "Project-owned geometric templates; no third-party runtime dataset.",
});

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value, expectedKeys) {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function validateNote(note, errorCode) {
  if (!isPlainObject(note) || typeof note.id !== "string" || note.id.length === 0) {
    throw codedError(errorCode);
  }
  try {
    return structuredClone(note);
  } catch {
    throw codedError(errorCode);
  }
}

function sameData(left, right, seenLeft = new WeakMap(), seenRight = new WeakMap()) {
  if (Object.is(left, right)) return true;

  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);
  if (leftIsArray || rightIsArray) {
    if (!leftIsArray || !rightIsArray || left.length !== right.length) return false;
  } else if (!isPlainObject(left) || !isPlainObject(right)) {
    return false;
  }

  const previousRight = seenLeft.get(left);
  const previousLeft = seenRight.get(right);
  if (previousRight || previousLeft) {
    return previousRight === right && previousLeft === left;
  }
  seenLeft.set(left, right);
  seenRight.set(right, left);

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.hasOwn(right, key)
      && sameData(left[key], right[key], seenLeft, seenRight)
    ));
}

function validateCanonicalNote(note, errorCode) {
  const cloned = validateNote(note, errorCode);
  if (!hasExactOwnKeys(cloned, CANONICAL_NOTE_KEYS)) {
    throw codedError(errorCode);
  }

  const normalized = normalizeNote(structuredClone(cloned));
  if (!sameData(cloned, normalized)) {
    throw codedError(errorCode);
  }
  return cloned;
}

function validatedEntries(entries, errorCode = "KANJI_EXPORT_INVALID") {
  if (!Array.isArray(entries) || entries.length > MAX_EXPORT_ENTRIES) {
    throw codedError(errorCode);
  }
  try {
    return entries.map(validateKanjiInkEntry);
  } catch {
    throw codedError(errorCode);
  }
}

function baseSearchBlob(note) {
  if (typeof note.searchBlob === "string") return note.searchBlob;
  const tags = Array.isArray(note.tags) ? note.tags.join(" ") : "";
  const links = Array.isArray(note.links) ? note.links.join(" ") : "";
  return `${note.title || ""} ${note.content || ""} ${tags} ${links}`.trim();
}

export function buildKanjiSearchProjection(entries) {
  const safeEntries = validatedEntries(entries, "KANJI_SEARCH_PROJECTION_INVALID")
    .slice(0, MAX_PROJECTED_ENTRIES);
  const seen = new Set();
  const characters = [];
  for (const entry of safeEntries) {
    if (seen.has(entry.character)) continue;
    seen.add(entry.character);
    characters.push(entry.character);
  }
  return characters.join(" ");
}

export function projectNoteForKanjiSearch(note, entries) {
  if (!isPlainObject(note) || typeof note.id !== "string" || note.id.length === 0) {
    throw codedError("KANJI_SEARCH_PROJECTION_INVALID");
  }
  const projection = buildKanjiSearchProjection(entries);
  const base = baseSearchBlob(note);
  return {
    ...structuredClone(note),
    searchBlob: projection ? `${base} ${projection}`.trim() : base,
  };
}

function normalizedTimestamp(value, errorCode = "KANJI_EXPORT_INVALID") {
  const timestamp = value ?? new Date().toISOString();
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) {
    throw codedError(errorCode);
  }
  return timestamp;
}

function validatedRelations(notes, entries, errorCode) {
  const noteIds = new Set();
  for (const note of notes) {
    if (noteIds.has(note.id)) throw codedError(errorCode);
    noteIds.add(note.id);
  }

  const entryIds = new Set();
  for (const entry of entries) {
    if (entryIds.has(entry.id) || !noteIds.has(entry.noteId)) {
      throw codedError(errorCode);
    }
    entryIds.add(entry.id);
  }
}

export function createKanjiExportBundle(notes, entries, options = {}) {
  if (!Array.isArray(notes) || notes.length > MAX_EXPORT_NOTES) {
    throw codedError("KANJI_EXPORT_INVALID");
  }
  const clonedNotes = notes.map((note) => validateNote(note, "KANJI_EXPORT_INVALID"));
  const safeEntries = validatedEntries(entries);
  validatedRelations(clonedNotes, safeEntries, "KANJI_EXPORT_INVALID");

  return {
    schemaVersion: 3,
    exportedAt: normalizedTimestamp(options.exportedAt),
    notes: clonedNotes,
    kanjiInkEntries: structuredClone(safeEntries),
    recognizerAttribution: { ...ATTRIBUTION },
  };
}

export function validateKanjiExportBundle(input) {
  try {
    if (
      !isPlainObject(input)
      || !hasExactOwnKeys(input, BUNDLE_KEYS)
      || input.schemaVersion !== 3
      || !Array.isArray(input.notes)
      || input.notes.length > MAX_EXPORT_NOTES
      || !isPlainObject(input.recognizerAttribution)
      || !hasExactOwnKeys(input.recognizerAttribution, ATTRIBUTION_KEYS)
      || ATTRIBUTION_KEYS.some((key) => input.recognizerAttribution[key] !== ATTRIBUTION[key])
    ) {
      throw codedError("KANJI_IMPORT_INVALID");
    }

    const notes = input.notes.map((note) => (
      validateCanonicalNote(note, "KANJI_IMPORT_INVALID")
    ));
    const entries = validatedEntries(input.kanjiInkEntries, "KANJI_IMPORT_INVALID");
    validatedRelations(notes, entries, "KANJI_IMPORT_INVALID");
    return {
      schemaVersion: 3,
      exportedAt: normalizedTimestamp(input.exportedAt, "KANJI_IMPORT_INVALID"),
      notes,
      kanjiInkEntries: structuredClone(entries),
      recognizerAttribution: { ...ATTRIBUTION },
    };
  } catch {
    throw codedError("KANJI_IMPORT_INVALID");
  }
}

function coordinate(value, size) {
  return String(Number((value * size).toFixed(2)));
}

function pathForStroke(stroke, size) {
  return stroke.map((point, index) => (
    `${index === 0 ? "M" : "L"} ${coordinate(point.x, size)} ${coordinate(point.y, size)}`
  )).join(" ");
}

export function renderKanjiEntrySvg(entry, options = {}) {
  const safeEntry = validateKanjiInkEntry(entry);
  const size = Number.isFinite(options.size)
    ? Math.max(64, Math.min(1024, Math.round(options.size)))
    : 160;
  const strokeWidth = Math.max(2, Math.round(size / 32));
  const paths = safeEntry.strokes
    .map((stroke) => `<path d="${pathForStroke(stroke, size)}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Handwriting sample for ${safeEntry.character}"><rect width="${size}" height="${size}" fill="white" />${paths}</svg>`;
}

function markdownText(value) {
  return String(value || "").replace(/[\\`*_{}[\]()#+.!|-]/g, "\\$&");
}

export function createKanjiHumanReadableExport(notes, entries) {
  const bundle = createKanjiExportBundle(notes, entries, {
    exportedAt: "1970-01-01T00:00:00.000Z",
  });
  const byNote = new Map();
  for (const entry of bundle.kanjiInkEntries) {
    if (!byNote.has(entry.noteId)) byNote.set(entry.noteId, []);
    byNote.get(entry.noteId).push(entry);
  }

  const sections = [
    "# Kanji handwriting export",
    "",
    `Recognizer: ${ATTRIBUTION.engineId} ${ATTRIBUTION.engineVersion}`,
    `Dataset: ${ATTRIBUTION.datasetVersion}`,
    `Source: ${ATTRIBUTION.source}`,
  ];

  for (const note of bundle.notes) {
    const noteEntries = byNote.get(note.id) || [];
    if (noteEntries.length === 0) continue;
    sections.push("", `## ${markdownText(note.title || "Untitled")}`, "", `Note ID: \`${note.id}\``);
    for (const entry of noteEntries) {
      sections.push(
        "",
        `### Character: ${entry.character}`,
        "",
        `Entry ID: \`${entry.id}\``,
        "",
        renderKanjiEntrySvg(entry),
      );
    }
  }
  return `${sections.join("\n")}\n`;
}

export const KANJI_EXPORT_ATTRIBUTION = ATTRIBUTION;
