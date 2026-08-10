import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKanjiSearchProjection,
  createKanjiExportBundle,
  createKanjiHumanReadableExport,
  projectNoteForKanjiSearch,
  parseKanjiExportBundle,
  renderKanjiEntrySvg,
  serializeKanjiExportBundle,
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

function makeCanvasEntry(overrides = {}) {
  return {
    id: "ink-v2",
    noteId: "note-1",
    strokes: [{
      tool: "pen",
      width: 0.008,
      points: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.2, y: 0.3, t: 12 }],
    }, {
      tool: "marker",
      width: 0.024,
      points: [{ x: 0.4, y: 0.5, t: 0 }, { x: 0.6, y: 0.7, t: 16 }],
    }],
    paperStyle: "grid",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    schemaVersion: 2,
    ...overrides,
  };
}

const note = {
  id: "note-1",
  title: "Ordinary note",
  content: "Canonical Markdown-like content",
  blocks: [
    {
      id: "block-1",
      type: "paragraph",
      content: "Canonical Markdown-like content",
      meta: {},
    },
  ],
  tags: ["daily"],
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
  pinned: false,
  archived: false,
  links: [],
  ast: [{ type: "paragraph", text: "Canonical Markdown-like content" }],
  checksum: "b272aa77",
  version: 1,
  searchBlob: "ordinary note canonical markdown-like content daily ",
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
    blocks: [
      {
        id: "block-1",
        type: "paragraph",
        content: "Canonical Markdown-like content",
        meta: {},
      },
    ],
    tags: ["daily"],
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    pinned: false,
    archived: false,
    links: [],
    ast: [{ type: "paragraph", text: "Canonical Markdown-like content" }],
    checksum: "b272aa77",
    version: 1,
    searchBlob: "ordinary note canonical markdown-like content daily ",
  });
});

test("mixed search projects only confirmed V1 characters", () => {
  const legacyV1 = makeEntry({ legacyVendorField: { raw: "keep" } });
  const canvasV2 = makeCanvasEntry();
  assert.equal(buildKanjiSearchProjection([legacyV1, canvasV2]), "人");
});

test("schema-4 mixed JSON bundle is lossless, related, and defensively cloned", () => {
  const entries = [makeEntry({ legacyVendorField: { raw: "keep" } }), makeCanvasEntry()];
  const bundle = createKanjiExportBundle([note], entries, {
    exportedAt: "2026-08-04T02:00:00.000Z",
  });

  assert.equal(bundle.schemaVersion, 4);
  assert.deepEqual(bundle.kanjiInkEntries, entries);
  assert.equal(bundle.kanjiInkEntries[0].legacyVendorField.raw, "keep");
  bundle.kanjiInkEntries[0].strokes[0][0].x = 0;
  assert.equal(entries[0].strokes[0][0].x, 0.5);
});

test("tagged schema-4 bundle JSON preserves supported V1 unknown values", () => {
  const shared = { raw: "keep" };
  const graph = { first: shared, second: shared };
  graph.self = graph;
  const legacy = makeEntry({ legacyVendorField: {
    values: new Map([["keep", new Set([1n])]]),
    bytes: new Uint8Array([7, 8]),
    missing: undefined,
    graph,
  } });
  const bundle = createKanjiExportBundle([note], [legacy], {
    exportedAt: "2026-08-04T02:00:00.000Z",
  });
  const parsed = parseKanjiExportBundle(serializeKanjiExportBundle(bundle));
  const field = parsed.kanjiInkEntries[0].legacyVendorField;
  assert.deepEqual([...field.values], [["keep", new Set([1n])]]);
  assert.deepEqual([...field.bytes], [7, 8]);
  assert.equal(field.missing, undefined);
  assert.equal(field.graph.self, field.graph);
  assert.equal(field.graph.first, field.graph.second);
  assert.equal(parsed.schemaVersion, 4);
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

test("import validation accepts schema-4 mixed bundles and exact historical schema-3 bundles", () => {
  const source = createKanjiExportBundle([note], [makeEntry({ legacyVendorField: { raw: "keep" } }), makeCanvasEntry()], {
    exportedAt: "2026-08-04T02:00:00.000Z",
  });
  const validated = validateKanjiExportBundle(source);
  assert.deepEqual(validated, source);
  validated.notes[0].title = "mutated";
  validated.kanjiInkEntries[0].strokes[0][0].x = 0;
  assert.equal(source.notes[0].title, "Ordinary note");
  assert.equal(source.kanjiInkEntries[0].strokes[0][0].x, 0.5);
  assert.equal(validated.kanjiInkEntries[0].legacyVendorField.raw, "keep");

  const legacySchema3 = { ...source, schemaVersion: 3, kanjiInkEntries: [makeEntry()] };
  assert.deepEqual(validateKanjiExportBundle(legacySchema3), legacySchema3);

  const reorderedNote = Object.fromEntries(Object.entries(note).reverse());
  const reorderedSource = createKanjiExportBundle([reorderedNote], [makeEntry()], {
    exportedAt: "2026-08-04T02:00:00.000Z",
  });
  assert.deepEqual(validateKanjiExportBundle(reorderedSource), reorderedSource);

  for (const invalid of [
    null,
    { ...source, schemaVersion: 2 },
    { ...source, extra: true },
    { ...source, exportedAt: "not-a-date" },
    { ...source, notes: [{ id: "x" }], kanjiInkEntries: [] },
    { ...source, notes: [{ ...note, checksum: "stale" }] },
    { ...source, notes: [{ ...note, unexpected: true }] },
    { ...source, notes: [note, note] },
    { ...source, kanjiInkEntries: [makeEntry({ noteId: "missing" })] },
    { ...legacySchema3, kanjiInkEntries: [makeCanvasEntry()] },
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
  assert.doesNotMatch(svg, /data-paper-style="grid"|kanji-grid/);
  assert.equal(svg.includes("<script"), false);
  assert.equal(svg.includes("onload="), false);
});

test("V2 SVG renders repeated horizontal rules and persisted tool widths", () => {
  const svg = renderKanjiEntrySvg(makeCanvasEntry(), { size: 160 });
  assert.match(svg, /data-paper-style="grid"/);
  assert.equal((svg.match(/data-paper-rule=/g) || []).length, 7);
  assert.match(svg, /x1="0" y1="20" x2="160" y2="20"/);
  assert.match(svg, /x1="0" y1="140" x2="160" y2="140"/);
  assert.doesNotMatch(svg, /<pattern|kanji-grid|x1="80" y1="0" x2="80" y2="160"/);
  assert.match(svg, /data-tool="pen"/);
  assert.match(svg, /data-tool="marker"/);
  assert.match(svg, /stroke-width="1\.28"/);
  assert.match(svg, /stroke-width="3\.84"/);
  assert.match(svg, /data-tool="pen" d="M 16 32 L 32 48"/);
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

test("V2 human-readable export does not invent recognition data", () => {
  const output = createKanjiHumanReadableExport([note], [makeCanvasEntry()]);
  assert.match(output, /Kanji drawing/);
  assert.match(output, /<svg /);
  assert.doesNotMatch(output, /Character:/);
  assert.doesNotMatch(output, /Recognizer:|Dataset:|mynote-geometric-template/);
});
