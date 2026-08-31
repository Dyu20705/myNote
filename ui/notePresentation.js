const DEFAULT_MAX_LENGTH = 160;
const DEFAULT_MAX_SCAN_LENGTH = 8192;
const MAX_OUTPUT_LENGTH = 1000;
const MAX_SCAN_LENGTH = 65536;

function presentationError() {
  const error = new Error("NOTE_PRESENTATION_OPTIONS_INVALID");
  error.code = "NOTE_PRESENTATION_OPTIONS_INVALID";
  return error;
}

function validateOptions(options) {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxScanLength = options.maxScanLength ?? DEFAULT_MAX_SCAN_LENGTH;
  if (
    !Number.isInteger(maxLength)
    || maxLength < 1
    || maxLength > MAX_OUTPUT_LENGTH
    || !Number.isInteger(maxScanLength)
    || maxScanLength < 32
    || maxScanLength > MAX_SCAN_LENGTH
  ) {
    throw presentationError();
  }
  return { maxLength, maxScanLength };
}

function removeCommonHtmlTags(value) {
  return value.replace(
    /<\/?(?:a|abbr|article|aside|b|blockquote|br|button|code|details|div|em|footer|form|h[1-6]|header|hr|i|img|input|label|li|main|mark|nav|ol|p|pre|script|section|small|span|strong|style|summary|table|tbody|td|textarea|th|thead|tr|u|ul)(?:\s[^>]*)?>/giu,
    " ",
  );
}

function replaceControlCharacters(value) {
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const isForbidden = codePoint === 127
      || (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13);
    result += isForbidden ? " " : character;
  }
  return result;
}

function plainTextProjection(content, maxScanLength) {
  const scanned = content.slice(0, maxScanLength).replace(/\r\n?|\u2028|\u2029/gu, "\n");
  const projected = removeCommonHtmlTags(scanned)
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/^\s*```[^\n]*$/gmu, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s*>+\s?/gmu, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gmu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/gu, (_match, target, alias) => alias || target)
    .replace(/\*\*(.*?)\*\*/gu, "$1")
    .replace(/__(.*?)__/gu, "$1")
    .replace(/~~(.*?)~~/gu, "$1")
    .replace(/[`*_~]/gu, "")
    .replace(/[<>]/gu, "");

  return replaceControlCharacters(projected)
    .replace(/\s+/gu, " ")
    .trim();
}

export function deriveNotePreview(content, options = {}) {
  const { maxLength, maxScanLength } = validateOptions(options);
  if (typeof content !== "string" || content.trim().length === 0) {
    return "";
  }

  const projected = plainTextProjection(content, maxScanLength);
  if (projected.length <= maxLength) {
    return projected;
  }
  if (maxLength === 1) {
    return "…";
  }
  return `${projected.slice(0, maxLength - 1).trimEnd()}…`.padEnd(maxLength, "…");
}

export function createNoteBoardSections({ notesById, orderedIds, query = "" } = {}) {
  if (!(notesById instanceof Map) || !Array.isArray(orderedIds)) {
    throw presentationError();
  }

  const normalizedQuery = typeof query === "string" ? query.trim().toLowerCase() : "";

  if (!normalizedQuery) {
    const pinnedIds = [];
    const noteIds = [];
    for (const id of orderedIds) {
      const note = notesById.get(id);
      if (!note || typeof note !== "object") {
        continue;
      }
      if (note.pinned === true) {
        pinnedIds.push(id);
      } else {
        noteIds.push(id);
      }
    }

    return [
      { id: "pinned", label: "PINNED", orderedIds: pinnedIds },
      { id: "notes", label: "NOTES", orderedIds: noteIds },
    ];
  }

  const titleIds = [];
  const tagIds = [];
  const japaneseIds = [];
  const contentIds = [];

  for (const id of orderedIds) {
    const note = notesById.get(id);
    if (!note || typeof note !== "object") {
      continue;
    }

    const title = typeof note.title === "string" ? note.title.toLowerCase() : "";
    const tags = Array.isArray(note.tags) ? note.tags.map((t) => String(t).toLowerCase()) : [];
    const isJapanese = Boolean(
      note.japanese
      || note.template
      || tags.some((t) => ["n5", "n4", "n3", "n2", "n1", "vocabulary", "kanji", "grammar", "japanese"].includes(t)),
    );

    if (title.includes(normalizedQuery)) {
      titleIds.push(id);
    } else if (tags.some((t) => t.includes(normalizedQuery.replace(/^#/, "")))) {
      tagIds.push(id);
    } else if (isJapanese) {
      japaneseIds.push(id);
    } else {
      contentIds.push(id);
    }
  }

  return [
    { id: "title", label: "TITLE MATCHES", orderedIds: titleIds },
    { id: "tags", label: "TAG MATCHES", orderedIds: tagIds },
    { id: "japanese", label: "JAPANESE STUDY", orderedIds: japaneseIds },
    { id: "notes", label: "CONTENT MATCHES", orderedIds: contentIds },
  ];
}

export function createNoteCardPresentation(note, { formatDate } = {}) {
  if (!note || typeof note !== "object" || typeof formatDate !== "function") {
    throw presentationError();
  }
  return {
    title: typeof note.title === "string" && note.title.trim() ? note.title : "Untitled",
    preview: deriveNotePreview(note.content),
    date: formatDate(note.updatedAt),
    tags: Array.isArray(note.tags)
      ? note.tags.filter((tag) => typeof tag === "string").slice(0, 4)
      : [],
    pinned: note.pinned === true,
    archived: note.archived === true,
  };
}
