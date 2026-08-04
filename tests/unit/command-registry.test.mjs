import assert from "node:assert/strict";
import test from "node:test";

const REGISTRY_MODULE = "../../ui/commandRegistry.js";

async function createRegistry(options = {}) {
  const { createCommandRegistry } = await import(REGISTRY_MODULE);
  return createCommandRegistry(options);
}

function command(overrides = {}) {
  return {
    id: "notes.create",
    title: "New note",
    description: "Create an ordinary note",
    shortcuts: [{ key: "n", primaryModifier: true }],
    scope: "shell",
    isAvailable: () => true,
    unavailableReason: () => "",
    run: () => undefined,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    platform: "win32",
    workspace: "notes",
    activeScope: "shell",
    targetKind: "button",
    paletteOpen: false,
    modalScope: null,
    compositionActive: false,
    focusToken: "shell:notes",
    ...overrides,
  };
}

function keyEvent(overrides = {}) {
  return {
    type: "keydown",
    key: "n",
    code: "KeyN",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    ...overrides,
  };
}

function errorWithCode(code) {
  return (error) => {
    assert.equal(error?.code, code);
    assert.equal(error?.message, code);
    return true;
  };
}

function createTimerHarness() {
  let nextId = 0;
  const tasks = new Map();
  const cancelled = [];

  return {
    scheduleTimeout(callback, delay) {
      const id = ++nextId;
      tasks.set(id, { callback, delay });
      return id;
    },
    cancelTimeout(id) {
      cancelled.push(id);
      tasks.delete(id);
    },
    fireAll() {
      const pending = [...tasks.values()];
      tasks.clear();
      for (const task of pending) {
        task.callback();
      }
    },
    get size() {
      return tasks.size;
    },
    get delays() {
      return [...tasks.values()].map((task) => task.delay);
    },
    get cancelled() {
      return [...cancelled];
    },
  };
}

test("registry rejects malformed commands with stable content-free errors", async () => {
  const registry = await createRegistry();
  const hostile = "caller-secret-value";

  const invalidCommands = [
    null,
    [],
    command({ id: "" }),
    command({ id: hostile }),
    command({ title: "" }),
    command({ description: "" }),
    command({ isAvailable: null }),
    command({ unavailableReason: null }),
    command({ run: null }),
  ];

  for (const candidate of invalidCommands) {
    assert.throws(() => registry.register(candidate), errorWithCode("COMMAND_INVALID"));
  }

  assert.throws(
    () => registry.register(command({ scope: hostile })),
    errorWithCode("COMMAND_SCOPE_UNSUPPORTED"),
  );
  assert.throws(
    () => registry.register(command({ shortcuts: [{ key: "", primaryModifier: true }] })),
    errorWithCode("COMMAND_SHORTCUT_INVALID"),
  );
  assert.throws(
    () => registry.register(command({ shortcuts: [{ sequence: ["g"] }] })),
    errorWithCode("COMMAND_SHORTCUT_INVALID"),
  );
});

test("registry rejects duplicate IDs and enforces a literal command bound", async () => {
  const registry = await createRegistry({ maxCommands: 2 });
  registry.register(command());

  assert.throws(
    () => registry.register(command({ title: "Replacement" })),
    errorWithCode("COMMAND_DUPLICATE"),
  );

  registry.register(command({
    id: "notes.search",
    title: "Focus search",
    description: "Focus the note search field",
    shortcuts: [{ key: "/" }],
  }));

  assert.throws(
    () => registry.register(command({
      id: "notes.save",
      title: "Save note",
      description: "Flush the active note",
      shortcuts: [{ key: "Enter", primaryModifier: true }],
    })),
    errorWithCode("COMMAND_LIMIT"),
  );
});

