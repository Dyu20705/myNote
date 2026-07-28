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

test("undo rejection restores exact stack order and rethrows the original error", async () => {
  const stack = createCommandStack();
  const log = [];
  const originalError = new Error("synthetic undo failure");
  let undoAttempts = 0;
  const retryable = {
    do: async () => log.push("do-b"),
    undo: async () => {
      undoAttempts += 1;
      log.push(undoAttempts === 1 ? "undo-b-failed" : "undo-b");
      if (undoAttempts === 1) {
        throw originalError;
      }
    },
  };
  await stack.execute(loggingCommand("a", log));
  await stack.execute(retryable);
  await stack.execute(loggingCommand("c", log));
  await stack.undo();

  await assert.rejects(stack.undo(), (error) => error === originalError);
  assert.equal(stack.canUndo(), true);
  assert.equal(stack.canRedo(), true);
  assert.equal(await stack.undo(), true);
  assert.equal(await stack.redo(), true);
  assert.equal(await stack.redo(), true);
  assert.deepEqual(log, [
    "do-a",
    "do-b",
    "do-c",
    "undo-c",
    "undo-b-failed",
    "undo-b",
    "do-b",
    "do-c",
  ]);
});

test("redo rejection restores exact stack order and rethrows the original error", async () => {
  const stack = createCommandStack();
  const log = [];
  const originalError = new Error("synthetic redo failure");
  let cDoAttempts = 0;
  const retryable = {
    do: async () => {
      cDoAttempts += 1;
      log.push(cDoAttempts === 2 ? "do-c-failed" : "do-c");
      if (cDoAttempts === 2) {
        throw originalError;
      }
    },
    undo: async () => log.push("undo-c"),
  };
  await stack.execute(loggingCommand("a", log));
  await stack.execute(loggingCommand("b", log));
  await stack.execute(retryable);
  await stack.undo();

  await assert.rejects(stack.redo(), (error) => error === originalError);
  assert.equal(stack.canUndo(), true);
  assert.equal(stack.canRedo(), true);
  assert.equal(await stack.redo(), true);
  assert.equal(await stack.undo(), true);
  assert.equal(await stack.undo(), true);
  assert.deepEqual(log, [
    "do-a",
    "do-b",
    "do-c",
    "undo-c",
    "do-c-failed",
    "do-c",
    "undo-c",
    "undo-b",
  ]);
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
