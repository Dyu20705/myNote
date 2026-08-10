import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  return import(new URL("../../core/kanjiInkController.js", import.meta.url));
}

const penPoints = [
  { x: 0.1, y: 0.2, t: 0 },
  { x: 0.8, y: 0.2, t: 12 },
];
const markerPoints = [
  { x: 0.2, y: 0.7, t: 0 },
  { x: 0.7, y: 0.7, t: 16 },
];

function draw(controller, points) {
  controller.beginGesture(points[0]);
  for (const point of points.slice(1)) controller.appendGesture(point);
  return controller.endGesture();
}

function canvasEntry(overrides = {}) {
  return {
    id: "ink-existing",
    noteId: "note-1",
    strokes: [{
      tool: "pen",
      width: 0.008,
      points: penPoints,
    }],
    paperStyle: "grid",
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
    schemaVersion: 2,
    ...overrides,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test("Pen is the default and Marker saves its canonical width", async () => {
  const { createKanjiInkController } = await loadModule();
  const persisted = [];
  const controller = createKanjiInkController({
    persist: async (entry) => {
      persisted.push(entry);
      return entry;
    },
    createId: () => "ink-created",
    now: () => "2026-08-09T12:00:00.000Z",
  });

  assert.equal(controller.snapshot().tool, "pen");
  assert.equal(draw(controller, penPoints), true);
  controller.selectTool("marker");
  assert.equal(draw(controller, markerPoints), true);

  await controller.save({ noteId: "note-1" });
  assert.deepEqual(persisted, [{
    id: "ink-created",
    noteId: "note-1",
    strokes: [
      { tool: "pen", width: 0.008, points: penPoints },
      { tool: "marker", width: 0.024, points: markerPoints },
    ],
    paperStyle: "grid",
    createdAt: "2026-08-09T12:00:00.000Z",
    updatedAt: "2026-08-09T12:00:00.000Z",
    schemaVersion: 2,
  }]);
});

test("Eraser removes intersecting canonical strokes without persisting eraser events", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController();
  draw(controller, penPoints);
  controller.selectTool("eraser");

  assert.equal(draw(controller, [
    { x: 0.45, y: 0.1, t: 0 },
    { x: 0.45, y: 0.3, t: 10 },
  ]), true);
  assert.deepEqual(controller.snapshot().strokes, []);
  assert.equal(controller.snapshot().tool, "eraser");

  controller.undo();
  assert.deepEqual(controller.snapshot().strokes, [{
    tool: "pen",
    width: 0.008,
    points: penPoints,
  }]);
  assert.equal(controller.redo(), true);
  assert.equal(controller.snapshot().strokes.length, 0);
});

test("Undo and Redo restore exact immutable drafts and a new edit clears Redo", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController();
  draw(controller, penPoints);
  controller.selectTool("marker");
  draw(controller, markerPoints);
  const twoStrokes = controller.snapshot().strokes;

  assert.equal(controller.undo(), true);
  assert.deepEqual(controller.snapshot().strokes, [twoStrokes[0]]);
  assert.equal(controller.redo(), true);
  assert.deepEqual(controller.snapshot().strokes, twoStrokes);
  assert.equal(controller.undo(), true);
  controller.selectTool("pen");
  draw(controller, [
    { x: 0.1, y: 0.4, t: 0 },
    { x: 0.4, y: 0.4, t: 9 },
  ]);
  assert.equal(controller.redo(), false);

  const snapshot = controller.snapshot();
  snapshot.strokes[0].points[0].x = 1;
  assert.notEqual(controller.snapshot().strokes[0].points[0].x, 1);
});

test("Clear is one undoable edit", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController();
  draw(controller, penPoints);
  const beforeClear = controller.snapshot().strokes;

  assert.equal(controller.clear(), true);
  assert.deepEqual(controller.snapshot().strokes, []);
  assert.equal(controller.undo(), true);
  assert.deepEqual(controller.snapshot().strokes, beforeClear);
  assert.equal(controller.redo(), true);
  assert.deepEqual(controller.snapshot().strokes, []);
});

test("History retains no more than 100 committed draft states", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController();

  for (let index = 0; index < 101; index += 1) {
    draw(controller, [
      { x: 0.1, y: 0.1, t: 0 },
      { x: 0.2, y: 0.2, t: index + 1 },
    ]);
    controller.clear();
  }

  for (let index = 0; index < 100; index += 1) assert.equal(controller.undo(), true);
  assert.equal(controller.undo(), false);
});

