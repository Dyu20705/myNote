import assert from "node:assert/strict";
import test from "node:test";
import { createCommandStack } from "../../core/commandStack.js";

function loggingCommand(name, log) {
  return {
    do: async () => log.push(`do-${name}`),
    undo: async () => log.push(`undo-${name}`),
  };
}

test("empty command stack undo and redo return false", async () => {
  const stack = createCommandStack();

  assert.equal(await stack.undo(), false);
  assert.equal(await stack.redo(), false);
});

test("successful commands move between undo and redo stacks in LIFO order", async () => {
  const log = [];
  const stack = createCommandStack();
  await stack.execute(loggingCommand("a", log));
  await stack.execute(loggingCommand("b", log));

  assert.equal(await stack.undo(), true);
  assert.equal(await stack.redo(), true);

  assert.deepEqual(log, ["do-a", "do-b", "undo-b", "do-b"]);
  assert.equal(stack.canUndo(), true);
  assert.equal(stack.canRedo(), false);
});

test("a new successful command after undo invalidates redo", async () => {
  const stack = createCommandStack();
  const log = [];
  await stack.execute(loggingCommand("a", log));
  await stack.undo();
  assert.equal(stack.canRedo(), true);

  await stack.execute(loggingCommand("b", log));

  assert.equal(stack.canRedo(), false);
  assert.equal(await stack.redo(), false);
});

test("failed execute leaves undo and redo availability unchanged", async () => {
  const stack = createCommandStack();
  await stack.execute({ do: async () => {}, undo: async () => {} });
  await stack.undo();
  assert.equal(stack.canUndo(), false);
  assert.equal(stack.canRedo(), true);

  await assert.rejects(
    stack.execute({
      do: async () => { throw new Error("synthetic execute failure"); },
      undo: async () => {},
    }),
    /synthetic execute failure/,
  );

  assert.equal(stack.canUndo(), false);
  assert.equal(stack.canRedo(), true);
});

test("undo rejection preserves retryability", async () => {
  const stack = createCommandStack();
  let attempts = 0;
  await stack.execute({
    do: async () => {},
    undo: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("synthetic undo failure");
      }
    },
  });

  await assert.rejects(stack.undo(), /synthetic undo failure/);
  assert.equal(stack.canUndo(), true);
  assert.equal(stack.canRedo(), false);
  assert.equal(await stack.undo(), true);
  assert.equal(stack.canRedo(), true);
});

test("redo rejection preserves retryability", async () => {
  const stack = createCommandStack();
  let doAttempts = 0;
  const command = {
    do: async () => {
      doAttempts += 1;
      if (doAttempts === 2) {
        throw new Error("synthetic redo failure");
      }
    },
    undo: async () => {},
  };
  await stack.execute(command);
  await stack.undo();

  await assert.rejects(stack.redo(), /synthetic redo failure/);
  assert.equal(stack.canUndo(), false);
  assert.equal(stack.canRedo(), true);
  assert.equal(await stack.redo(), true);
  assert.equal(stack.canUndo(), true);
});

test("command stack bound evicts the oldest command without changing order", async () => {
  const log = [];
  const stack = createCommandStack(2);
  await stack.execute(loggingCommand("a", log));
  await stack.execute(loggingCommand("b", log));
  await stack.execute(loggingCommand("c", log));
  log.length = 0;

  await stack.undo();
  await stack.undo();
  assert.equal(await stack.undo(), false);

  assert.deepEqual(log, ["undo-c", "undo-b"]);
});