test("snapshot evaluates current availability and retains unavailable commands with reasons", async () => {
  const registry = await createRegistry();
  let runCount = 0;

  registry.register(command({
    isAvailable: (current) => current.workspace === "notes",
    unavailableReason: (current) => (
      current.workspace === "notes"
        ? ""
        : "Switch to Notes workspace to create an ordinary note"
    ),
    run: () => {
      runCount += 1;
    },
  }));

  const unavailable = registry.snapshot(context({ workspace: "japanese" }));
  assert.deepEqual(unavailable, [{
    id: "notes.create",
    title: "New note",
    description: "Create an ordinary note",
    shortcuts: [{ key: "n", primaryModifier: true }],
    scope: "shell",
    available: false,
    unavailableReason: "Switch to Notes workspace to create an ordinary note",
  }]);

  const blocked = await registry.execute("notes.create", context({ workspace: "japanese" }));
  assert.deepEqual(blocked, {
    handled: true,
    executed: false,
    commandId: "notes.create",
    reason: "Switch to Notes workspace to create an ordinary note",
  });
  assert.equal(runCount, 0);

  const available = registry.snapshot(context({ workspace: "notes" }));
  assert.equal(available[0].available, true);
  assert.equal(available[0].unavailableReason, "");
  assert.equal("run" in available[0], false);
});

test("an unavailable command must expose a current actionable reason", async () => {
  const registry = await createRegistry();
  registry.register(command({
    isAvailable: () => false,
    unavailableReason: () => "",
  }));

  assert.throws(
    () => registry.snapshot(context()),
    errorWithCode("COMMAND_UNAVAILABLE_REASON_REQUIRED"),
  );
});

test("execute by ID and direct shortcut dispatch invoke the same registered run closure", async () => {
  const registry = await createRegistry();
  const calls = [];

  registry.register(command({
    run: (current) => {
      calls.push(current.source);
      return calls.length;
    },
  }));

  const direct = await registry.execute("notes.create", context({ source: "palette" }));
  const shortcut = await registry.dispatch(
    keyEvent(),
    context({ source: "shortcut" }),
  );

  assert.deepEqual(direct, {
    handled: true,
    executed: true,
    commandId: "notes.create",
    reason: "",
    value: 1,
  });
  assert.deepEqual(shortcut, {
    handled: true,
    executed: true,
    commandId: "notes.create",
    reason: "",
    value: 2,
  });
  assert.deepEqual(calls, ["palette", "shortcut"]);
});

test("text editing and IME composition suppress broad commands while editor-scoped save remains available", async () => {
  const registry = await createRegistry();
  const runs = [];

  registry.register(command({
    run: () => runs.push("create"),
  }));
  registry.register(command({
    id: "editor.save",
    title: "Save note",
    description: "Flush the active note",
    shortcuts: [{ key: "Enter", primaryModifier: true }],
    scope: "editor",
    run: () => runs.push("save"),
  }));

  for (const targetKind of ["input", "textarea", "select", "contenteditable"]) {
    const result = await registry.dispatch(
      keyEvent(),
      context({ activeScope: "editor", targetKind }),
    );
    assert.deepEqual(result, {
      handled: false,
      executed: false,
      commandId: null,
      reason: "",
    });
  }

  const composing = await registry.dispatch(
    keyEvent({ isComposing: true }),
    context({ compositionActive: true }),
  );
  assert.equal(composing.handled, false);

  const save = await registry.dispatch(
    keyEvent({ key: "Enter", code: "Enter" }),
    context({ activeScope: "editor", targetKind: "textarea" }),
  );
  assert.equal(save.commandId, "editor.save");
  assert.equal(save.executed, true);
  assert.deepEqual(runs, ["save"]);
});

test("palette and review-modal scopes isolate background commands", async () => {
  const registry = await createRegistry();
  const runs = [];

  registry.register(command({
    shortcuts: [{ key: "j" }],
    run: () => runs.push("background"),
  }));
  registry.register(command({
    id: "palette.close",
    title: "Close command palette",
    description: "Close the command palette",
    shortcuts: [{ key: "Escape" }],
    scope: "palette",
    run: () => runs.push("palette-close"),
  }));
  registry.register(command({
    id: "review.good",
    title: "Rate Good",
    description: "Rate the current review Good",
    shortcuts: [{ key: "3" }],
    scope: "review-modal",
    run: () => runs.push("review-good"),
  }));

  const paletteBackground = await registry.dispatch(
    keyEvent({ key: "j", code: "KeyJ", ctrlKey: false }),
    context({ activeScope: "palette", paletteOpen: true, focusToken: "palette" }),
  );
  assert.equal(paletteBackground.handled, false);

  const paletteClose = await registry.dispatch(
    keyEvent({ key: "Escape", code: "Escape", ctrlKey: false }),
    context({ activeScope: "palette", paletteOpen: true, focusToken: "palette" }),
  );
  assert.equal(paletteClose.commandId, "palette.close");

  const modalBackground = await registry.dispatch(
    keyEvent({ key: "j", code: "KeyJ", ctrlKey: false }),
    context({
      activeScope: "review-modal",
      modalScope: "review-modal",
      focusToken: "review:rating",
    }),
  );
  assert.equal(modalBackground.handled, false);

  const modalRating = await registry.dispatch(
    keyEvent({ key: "3", code: "Digit3", ctrlKey: false }),
    context({
      activeScope: "review-modal",
      modalScope: "review-modal",
      focusToken: "review:rating",
    }),
  );
  assert.equal(modalRating.commandId, "review.good");
  assert.deepEqual(runs, ["palette-close", "review-good"]);
});

