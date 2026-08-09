import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  return import(new URL("../../core/kanjiInkController.js", import.meta.url));
}

const pointA = { x: 0.2, y: 0.2 };
const pointB = { x: 0.8, y: 0.8 };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

test("drawing, undo, and clear mutate only the current bounded draft", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController({ recognize: () => [] });

  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  assert.equal(controller.snapshot().status, "drawing");
  assert.equal(controller.snapshot().dirty, true);
  assert.equal(controller.snapshot().strokes.length, 1);

  assert.equal(controller.undoLastStroke(), true);
  assert.equal(controller.snapshot().strokes.length, 0);
  assert.equal(controller.undoLastStroke(), false);

  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  assert.equal(controller.clear(), true);
  assert.equal(controller.snapshot().strokes.length, 0);
  assert.equal(controller.snapshot().candidates.length, 0);
  assert.equal(controller.snapshot().selectedCharacter, null);
});

test("an edit draft starts from a defensive copy of persisted strokes", async () => {
  const { createKanjiInkController } = await loadModule();
  const expectedStrokes = [[
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.8 },
  ]];
  const initialStrokes = structuredClone(expectedStrokes);
  const controller = createKanjiInkController({
    recognize: () => [],
    initialStrokes,
  });

  initialStrokes[0][0].x = 0;
  const snapshot = controller.snapshot();
  assert.equal(snapshot.status, "drawing");
  assert.equal(snapshot.dirty, true);
  assert.deepEqual(snapshot.strokes, expectedStrokes);

  snapshot.strokes[0][0].x = 1;
  assert.deepEqual(controller.snapshot().strokes, expectedStrokes);
});

test("recognition resolves candidates but never auto-selects one", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController({
    recognize: async () => [
      { character: "人", score: 0.99 },
      { character: "入", score: 0.75 },
    ],
  });
  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();

  const pending = controller.recognize();
  assert.equal(controller.snapshot().status, "recognizing");
  await pending;
  assert.equal(controller.snapshot().status, "candidates");
  assert.equal(controller.snapshot().selectedCharacter, null);
  assert.deepEqual(controller.snapshot().candidates.map((item) => item.character), ["人", "入"]);

  controller.selectCandidate("人");
  assert.equal(controller.snapshot().status, "selected");
  assert.equal(controller.snapshot().selectedCharacter, "人");
});

test("stroke mutation invalidates candidate selection and stale recognition results", async () => {
  const { createKanjiInkController } = await loadModule();
  const first = deferred();
  const second = deferred();
  let invocation = 0;
  const controller = createKanjiInkController({
    recognize: () => (++invocation === 1 ? first.promise : second.promise),
  });

  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  const firstRequest = controller.recognize();

  controller.beginStroke({ x: 0.1, y: 0.8 });
  controller.appendPoint({ x: 0.9, y: 0.2 });
  controller.endStroke();
  const secondRequest = controller.recognize();

  first.resolve([{ character: "人", score: 1 }]);
  await firstRequest;
  assert.equal(controller.snapshot().status, "recognizing");
  assert.equal(controller.snapshot().candidates.length, 0);

  second.resolve([{ character: "木", score: 0.9 }]);
  await secondRequest;
  controller.selectCandidate("木");
  assert.equal(controller.snapshot().selectedCharacter, "木");

  controller.undoLastStroke();
  assert.equal(controller.snapshot().selectedCharacter, null);
  assert.equal(controller.snapshot().candidates.length, 0);
  assert.equal(controller.snapshot().status, "drawing");
});

test("recognition failure preserves strokes and supports retry", async () => {
  const { createKanjiInkController } = await loadModule();
  let shouldFail = true;
  const controller = createKanjiInkController({
    recognize: async () => {
      if (shouldFail) {
        throw new Error("engine details");
      }
      return [{ character: "八", score: 0.8 }];
    },
  });
  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();

  await controller.recognize();
  assert.equal(controller.snapshot().status, "error");
  assert.equal(controller.snapshot().errorCode, "KANJI_RECOGNITION_FAILED");
  assert.equal(controller.snapshot().strokes.length, 1);

  shouldFail = false;
  await controller.retryRecognition();
  assert.equal(controller.snapshot().status, "candidates");
  assert.equal(controller.snapshot().candidates[0].character, "八");
});

