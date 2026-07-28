import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchBlob, hashText, normalizeNote } from "../../core/model.js";
import { parseDocument } from "../../core/parser/index.js";

const fixedBlock = {
  id: "block-fixed",
  type: "paragraph",
  content: "Preserved block",
  meta: { source: "fixture" },
};

function fixedNote(overrides = {}) {
  return {
    id: "note-fixed",
    title: "Canonical title",
    content: "#alpha [[Fresh Link]]",
    blocks: [fixedBlock],
    tags: ["manual"],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    pinned: false,
    archived: false,
    version: 1,
    ...overrides,
  };
}

test("normalizeNote rejects null-like and non-object inputs", () => {
  for (const value of [undefined, null, false, 0, "note"]) {
    assert.equal(normalizeNote(value), null);
  }
});

test("links are always rebuilt from current content", () => {
  const note = fixedNote({ links: ["Stale Link"] });
  const normalized = normalizeNote(note);

  assert.deepEqual(normalized.links, parseDocument(note.content).links);
  assert.deepEqual(normalized.links, ["Fresh Link"]);
});

test("AST is always rebuilt from current content", () => {
  const note = fixedNote({ ast: [{ type: "paragraph", text: "stale" }] });
  const normalized = normalizeNote(note);

  assert.deepEqual(normalized.ast, parseDocument(note.content).ast);
  assert.notDeepEqual(normalized.ast, note.ast);
});

test("checksum is always rebuilt from canonical title and exact content", () => {
  const note = fixedNote({ checksum: "stale-checksum" });
  const normalized = normalizeNote(note);

  assert.equal(normalized.checksum, hashText(`${normalized.title}\n${normalized.content}`));
  assert.notEqual(normalized.checksum, note.checksum);
});

test("trimmed title is used when rebuilding checksum", () => {
  const note = fixedNote({ title: "  Canonical title  ", checksum: undefined });
  const normalized = normalizeNote(note);

  assert.equal(normalized.title, "Canonical title");
  assert.equal(normalized.checksum, hashText(`Canonical title\n${note.content}`));
});

test("blank title falls back to Untitled before rebuilding checksum", () => {
  const note = fixedNote({ title: " \t ", checksum: undefined });
  const normalized = normalizeNote(note);

  assert.equal(normalized.title, "Untitled");
  assert.equal(normalized.checksum, hashText(`Untitled\n${note.content}`));
});

test("caller-provided searchBlob is ignored and rebuilt from canonical fields", () => {
  const normalized = normalizeNote(fixedNote({ searchBlob: "stale searchable material" }));

  assert.equal(normalized.searchBlob, buildSearchBlob(normalized));
  assert.doesNotMatch(normalized.searchBlob, /stale searchable material/);
});

test("tags merge supplied and parsed metadata with normalization and stable deduplication", () => {
  const content = [
    "#Inline #manual",
    "```txt",
    "#hidden",
    "```",
    "#After",
  ].join("\n");
  const normalized = normalizeNote(fixedNote({
    content,
    tags: [" Manual ", "SUPPLIED", "supplied", ""],
  }));

  assert.deepEqual(normalized.tags, ["manual", "supplied", "inline", "after"]);
});

test("provided non-empty blocks are preserved for compatibility", () => {
  const blocks = [{ ...fixedBlock }];
  const normalized = normalizeNote(fixedNote({ blocks }));

  assert.strictEqual(normalized.blocks, blocks);
  assert.deepEqual(normalized.blocks, blocks);
});

test("missing blocks are generated with stable shape and unique IDs", () => {
  const normalized = normalizeNote(fixedNote({
    content: "First paragraph\n\nSecond paragraph",
    blocks: [],
  }));

  assert.deepEqual(normalized.blocks.map(({ type, content, meta }) => ({ type, content, meta })), [
    { type: "paragraph", content: "First paragraph", meta: {} },
    { type: "paragraph", content: "Second paragraph", meta: {} },
  ]);
  assert.equal(normalized.blocks.every((block) => typeof block.id === "string" && block.id.length > 0), true);
  assert.equal(new Set(normalized.blocks.map((block) => block.id)).size, normalized.blocks.length);
});

test("version keeps positive integers and otherwise falls back to one", () => {
  const cases = [
    [undefined, 1],
    [0, 1],
    [-1, 1],
    [1.5, 1],
    ["2", 1],
    [1, 1],
    [3, 3],
  ];

  for (const [input, expected] of cases) {
    assert.equal(normalizeNote(fixedNote({ version: input })).version, expected);
  }
});

test("canonical fields and exact line endings are preserved", () => {
  const content = "first\r\nsecond\rthird";
  const note = fixedNote({
    content,
    pinned: "yes",
    archived: 0,
  });
  const normalized = normalizeNote(note);

  assert.equal(normalized.id, note.id);
  assert.equal(normalized.title, note.title);
  assert.equal(normalized.content, content);
  assert.equal(normalized.createdAt, note.createdAt);
  assert.equal(normalized.updatedAt, note.updatedAt);
  assert.equal(normalized.pinned, true);
  assert.equal(normalized.archived, false);
});

test("non-string content becomes the canonical empty string", () => {
  const normalized = normalizeNote(fixedNote({ content: 42, checksum: "stale" }));

  assert.equal(normalized.content, "");
  assert.deepEqual(normalized.links, []);
  assert.deepEqual(normalized.ast, []);
  assert.equal(normalized.checksum, hashText(`${normalized.title}\n`));
});

test("normalization is idempotent for a fixed complete note", () => {
  const once = normalizeNote(fixedNote());
  const twice = normalizeNote(once);

  assert.deepEqual(twice, once);
});

test("hashText is deterministic and changes when canonical material changes", () => {
  const source = "Canonical title\nCanonical content";

  assert.equal(hashText(source), hashText(source));
  assert.notEqual(hashText(source), hashText(`${source}!`));
});