test("An untouched V2 edit is clean and closes without discard", async () => {
  const { createKanjiInkController } = await loadModule();
  const initialEntry = canvasEntry();
  const expectedStrokes = structuredClone(initialEntry.strokes);
  const controller = createKanjiInkController({ initialEntry });

  initialEntry.strokes[0].points[0].x = 1;
  assert.equal(controller.snapshot().dirty, false);
  assert.deepEqual(controller.snapshot().strokes, expectedStrokes);
  assert.deepEqual(controller.requestClose(), {
    closed: true,
    focusTarget: "opener",
  });
});

test("Requesting close commits a meaningful active gesture before confirming discard", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController();

  controller.beginGesture(penPoints[0]);
  controller.appendGesture(penPoints[1]);

  assert.deepEqual(controller.requestClose(), {
    closed: false,
    focusTarget: "keep-drawing",
  });
  assert.deepEqual(controller.snapshot().strokes, [{
    tool: "pen",
    width: 0.008,
    points: penPoints,
  }]);
  controller.keepDrawing();
  assert.equal(controller.snapshot().status, "drawing");
});

test("V1 initial entries are rejected rather than reinterpreted as V2 canvases", async () => {
  const { createKanjiInkController } = await loadModule();
  assert.throws(() => createKanjiInkController({
    initialEntry: {
      id: "ink-v1",
      noteId: "note-1",
      schemaVersion: 1,
      revision: 1,
      character: "人",
      strokes: [[{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]],
      recognizer: {
        engineId: "legacy",
        engineVersion: "1",
        datasetVersion: "1",
      },
      createdAt: "2026-08-09T00:00:00.000Z",
      updatedAt: "2026-08-09T00:00:00.000Z",
    },
  }), { code: "KANJI_CONTROLLER_OPTIONS_INVALID" });
});

test("Gesture boundaries reject excess strokes, points, total points, and elapsed time", async () => {
  const { createKanjiInkController } = await loadModule();
  const twoPoints = [
    { x: 0.1, y: 0.1, t: 0 },
    { x: 0.2, y: 0.2, t: 1 },
  ];

  const strokeBound = createKanjiInkController();
  for (let index = 0; index < 32; index += 1) assert.equal(draw(strokeBound, twoPoints), true);
  strokeBound.beginGesture(twoPoints[0]);
  strokeBound.appendGesture(twoPoints[1]);
  assert.throws(() => strokeBound.endGesture(), { code: "KANJI_INK_ENTRY_LIMIT" });

  const pointBound = createKanjiInkController();
  pointBound.beginGesture(twoPoints[0]);
  for (let index = 1; index < 256; index += 1) {
    pointBound.appendGesture({ x: 0.2, y: 0.2, t: index });
  }
  assert.throws(() => pointBound.appendGesture({ x: 0.2, y: 0.2, t: 256 }), {
    code: "KANJI_INK_ENTRY_LIMIT",
  });

  const totalBound = createKanjiInkController();
  for (let stroke = 0; stroke < 16; stroke += 1) {
    totalBound.beginGesture(twoPoints[0]);
    for (let point = 1; point < 256; point += 1) {
      totalBound.appendGesture({ x: 0.2, y: 0.2, t: point });
    }
    assert.equal(totalBound.endGesture(), true);
  }
  totalBound.beginGesture(twoPoints[0]);
  totalBound.appendGesture(twoPoints[1]);
  assert.throws(() => totalBound.endGesture(), { code: "KANJI_INK_ENTRY_LIMIT" });

  const durationBound = createKanjiInkController();
  assert.equal(draw(durationBound, [
    { x: 0.1, y: 0.1, t: 0 },
    { x: 0.2, y: 0.2, t: 600000 },
  ]), true);
  durationBound.beginGesture(twoPoints[0]);
  assert.throws(() => durationBound.appendGesture({ x: 0.2, y: 0.2, t: 600001 }), {
    code: "KANJI_INK_POINT_INVALID",
  });
});

test("A rejected thirty-third stroke leaves the bounded draft recoverable", async () => {
  const { createKanjiInkController } = await loadModule();
  const persisted = [];
  const controller = createKanjiInkController({
    persist: async (entry) => {
      persisted.push(entry);
      return entry;
    },
    createId: () => "ink-after-limit",
    now: () => "2026-08-10T00:00:00.000Z",
  });

  for (let index = 0; index < 32; index += 1) assert.equal(draw(controller, penPoints), true);
  controller.beginGesture(penPoints[0]);
  controller.appendGesture(penPoints[1]);
  assert.throws(() => controller.endGesture(), { code: "KANJI_INK_ENTRY_LIMIT" });

  assert.equal(controller.undo(), true);
  controller.selectTool("eraser");
  assert.equal(draw(controller, [
    { x: 0.1, y: 0.9, t: 0 },
    { x: 0.8, y: 0.9, t: 1 },
  ]), false);
  assert.equal(controller.clear(), true);
  controller.selectTool("pen");
  assert.equal(draw(controller, penPoints), true);
  await controller.save({ noteId: "note-1" });

  assert.equal(controller.snapshot().strokes.length, 1);
  assert.equal(persisted[0].strokes.length, 1);
});

test("Save rejects an empty canvas", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController();

  await assert.rejects(controller.save({ noteId: "note-1" }), {
    code: "KANJI_STROKES_REQUIRED",
  });
});

