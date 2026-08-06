import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKanjiSearchProjection,
  createKanjiExportBundle,
  createKanjiHumanReadableExport,
  projectNoteForKanjiSearch,
  renderKanjiEntrySvg,
  validateKanjiExportBundle,
} from "../../core/kanjiInkProjection.js";

function makeEntry(overrides = {}) {
  return {
    id: "ink-1",
    noteId: "note-1",
    schemaVersion: 1,
    revision: 1,
    character: "人",
    strokes: [
      [{ x: 0.5, y: 0.1 }, { x: 0.2, y: 0.9 }],
      [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.9 }],
    ],
    recognizer: {
      engineId: "mynote-geometric-template",
      engineVersion: "1.0.0",
      datasetVersion: "mynote-kanji-mvp-1",
    },
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

const note = {
  id: "note-1",
  title: "Ordinary note",
  content: "Canonical Markdown-like content",
  tags: ["daily"],
  links: [],
  updatedAt: "2026-08-04T00:00:00.000Z",
};

test("search projection is bounded Unicode text with no vector payload", () => {
  const entries = [
    makeEntry(),
    makeEntry({ id: "ink-2", character: "木" }),
    makeEntry({ id: "ink-3", character: "人" }),
  ];
  assert.equal(buildKanjiSearchProjection(entries), "人 木");

  const projected = projectNoteForKanjiSearch(note, entries);
  assert.equal(projected.id, note.id);
  assert.match(projected.searchBlob, /人 木/u);
  assert.equal(projected.searchBlob.includes("strokes"), false);
  assert.equal(projected.searchBlob.includes("0.9"), false);
  assert.deepEqual(note, {
    id: "note-1",
    title: "Ordinary note",
    content: "Canonical Markdown-like content",
    tags: ["daily"],
    links: [],
    updatedAt: "2026-08-04T00:00:00.000Z",
  });
});

test("JSON bundle is lossless, versioned, related, and defensively cloned", () => {
  const entries = [makeEntry()];
  const bundle = createKanjiExportBundle([note], entries, {
    exportedAt: "2026-08-04T02:00:00.000Z",
  });

  assert.deepEqual(bundle, {
    schemaVersion: 3,
    exportedAt: "2026-08-04T02:00:00.000Z",
    notes: [note],
    kanjiInkEntries: entries,
    recognizerAttribution: {
      engineId: "mynote-geometric-template",
      engineVersion: "1.0.0",
      datasetVersion: "mynote-kanji-mvp-1",
      source: "Project-owned geometric templates; no third-party runtime dataset.",
    },
  });
  bundle.kanjiInkEntries[0].strokes[0][0].x = 0;
  assert.equal(entries[0].strokes[0][0].x, 0.5);
});

test("export rejects duplicate IDs and orphan entries before output", () => {
  assert.throws(
    () => createKanjiExportBundle([note], [makeEntry(), makeEntry()]),
    { code: "KANJI_EXPORT_INVALID" },
  );
  assert.throws(
    () => createKanjiExportBundle([note], [makeEntry({ noteId: "missing" })]),
    { code: "KANJI_EXPORT_INVALID" },
  );
});

test("import validation accepts only an exact lossless v3 export bundle", () => {
  const source = createKanjiExportBundle([note], [makeEntry()], {
    exportedAt: "2026-08-04T02:00:00.000Z",
  });
  const validated = validateKanjiExportBundle(source);
  assert.deepEqual(validated, source);
  validated.notes[0].title = "mutated";
  validated.kanjiInkEntries[0].strokes[0][0].x = 0;
  assert.equal(source.notes[0].title, "Ordinary note");
  assert.equal(source.kanjiInkEntries[0].strokes[0][0].x, 0.5);

  for (const invalid of [
    null,
    { ...source, schemaVersion: 2 },
    { ...source, extra: true },
    { ...source, exportedAt: "not-a-date" },
    { ...source, notes: [note, note] },
    { ...source, kanjiInkEntries: [makeEntry({ noteId: "missing" })] },
    { ...source, recognizerAttribution: { ...source.recognizerAttribution, source: "" } },
  ]) {
    assert.throws(() => validateKanjiExportBundle(invalid), {
      code: "KANJI_IMPORT_INVALID",
      message: "KANJI_IMPORT_INVALID",
    });
  }
});

test("SVG export derives bounded paths without embedding executable markup", () => {
  const svg = renderKanjiEntrySvg(makeEntry(), { size: 160 });
  assert.match(svg, /^<svg /);
  assert.match(svg, /viewBox="0 0 160 160"/);
  assert.match(svg, /<path d="M 80 16 L 32 144"/);
  assert.equal(svg.includes("<script"), false);
  assert.equal(svg.includes("onload="), false);
});

test("human-readable export preserves text, drawing, ownership, and attribution", () => {
  const output = createKanjiHumanReadableExport([note], [makeEntry()]);
  assert.match(output, /# Kanji handwriting export/);
  assert.match(output, /Ordinary note/);
  assert.match(output, /Note ID: `note-1`/);
  assert.match(output, /Character: 人/u);
  assert.match(output, /<svg /);
  assert.match(output, /Project-owned geometric templates/);
  assert.equal(output.includes("Canonical Markdown-like content"), false);
});