test("dirty close confirms discard while clean cancel closes with focus intent", async () => {
  const { createKanjiInkController } = await loadModule();
  const controller = createKanjiInkController({ recognize: () => [] });

  assert.deepEqual(controller.requestClose(), {
    closed: true,
    focusTarget: "opener",
  });

  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  assert.deepEqual(controller.requestClose(), {
    closed: false,
    focusTarget: "keep-drawing",
  });
  assert.equal(controller.snapshot().status, "confirm-discard");

  controller.keepDrawing();
  assert.equal(controller.snapshot().status, "drawing");
  controller.requestClose();
  assert.deepEqual(controller.discardDraft(), {
    closed: true,
    focusTarget: "opener",
  });
  assert.equal(controller.snapshot().dirty, false);
  assert.equal(controller.snapshot().strokes.length, 0);
});

test("save requires explicit selection and persists before committed state", async () => {
  const { createKanjiInkController } = await loadModule();
  const persisted = [];
  const saveGate = deferred();
  const controller = createKanjiInkController({
    recognize: async () => [{ character: "人", score: 1 }],
    persist: async (entry) => {
      persisted.push(entry);
      await saveGate.promise;
      return entry;
    },
    createId: () => "ink-created",
    now: () => "2026-08-04T02:03:04.000Z",
  });
  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  await controller.recognize();

  await assert.rejects(() => controller.save({ noteId: "note-1" }), {
    code: "KANJI_CANDIDATE_REQUIRED",
  });

  controller.selectCandidate("人");
  const saving = controller.save({ noteId: "note-1" });
  assert.equal(controller.snapshot().status, "saving");
  assert.equal(controller.snapshot().dirty, true);
  assert.equal(persisted.length, 1);

  saveGate.resolve();
  const result = await saving;
  assert.equal(result.id, "ink-created");
  assert.equal(controller.snapshot().status, "idle");
  assert.equal(controller.snapshot().dirty, false);
  assert.equal(controller.snapshot().savedEntry.id, "ink-created");
});

test("failed save preserves exact draft and exposes retry state", async () => {
  const { createKanjiInkController } = await loadModule();
  let fail = true;
  const controller = createKanjiInkController({
    recognize: async () => [{ character: "木", score: 1 }],
    persist: async (entry) => {
      if (fail) throw new Error("storage details");
      return entry;
    },
  });
  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  await controller.recognize();
  controller.selectCandidate("木");

  await assert.rejects(() => controller.save({ noteId: "note-1" }), {
    code: "KANJI_SAVE_FAILED",
  });
  assert.equal(controller.snapshot().status, "error");
  assert.equal(controller.snapshot().errorCode, "KANJI_SAVE_FAILED");
  assert.equal(controller.snapshot().selectedCharacter, "木");
  assert.equal(controller.snapshot().strokes.length, 1);

  fail = false;
  const saved = await controller.retrySave({ noteId: "note-1" });
  assert.equal(saved.character, "木");
  assert.equal(controller.snapshot().dirty, false);
});

test("save is single-flight and draft mutation is blocked while persistence is pending", async () => {
  const { createKanjiInkController } = await loadModule();

  const gate = deferred();
  let persistCalls = 0;
  let idCalls = 0;

  const controller = createKanjiInkController({
    recognize: async () => [
      { character: "人", score: 1 },
    ],
    persist: async (entry) => {
      persistCalls += 1;
      await gate.promise;
      return entry;
    },
    createId: () => `ink-${++idCalls}`,
    now: () => "2026-08-07T15:00:00.000Z",
  });

  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();

  await controller.recognize();
  controller.selectCandidate("人");

  const first = controller.save({ noteId: "note-1" });
  const second = controller.save({ noteId: "note-1" });

  assert.strictEqual(first, second);
  assert.equal(persistCalls, 1);
  assert.equal(idCalls, 1);
  assert.equal(controller.snapshot().status, "saving");

  assert.throws(
    () => controller.beginStroke({ x: 0.1, y: 0.1 }),
    { code: "KANJI_SAVE_IN_PROGRESS" },
  );

  assert.throws(
    () => controller.clear(),
    { code: "KANJI_SAVE_IN_PROGRESS" },
  );

  gate.resolve();

  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(firstResult.id, "ink-1");
  assert.equal(secondResult.id, "ink-1");
  assert.equal(persistCalls, 1);
  assert.equal(idCalls, 1);

  assert.equal(controller.snapshot().status, "idle");
  assert.equal(controller.snapshot().dirty, false);
});

