import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  return import(new URL("../../core/kanjiInkEntry.js", import.meta.url));
}

function validEntry(overrides = {}) {
  return {
    id: "ink-1",
    noteId: "note-1",
    schemaVersion: 1,
    revision: 1,
    character: "人",
    strokes: [
      [{ x: 0.55, y: 0.1 }, { x: 0.4, y: 0.6 }, { x: 0.2, y: 0.9 }],
      [{ x: 0.55, y: 0.1 }, { x: 0.7, y: 0.6 }, { x: 0.9, y: 0.9 }],
    ],
    recognizer: {
      engineId: "mynote-geometric-template",
      engineVersion: "1.0.0",
      datasetVersion: "mynote-kanji-mvp-1",
      selectedRank: 0,
    },
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

test("valid entry is defensively cloned with exact versioned shape", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const source = validEntry();
  const validated = validateKanjiInkEntry(source);

  assert.deepEqual(validated, source);
  assert.notEqual(validated, source);
  assert.notEqual(validated.strokes, source.strokes);
  assert.notEqual(validated.strokes[0], source.strokes[0]);
  source.strokes[0][0].x = 0;
  assert.equal(validated.strokes[0][0].x, 0.55);
});

test("entry requires one Han character, normalized points, and bounded selected-rank provenance", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  for (const entry of [
    validEntry({ character: "" }),
    validEntry({ character: "AB" }),
    validEntry({ character: "a" }),
    validEntry({ strokes: [] }),
    validEntry({ strokes: [[{ x: 0.5, y: 0.5 }]] }),
    validEntry({ strokes: [[{ x: -0.1, y: 0 }, { x: 0.5, y: 0.5 }]] }),
    validEntry({ strokes: [[{ x: Number.NaN, y: 0 }, { x: 0.5, y: 0.5 }]] }),
    validEntry({ strokes: [[{ x: 0.5, y: 1.1 }, { x: 0.5, y: 0.5 }]] }),
    validEntry({ recognizer: { ...validEntry().recognizer, selectedRank: -1 } }),
    validEntry({ recognizer: { ...validEntry().recognizer, selectedRank: 8 } }),
    validEntry({ recognizer: { ...validEntry().recognizer, selectedRank: 0.5 } }),
  ]) {
    assert.throws(() => validateKanjiInkEntry(entry), {
      code: "KANJI_INK_ENTRY_INVALID",
      message: "KANJI_INK_ENTRY_INVALID",
    });
  }
});

test("legacy schema-v1 records without selectedRank remain readable", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const legacy = validEntry();
  delete legacy.recognizer.selectedRank;
  assert.deepEqual(validateKanjiInkEntry(legacy), legacy);
});

test("literal stroke and point bounds reject oversized records", async () => {
  const {
    KANJI_INK_LIMITS,
    validateKanjiInkEntry,
  } = await loadModule();

  assert.deepEqual(KANJI_INK_LIMITS, {
    maxStrokes: 32,
    maxPointsPerStroke: 256,
    maxTotalPoints: 4096,
    maxSerializedBytes: 262144,
  });

  const stroke = Array.from({ length: 257 }, (_, index) => ({
    x: index / 256,
    y: index / 256,
  }));
  assert.throws(() => validateKanjiInkEntry(validEntry({ strokes: [stroke] })), {
    code: "KANJI_INK_ENTRY_LIMIT",
  });

  const tooManyStrokes = Array.from({ length: 33 }, () => [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ]);
  assert.throws(() => validateKanjiInkEntry(validEntry({ strokes: tooManyStrokes })), {
    code: "KANJI_INK_ENTRY_LIMIT",
  });
});

test("hostile prototypes and getters become content-free errors", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const inherited = Object.create(validEntry());
  assert.throws(() => validateKanjiInkEntry(inherited), {
    code: "KANJI_INK_ENTRY_INVALID",
  });

  const hostile = validEntry();
  Object.defineProperty(hostile, "strokes", {
    enumerable: true,
    get() {
      throw new Error("secret caller content");
    },
  });
  assert.throws(() => validateKanjiInkEntry(hostile), (error) => (
    error.code === "KANJI_INK_ENTRY_INVALID"
    && error.message === "KANJI_INK_ENTRY_INVALID"
    && !error.message.includes("secret")
  ));
});

test("create and serialize preserve exact normalized vectors without base64", async () => {
  const {
    createKanjiInkEntry,
    serializeKanjiInkEntry,
  } = await loadModule();

  const entry = createKanjiInkEntry({
    id: "ink-new",
    noteId: "note-new",
    character: "木",
    strokes: validEntry().strokes,
    recognizer: validEntry().recognizer,
    timestamp: "2026-08-04T01:02:03.000Z",
  });
  const serialized = serializeKanjiInkEntry(entry);
  const parsed = JSON.parse(serialized);

  assert.equal(entry.schemaVersion, 1);
  assert.equal(entry.revision, 1);
  assert.equal(entry.recognizer.selectedRank, 0);
  assert.equal(entry.createdAt, "2026-08-04T01:02:03.000Z");
  assert.deepEqual(parsed, entry);
  assert.doesNotMatch(serialized, /data:image|base64/i);
});

test("versioned import bundle validates every entry atomically", async () => {
  const { validateKanjiImportBundle } = await loadModule();
  const bundle = {
    schemaVersion: 3,
    kanjiInkEntries: [validEntry(), validEntry({ id: "ink-2", character: "木" })],
  };

  const validated = validateKanjiImportBundle(bundle);
  assert.deepEqual(validated, bundle);
  assert.notEqual(validated.kanjiInkEntries, bundle.kanjiInkEntries);

  assert.throws(() => validateKanjiImportBundle({
    schemaVersion: 3,
    kanjiInkEntries: [validEntry(), validEntry({ id: "ink-2", character: "x" })],
  }), {
    code: "KANJI_IMPORT_INVALID",
  });
});
