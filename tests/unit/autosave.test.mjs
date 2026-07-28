import assert from "node:assert/strict";
import test from "node:test";
import { createAutosave } from "../../core/autosave.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createFakeScheduler() {
  let nextId = 1;
  const timers = new Map();
  const idle = new Map();

  return {
    setTimeout(callback) {
      const id = nextId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    requestIdle(callback) {
      const id = nextId++;
      idle.set(id, callback);
      return id;
    },
    cancelIdle(id) {
      idle.delete(id);
    },
    runTimer() {
      const entry = timers.entries().next().value;
      if (!entry) {
        return false;
      }
      const [id, callback] = entry;
      timers.delete(id);
      callback();
      return true;
    },
    runIdle() {
      const entry = idle.entries().next().value;
      if (!entry) {
        return false;
      }
      const [id, callback] = entry;
      idle.delete(id);
      callback();
      return true;
    },
    pendingTimers() {
      return timers.size;
    },
    pendingIdle() {
      return idle.size;
    },
  };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

test("queue coalesces repeated work into one scheduled save", async () => {
  const scheduler = createFakeScheduler();
  let saves = 0;
  const autosave = createAutosave({
    delayMs: 10,
    scheduler,
    onSave: async () => {
      saves += 1;
    },
  });

  autosave.queue();
  autosave.queue();

  assert.equal(scheduler.pendingTimers(), 1);
  scheduler.runTimer();
  assert.equal(scheduler.pendingIdle(), 1);
  scheduler.runIdle();
  await settle();
  assert.equal(saves, 1);
});

test("flush waits for an in-flight save and runs one trailing save without overlap", async () => {
  const scheduler = createFakeScheduler();
  const first = deferred();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const autosave = createAutosave({
    delayMs: 10,
    scheduler,
    onSave: async () => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (calls === 1) {
        await first.promise;
      }
      active -= 1;
    },
  });

  autosave.queue();
  scheduler.runTimer();
  scheduler.runIdle();
  await settle();

  autosave.queue();
  const flushing = autosave.flush();
  await settle();
  assert.equal(calls, 1);

  first.resolve();
  await flushing;
  assert.equal(calls, 2);
  assert.equal(maxActive, 1);
});

test("work queued during the trailing save remains scheduled", async () => {
  const scheduler = createFakeScheduler();
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const autosave = createAutosave({
    delayMs: 10,
    scheduler,
    onSave: async () => {
      calls += 1;
      if (calls === 1) {
        await first.promise;
      }
      if (calls === 2) {
        await second.promise;
      }
    },
  });

  autosave.queue();
  scheduler.runTimer();
  scheduler.runIdle();
  await settle();

  autosave.queue();
  const flushing = autosave.flush();
  first.resolve();
  await settle();
  autosave.queue();
  second.resolve();
  await flushing;

  assert.equal(calls, 2);
  assert.equal(scheduler.pendingTimers(), 1);
  scheduler.runTimer();
  scheduler.runIdle();
  await settle();
  assert.equal(calls, 3);
});

test("a rejected scheduled save is handled and a later flush can retry", async () => {
  const scheduler = createFakeScheduler();
  let calls = 0;
  const autosave = createAutosave({
    delayMs: 10,
    scheduler,
    onSave: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("synthetic storage failure");
      }
    },
  });

  autosave.queue();
  scheduler.runTimer();
  scheduler.runIdle();
  await settle();
  assert.equal(calls, 1);

  await autosave.flush();
  assert.equal(calls, 2);
});