test("Save is single-flight and blocks every draft mutation while pending", async () => {
  const { createKanjiInkController } = await loadModule();
  const gate = deferred();
  let persistCalls = 0;
  const controller = createKanjiInkController({
    persist: async (entry) => {
      persistCalls += 1;
      await gate.promise;
      return entry;
    },
  });
  draw(controller, penPoints);

  const first = controller.save({ noteId: "note-1" });
  const second = controller.save({ noteId: "note-1" });
  assert.strictEqual(second, first);
  assert.equal(persistCalls, 1);
  for (const mutate of [
    () => controller.selectTool("marker"),
    () => controller.beginGesture({ x: 0.2, y: 0.2, t: 0 }),
    () => controller.undo(),
    () => controller.redo(),
    () => controller.clear(),
    () => controller.requestClose(),
    () => controller.keepDrawing(),
    () => controller.discardDraft(),
  ]) {
    assert.throws(mutate, { code: "KANJI_SAVE_IN_PROGRESS" });
  }

  gate.resolve();
  await first;
  assert.equal(controller.snapshot().dirty, false);
});

test("A direct retry reuses the exact prepared V2 entry without rebuilding it", async () => {
  const { createKanjiInkController } = await loadModule();
  const attempted = [];
  let createIdCalls = 0;
  let nowCalls = 0;
  const controller = createKanjiInkController({
    persist: async (entry) => {
      attempted.push(structuredClone(entry));
      if (attempted.length === 1) throw new Error("storage unavailable");
      return entry;
    },
    createId: () => `ink-${++createIdCalls}`,
    now: () => `2026-08-09T14:00:0${++nowCalls}.000Z`,
  });
  draw(controller, penPoints);

  await assert.rejects(controller.save({ noteId: "note-1" }), {
    code: "KANJI_SAVE_FAILED",
  });
  const preparedEntry = structuredClone(attempted[0]);
  await controller.retrySave();

  assert.equal(createIdCalls, 1);
  assert.equal(nowCalls, 1);
  assert.deepEqual(attempted, [preparedEntry, preparedEntry]);
});

test("Failed persistence retains exact draft, tool, and history for one V2 retry", async () => {
  const { createKanjiInkController } = await loadModule();
  const saveGate = deferred();
  let attempts = 0;
  const persisted = [];
  const controller = createKanjiInkController({
    persist: async (entry) => {
      attempts += 1;
      if (attempts === 1) throw new Error("storage unavailable");
      await saveGate.promise;
      persisted.push(entry);
      return entry;
    },
    createId: () => "ink-retry",
    now: () => "2026-08-09T13:00:00.000Z",
  });
  controller.selectTool("marker");
  draw(controller, markerPoints);
  const beforeFailure = controller.snapshot();

  await assert.rejects(controller.save({ noteId: "note-1" }), {
    code: "KANJI_SAVE_FAILED",
  });
  assert.deepEqual(controller.snapshot().strokes, beforeFailure.strokes);
  assert.equal(controller.snapshot().tool, "marker");
  assert.equal(controller.undo(), true);
  assert.equal(controller.redo(), true);

  const retry = controller.retrySave();
  assert.equal(controller.snapshot().status, "saving");
  assert.equal(controller.snapshot().dirty, true);
  assert.throws(() => controller.selectTool("pen"), { code: "KANJI_SAVE_IN_PROGRESS" });
  saveGate.resolve();
  await retry;

  assert.deepEqual(persisted, [{
    id: "ink-retry",
    noteId: "note-1",
    strokes: [{ tool: "marker", width: 0.024, points: markerPoints }],
    paperStyle: "grid",
    createdAt: "2026-08-09T13:00:00.000Z",
    updatedAt: "2026-08-09T13:00:00.000Z",
    schemaVersion: 2,
  }]);
  assert.equal(controller.snapshot().dirty, false);
});
