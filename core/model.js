import { parseDocument } from "./parser/index.js";

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();

export function extractInlineTags(text) {
  return parseDocument(text).tags;
}

export function extractWikiLinks(text) {
  return parseDocument(text).links;
}

export function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildBlocks(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => ({
      id: uid(),
      type: "paragraph",
      content: chunk,
      meta: {},
    }));
}

export function buildSearchBlob(note) {
  return `${note.title} ${note.content} ${note.tags.join(" ")} ${note.links.join(" ")}`.toLowerCase();
}

export function normalizeNote(note) {
  if (!note || typeof note !== "object") {
    return null;
  }

  const timestamp = now();
  const updatedAt = typeof note.updatedAt === "string" ? note.updatedAt : timestamp;
  const content = typeof note.content === "string" ? note.content : "";
  const title = typeof note.title === "string" && note.title.trim() ? note.title.trim() : "Untitled";
  const parsed = parseDocument(content);
  const mergedTags = [...(Array.isArray(note.tags) ? note.tags : []), ...parsed.tags];

  const normalized = {
    id: typeof note.id === "string" ? note.id : uid(),
    title,
    content,
    blocks: Array.isArray(note.blocks) && note.blocks.length ? note.blocks : buildBlocks(content),
    tags: [...new Set(mergedTags.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))],
    createdAt: typeof note.createdAt === "string" ? note.createdAt : updatedAt,
    updatedAt,
    pinned: Boolean(note.pinned),
    archived: Boolean(note.archived),
    links: parsed.links,
    ast: parsed.ast,
    checksum: hashText(`${title}\n${content}`),
    version: Number.isInteger(note.version) && note.version > 0 ? note.version : 1,
  };

  normalized.searchBlob = buildSearchBlob(normalized);
  return normalized;
}

export function sortByUpdatedAtDesc(left, right) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function createEmptyNote(seed = {}) {
  const timestamp = now();
  return normalizeNote({
    id: uid(),
    title: seed.title || "Untitled",
    content: seed.content || "",
    tags: seed.tags || [],
    pinned: Boolean(seed.pinned),
    archived: false,
    links: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  });
}
