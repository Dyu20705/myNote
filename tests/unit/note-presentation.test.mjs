import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  return import(new URL("../../ui/notePresentation.js", import.meta.url));
}

test("deriveNotePreview removes presentation syntax without mutating canonical content", async () => {
  const { deriveNotePreview } = await loadModule();
  const content = [
    "# Daily review",
    "- [x] Read **grammar** and [[N5 index]]",
    "Visit [reference](https://example.invalid/path)",
    "```js",
    "const value = '<unsafe>';",
    "```",
  ].join("\n");
  const original = content;

  assert.equal(
    deriveNotePreview(content),
    "Daily review Read grammar and N5 index Visit reference const value = 'unsafe';",
  );
  assert.equal(content, original);
});

test("deriveNotePreview returns an empty string for empty or syntax-only content", async () => {
  const { deriveNotePreview } = await loadModule();
  assert.equal(deriveNotePreview(""), "");
  assert.equal(deriveNotePreview(" \n\t"), "");
  assert.equal(deriveNotePreview("```\n```"), "");
  assert.equal(deriveNotePreview("<!-- comment -->"), "");
});

test("deriveNotePreview is bounded and deterministic for hostile long input", async () => {
  const { deriveNotePreview } = await loadModule();
  const content = `${"alpha ".repeat(3000)}OMEGA`;
  const first = deriveNotePreview(content, { maxLength: 40, maxScanLength: 128 });
  const second = deriveNotePreview(content, { maxLength: 40, maxScanLength: 128 });

  assert.equal(first, second);
  assert.equal(first.length, 40);
  assert.match(first, /…$/u);
  assert.doesNotMatch(first, /OMEGA/u);
});

test("createNoteCardPresentation exposes restrained existing metadata only", async () => {
  const { createNoteCardPresentation } = await loadModule();
  const note = Object.freeze({
    id: "note-1",
    title: "Study note",
    content: "## Grammar\nA concise explanation.",
    tags: ["n5", "grammar", "daily", "review", "hidden"],
    pinned: true,
    archived: false,
    updatedAt: "2026-08-04T00:00:00.000Z",
  });

  assert.deepEqual(createNoteCardPresentation(note, {
    formatDate: () => "Aug 4",
  }), {
    title: "Study note",
    preview: "Grammar A concise explanation.",
    date: "Aug 4",
    tags: ["n5", "grammar", "daily", "review"],
    pinned: true,
    archived: false,
  });
});

test("presentation helpers reject malformed bounds with content-free errors", async () => {
  const { deriveNotePreview } = await loadModule();
  for (const options of [
    { maxLength: 0 },
    { maxLength: 1001 },
    { maxScanLength: 31 },
    { maxScanLength: 65537 },
  ]) {
    assert.throws(() => deriveNotePreview("text", options), {
      code: "NOTE_PRESENTATION_OPTIONS_INVALID",
      message: "NOTE_PRESENTATION_OPTIONS_INVALID",
    });
  }
});

test("createNoteBoardSections partitions upstream order without taking query ownership", async () => {
  const { createNoteBoardSections } = await loadModule();
  const notes = [
    Object.freeze({ id: "note-2", pinned: false }),
    Object.freeze({ id: "pinned-1", pinned: true }),
    Object.freeze({ id: "note-1", pinned: false }),
    Object.freeze({ id: "pinned-2", pinned: true }),
  ];
  const notesById = new Map(notes.map((note) => [note.id, note]));
  notesById.set("invalid", null);
  const originalEntries = [...notesById.entries()];
  const orderedIds = Object.freeze([
    "note-2",
    "pinned-1",
    "stale",
    "invalid",
    "note-1",
    "pinned-2",
  ]);

  assert.deepEqual(createNoteBoardSections({ notesById, orderedIds }), [
    { id: "pinned", label: "PINNED", orderedIds: ["pinned-1", "pinned-2"] },
    { id: "notes", label: "NOTES", orderedIds: ["note-2", "note-1"] },
  ]);
  assert.deepEqual([...notesById.entries()], originalEntries);
  assert.deepEqual(orderedIds, [
    "note-2",
    "pinned-1",
    "stale",
    "invalid",
    "note-1",
    "pinned-2",
  ]);
  assert.throws(() => createNoteBoardSections({ notesById: {}, orderedIds: [] }), {
    code: "NOTE_PRESENTATION_OPTIONS_INVALID",
    message: "NOTE_PRESENTATION_OPTIONS_INVALID",
  });
  assert.throws(() => createNoteBoardSections({ notesById, orderedIds: null }), {
    code: "NOTE_PRESENTATION_OPTIONS_INVALID",
    message: "NOTE_PRESENTATION_OPTIONS_INVALID",
  });
});

test("createNoteBoardSections categorizes search results when query is provided", async () => {
  const { createNoteBoardSections } = await loadModule();
  const notes = [
    Object.freeze({ id: "note-title", title: "React Components", content: "Details", tags: [] }),
    Object.freeze({ id: "note-tag", title: "Web Dev", content: "Notes", tags: ["react", "frontend"] }),
    Object.freeze({ id: "note-japanese", title: "Kanji 漢", content: "Learning", template: "kanji", tags: ["kanji"] }),
    Object.freeze({ id: "note-content", title: "General", content: "Mentions React in body", tags: [] }),
  ];
  const notesById = new Map(notes.map((note) => [note.id, note]));
  const orderedIds = ["note-title", "note-tag", "note-japanese", "note-content"];

  const sections = createNoteBoardSections({ notesById, orderedIds, query: "react" });
  assert.deepEqual(sections, [
    { id: "title", label: "TITLE MATCHES", orderedIds: ["note-title"] },
    { id: "tags", label: "TAG MATCHES", orderedIds: ["note-tag"] },
    { id: "japanese", label: "JAPANESE STUDY", orderedIds: ["note-japanese"] },
    { id: "notes", label: "CONTENT MATCHES", orderedIds: ["note-content"] },
  ]);
});
