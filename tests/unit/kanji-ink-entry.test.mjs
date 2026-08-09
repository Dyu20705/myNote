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

function canvasV2(overrides = {}) {
  return {
    id: "ink-v2",
    noteId: "note-1",
    strokes: [{
      tool: "pen",
      width: 0.008,
      points: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.2, y: 0.3, t: 12 }],
    }],
    paperStyle: "grid",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    schemaVersion: 2,
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

test("V1 preserves unknown own data fields through a defensive clone", async () => {
  const { validateKanjiInkEntry, validateKanjiInkEntryV1 } = await loadModule();
  const legacy = validEntry({ legacyVendorField: { raw: "keep" } });

  const validated = validateKanjiInkEntry(legacy);
  assert.deepEqual(validated, legacy);
  assert.deepEqual(validateKanjiInkEntryV1(legacy), legacy);
  assert.notEqual(validated.legacyVendorField, legacy.legacyVendorField);
  legacy.legacyVendorField.raw = "mutated";
  assert.equal(validated.legacyVendorField.raw, "keep");
});

test("V1 preserves an own __proto__ data field without prototype pollution", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const legacy = validEntry();
  Object.defineProperty(legacy, "__proto__", {
    enumerable: true,
    value: { raw: "keep" },
  });

  const validated = validateKanjiInkEntry(legacy);
  assert.equal(Object.hasOwn(validated, "__proto__"), true);
  assert.deepEqual(validated.__proto__, { raw: "keep" });
  assert.equal(Object.getPrototypeOf(validated), Object.prototype);
  legacy.__proto__.raw = "mutated";
  assert.equal(validated.__proto__.raw, "keep");
});

test("V1 preserves supported structured-cloneable unknown values", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const capturedAt = new Date("2026-08-09T00:00:00.000Z");
  const legacy = validEntry({
    legacyVendorField: {
      capturedAt,
      metadata: new Map([["raw", { keep: true }]]),
      flags: new Set(["keep"]),
      missing: undefined,
    },
  });

  const validated = validateKanjiInkEntry(legacy);
  const field = validated.legacyVendorField;
  assert.equal(field.capturedAt.getTime(), capturedAt.getTime());
  assert.notEqual(field.capturedAt, capturedAt);
  assert.deepEqual([...field.metadata], [["raw", { keep: true }]]);
  assert.notEqual(field.metadata, legacy.legacyVendorField.metadata);
  assert.deepEqual([...field.flags], ["keep"]);
  assert.equal(Object.hasOwn(field, "missing"), true);
  assert.equal(field.missing, undefined);
  legacy.legacyVendorField.metadata.get("raw").keep = false;
  assert.equal(field.metadata.get("raw").keep, true);
});

test("V1 rejects cyclic, hostile, and unsupported unknown values content-free", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const cyclic = {};
  cyclic.self = cyclic;
  const hostile = Object.create({ inherited: true });
  for (const legacyVendorField of [cyclic, hostile, () => "unsupported"]) {
    assert.throws(() => validateKanjiInkEntry(validEntry({ legacyVendorField })), (error) => (
      error.code === "KANJI_INK_ENTRY_INVALID"
      && error.message === "KANJI_INK_ENTRY_INVALID"
    ));
  }
});

test("V2 accepts only the exact bounded saved-grid canvas shape", async () => {
  const {
    KANJI_INK_WIDTHS,
    createKanjiInkEntryV2,
    validateKanjiInkEntry,
    validateKanjiInkEntryV2,
  } = await loadModule();
  const source = canvasV2();
  const validated = validateKanjiInkEntry(source);

  assert.deepEqual(KANJI_INK_WIDTHS, { pen: 0.008, marker: 0.024 });
  assert.deepEqual(validated, source);
  assert.deepEqual(validateKanjiInkEntryV2(source), source);
  assert.notEqual(validated.strokes, source.strokes);
  source.strokes[0].points[0].x = 0.9;
  assert.equal(validated.strokes[0].points[0].x, 0.1);
  assert.deepEqual(createKanjiInkEntryV2({
    id: "ink-v2-created",
    noteId: "note-1",
    strokes: canvasV2().strokes,
    timestamp: "2026-08-09T00:00:00.000Z",
  }), canvasV2({ id: "ink-v2-created" }));
});

