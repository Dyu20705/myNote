import { validateKanjiInkEntry } from "./kanjiInkEntry.js";

const MAX_PROJECTED_ENTRIES = 128;
const MAX_EXPORT_NOTES = 50_000;
const MAX_EXPORT_ENTRIES = 50_000;
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

function validateNoteForExport(note) {
  if (!isPlainObject(note) || typeof note.id !== "string" || note.id.length === 0) {
    throw codedError("KANJI_EXPORT_INVALID");
  }
  return structuredClone(note);
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

function normalizedTimestamp(value) {
  const timestamp = value ?? new Date().toISOString();
  if (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp))) {
    throw codedError("KANJI_EXPORT_INVALID");
  }
  return timestamp;
}

export function createKanjiExportBundle(notes, entries, options = {}) {
  if (!Array.isArray(notes) || notes.length > MAX_EXPORT_NOTES) {
    throw codedError("KANJI_EXPORT_INVALID");
  }
  const clonedNotes = notes.map(validateNoteForExport);
  const noteIds = new Set();
  for (const note of clonedNotes) {
    if (noteIds.has(note.id)) throw codedError("KANJI_EXPORT_INVALID");
    noteIds.add(note.id);
  }

  const safeEntries = validatedEntries(entries);
  const entryIds = new Set();
  for (const entry of safeEntries) {
    if (entryIds.has(entry.id) || !noteIds.has(entry.noteId)) {
      throw codedError("KANJI_EXPORT_INVALID");
    }
    entryIds.add(entry.id);
  }

  return {
    schemaVersion: 3,
    exportedAt: normalizedTimestamp(options.exportedAt),
    notes: clonedNotes,
    kanjiInkEntries: structuredClone(safeEntries),
    recognizerAttribution: { ...ATTRIBUTION },
  };
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
