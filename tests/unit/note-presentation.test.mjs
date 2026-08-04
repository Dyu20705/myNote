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