test("V2 rejects invalid tools, timings, exact-shape violations, and size bounds", async () => {
  const { KANJI_INK_LIMITS, validateKanjiInkEntry } = await loadModule();
  const invalid = [
    canvasV2({ strokes: [{ ...canvasV2().strokes[0], tool: "eraser" }] }),
    canvasV2({ strokes: [{ ...canvasV2().strokes[0], width: 0.01 }] }),
    canvasV2({ strokes: [{ ...canvasV2().strokes[0], points: [{ x: 0.1, y: 0.2, t: -1 }, { x: 0.2, y: 0.3, t: 12 }] }] }),
    canvasV2({ strokes: [{ ...canvasV2().strokes[0], points: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.2, y: 0.3, t: 600001 }] }] }),
    canvasV2({ strokes: [{ ...canvasV2().strokes[0], points: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.2, y: 0.3, t: 11 }, { x: 0.3, y: 0.4, t: 10 }] }] }),
    canvasV2({ extra: true }),
    canvasV2({ strokes: [] }),
  ];
  for (const entry of invalid) {
    assert.throws(() => validateKanjiInkEntry(entry), { code: "KANJI_INK_ENTRY_INVALID" });
  }

  const pointLimited = Array.from({ length: 257 }, (_, index) => ({
    x: index / 256,
    y: index / 256,
    t: index,
  }));
  const strokeLimited = Array.from({ length: 33 }, () => canvasV2().strokes[0]);
  const totalLimited = Array.from({ length: 32 }, () => ({
    tool: "pen",
    width: 0.008,
    points: Array.from({ length: 129 }, (_, index) => ({ x: 0.1, y: 0.2, t: index })),
  }));
  const bytesLimited = validEntry({
    legacyVendorField: { raw: "x".repeat(KANJI_INK_LIMITS.maxSerializedBytes) },
  });
  for (const entry of [
    canvasV2({ strokes: [{ ...canvasV2().strokes[0], points: pointLimited }] }),
    canvasV2({ strokes: strokeLimited }),
    canvasV2({ strokes: totalLimited }),
    bytesLimited,
  ]) {
    assert.throws(() => validateKanjiInkEntry(entry), { code: "KANJI_INK_ENTRY_LIMIT" });
  }
});

test("V2 accepts the exact 4,096-point capacity under canonical JSON size measurement", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const strokes = Array.from({ length: 32 }, (_, strokeIndex) => ({
    tool: "pen",
    width: 0.008,
    points: Array.from({ length: 128 }, (_, pointIndex) => ({
      x: (strokeIndex * 128 + pointIndex) / 4096,
      y: 0.123456789012345,
      t: pointIndex,
    })),
  }));
  const validated = validateKanjiInkEntry(canvasV2({ strokes }));
  assert.equal(validated.strokes.length, 32);
  assert.equal(validated.strokes.flatMap((stroke) => stroke.points).length, 4096);
});

test("V1 unknown fields reject hostile getters without leaking caller content", async () => {
  const { validateKanjiInkEntry } = await loadModule();
  const legacy = validEntry({ legacyVendorField: { raw: "keep" } });
  Object.defineProperty(legacy, "legacyVendorField", {
    enumerable: true,
    get() {
      throw new Error("secret caller content");
    },
  });
  assert.throws(() => validateKanjiInkEntry(legacy), (error) => (
    error.code === "KANJI_INK_ENTRY_INVALID"
    && error.message === "KANJI_INK_ENTRY_INVALID"
    && !error.message.includes("secret")
  ));
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
    maxStrokeDurationMs: 600000,
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
    parseKanjiInkEntry,
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
  const parsed = parseKanjiInkEntry(serialized);

  assert.equal(entry.schemaVersion, 1);
  assert.equal(entry.revision, 1);
  assert.equal(entry.recognizer.selectedRank, 0);
  assert.equal(entry.createdAt, "2026-08-04T01:02:03.000Z");
  assert.deepEqual(parsed, entry);
  assert.doesNotMatch(serialized, /data:image|base64/i);
});

test("tagged entry JSON round-trips every supported V1 unknown value without tag collisions", async () => {
  const { parseKanjiInkEntry, serializeKanjiInkEntry } = await loadModule();
  const buffer = new ArrayBuffer(4);
  new Uint8Array(buffer).set([1, 2, 3, 4]);
  const expression = /keep/gi;
  expression.lastIndex = 2;
  const legacy = validEntry({
    legacyVendorField: {
      map: new Map([["keep", new Set(["set"])]]),
      missing: undefined,
      count: 42n,
      expression,
      buffer,
      view: new DataView(buffer, 1, 2),
      bytes: new Uint8Array([5, 6, 7]),
      ordinaryTagLikeData: { type: "map", entries: "ordinary user data" },
    },
  });
  Object.defineProperty(legacy, "__proto__", {
    enumerable: true,
    value: { raw: "keep" },
  });

  const parsed = parseKanjiInkEntry(serializeKanjiInkEntry(legacy));
  const field = parsed.legacyVendorField;
  assert.deepEqual([...field.map], [["keep", new Set(["set"])]]);
  assert.equal(field.missing, undefined);
  assert.equal(field.count, 42n);
  assert.equal(field.expression.source, "keep");
  assert.equal(field.expression.flags, "gi");
  assert.equal(field.expression.lastIndex, 2);
  assert.deepEqual([...new Uint8Array(field.buffer)], [1, 2, 3, 4]);
  assert.deepEqual([field.view.getUint8(0), field.view.getUint8(1)], [2, 3]);
  assert.deepEqual([...field.bytes], [5, 6, 7]);
  assert.deepEqual(field.ordinaryTagLikeData, { type: "map", entries: "ordinary user data" });
  assert.equal(Object.hasOwn(parsed, "__proto__"), true);
  assert.deepEqual(parsed.__proto__, { raw: "keep" });
  assert.deepEqual(parseKanjiInkEntry(serializeKanjiInkEntry(canvasV2())), canvasV2());
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