test("gg sequence resets on an intervening key and uses one bounded timer", async () => {
  const timers = createTimerHarness();
  const registry = await createRegistry({
    sequenceTimeoutMs: 450,
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  let runCount = 0;

  registry.register(command({
    id: "notes.first",
    title: "First note",
    description: "Move to the first visible note",
    shortcuts: [{ sequence: ["g", "g"] }],
    run: () => {
      runCount += 1;
    },
  }));

  const first = await registry.dispatch(
    keyEvent({ key: "g", code: "KeyG", ctrlKey: false }),
    context(),
  );
  assert.deepEqual(first, {
    handled: true,
    executed: false,
    commandId: null,
    reason: "sequence-pending",
  });
  assert.equal(timers.size, 1);
  assert.deepEqual(timers.delays, [450]);

  const intervening = await registry.dispatch(
    keyEvent({ key: "j", code: "KeyJ", ctrlKey: false }),
    context(),
  );
  assert.equal(intervening.handled, false);
  assert.equal(timers.size, 0);

  const secondStart = await registry.dispatch(
    keyEvent({ key: "g", code: "KeyG", ctrlKey: false }),
    context(),
  );
  assert.equal(secondStart.reason, "sequence-pending");
  assert.equal(runCount, 0);

  const secondFinish = await registry.dispatch(
    keyEvent({ key: "g", code: "KeyG", ctrlKey: false }),
    context(),
  );
  assert.equal(secondFinish.commandId, "notes.first");
  assert.equal(secondFinish.executed, true);
  assert.equal(runCount, 1);
  assert.equal(timers.size, 0);
});

test("sequence state resets on timeout, context change, composition start, explicit reset, and destroy", async () => {
  const timers = createTimerHarness();
  const registry = await createRegistry({
    sequenceTimeoutMs: 450,
    scheduleTimeout: timers.scheduleTimeout,
    cancelTimeout: timers.cancelTimeout,
  });
  let runCount = 0;

  registry.register(command({
    id: "notes.first",
    title: "First note",
    description: "Move to the first visible note",
    shortcuts: [{ sequence: ["g", "g"] }],
    run: () => {
      runCount += 1;
    },
  }));

  const g = () => keyEvent({ key: "g", code: "KeyG", ctrlKey: false });

  await registry.dispatch(g(), context());
  timers.fireAll();
  await registry.dispatch(g(), context());
  assert.equal(runCount, 0);

  await registry.dispatch(g(), context({ workspace: "japanese", focusToken: "shell:japanese" }));
  assert.equal(runCount, 0);

  await registry.dispatch({ type: "compositionstart" }, context());
  await registry.dispatch(g(), context());
  assert.equal(runCount, 0);

  registry.resetSequences();
  assert.equal(timers.size, 0);

  await registry.dispatch(g(), context());
  assert.equal(timers.size, 1);
  registry.destroy();
  assert.equal(timers.size, 0);
  assert.ok(timers.cancelled.length > 0);
  assert.equal(runCount, 0);
  assert.throws(() => registry.snapshot(context()), errorWithCode("COMMAND_REGISTRY_DESTROYED"));
});

test("unregister closures remove only their own registration and cannot delete a later command", async () => {
  const registry = await createRegistry();
  const unregisterFirst = registry.register(command());

  unregisterFirst();
  assert.deepEqual(registry.snapshot(context()), []);

  registry.register(command({ title: "Later registration" }));
  unregisterFirst();
  assert.equal(registry.snapshot(context())[0].title, "Later registration");

  assert.equal(registry.unregister("notes.create"), true);
  assert.equal(registry.unregister("notes.create"), false);
  assert.deepEqual(registry.snapshot(context()), []);
});