test("save publishes its single-flight promise before injected callbacks can re-enter", async () => {
  const { createKanjiInkController } = await loadModule();

  for (const reentryHook of ["createId", "now", "persist"]) {
    const gate = deferred();
    let controller;
    let reentrantSave;
    let didReenter = false;
    let persistCalls = 0;
    let idCalls = 0;
    let nowCalls = 0;
    const callbackStatuses = [];

    function reenterFrom(hook) {
      if (hook !== reentryHook || didReenter) return;
      didReenter = true;
      reentrantSave = controller.save({ noteId: "note-reentrant" });
    }

    controller = createKanjiInkController({
      recognize: async () => [{ character: "人", score: 1 }],
      persist: async (entry) => {
        persistCalls += 1;
        callbackStatuses.push(["persist", controller.snapshot().status]);
        reenterFrom("persist");
        await gate.promise;
        return entry;
      },
      createId: () => {
        idCalls += 1;
        callbackStatuses.push(["createId", controller.snapshot().status]);
        reenterFrom("createId");
        return `ink-${idCalls}`;
      },
      now: () => {
        nowCalls += 1;
        callbackStatuses.push(["now", controller.snapshot().status]);
        reenterFrom("now");
        return "2026-08-07T15:00:00.000Z";
      },
    });

    controller.beginStroke(pointA);
    controller.appendPoint(pointB);
    controller.endStroke();
    await controller.recognize();
    controller.selectCandidate("人");

    const first = controller.save({ noteId: "note-1" });

    assert.strictEqual(reentrantSave, first, `${reentryHook} re-entry must join the first save`);
    assert.equal(persistCalls, 1);
    assert.equal(idCalls, 1);
    assert.equal(nowCalls, 1);
    assert.equal(controller.snapshot().status, "saving");
    assert.deepEqual(callbackStatuses, [
      ["now", "saving"],
      ["createId", "saving"],
      ["persist", "saving"],
    ]);

    gate.resolve();
    assert.equal((await first).id, "ink-1");
  }
});

test("every public draft transition is locked during save and a failed draft retries intact", async () => {
  const { createKanjiInkController } = await loadModule();
  const firstGate = deferred();
  const retryGate = deferred();
  const gates = [firstGate, retryGate];
  let persistCalls = 0;

  const controller = createKanjiInkController({
    recognize: async () => [{ character: "木", score: 1 }],
    persist: async (entry) => {
      const gate = gates[persistCalls++];
      await gate.promise;
      return entry;
    },
  });

  controller.beginStroke(pointA);
  controller.appendPoint(pointB);
  controller.endStroke();
  await controller.recognize();
  controller.selectCandidate("木");

  const saving = controller.save({ noteId: "note-1" });
  const pendingSnapshot = controller.snapshot();
  const synchronousMutations = [
    () => controller.beginStroke(pointA),
    () => controller.appendPoint(pointB),
    () => controller.endStroke(),
    () => controller.undoLastStroke(),
    () => controller.clear(),
    () => controller.selectCandidate("木"),
    () => controller.requestClose(),
    () => controller.keepDrawing(),
    () => controller.discardDraft(),
  ];

  for (const mutate of synchronousMutations) {
    assert.throws(mutate, { code: "KANJI_SAVE_IN_PROGRESS" });
  }
  await assert.rejects(
    () => controller.recognize(),
    { code: "KANJI_SAVE_IN_PROGRESS" },
  );
  assert.deepEqual(controller.snapshot(), pendingSnapshot);

  firstGate.reject(new Error("storage details"));
  await assert.rejects(() => saving, { code: "KANJI_SAVE_FAILED" });
  assert.equal(controller.snapshot().selectedCharacter, "木");
  assert.deepEqual(controller.snapshot().strokes, [[pointA, pointB]]);

  const retry = controller.retrySave();
  assert.equal(controller.snapshot().status, "saving");
  retryGate.resolve();
  assert.equal((await retry).character, "木");
  assert.equal(persistCalls, 2);
  assert.equal(controller.snapshot().dirty, false);
});
