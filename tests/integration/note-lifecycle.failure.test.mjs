import assert from "node:assert/strict";
import test from "node:test";
import { createNoteLifecycle } from "../../core/noteLifecycle.js";

function syntheticNote() {
  return { id: "note-42", title: "Synthetic", content: "fixture" };
}

test("canonical upsert failure rejects before memory or derived commit", async () => {
  const calls = [];
  const failures = [];
  const lifecycle = createNoteLifecycle({
    persistUpsert: async () => {
      calls.push("persist");
      throw new Error("quota");
    },
    persistRemove: async () => {},
    commitUpsert: () => calls.push("commit"),
    commitRemove: () => {},
    updateDerivedUpsert: async () => calls.push("derived"),
    updateDerivedRemove: async () => {},
    onCanonicalFailure: (failure) => failures.push(failure),
  });

  await assert.rejects(lifecycle.upsert(syntheticNote()), /quota/);
  assert.deepEqual(calls, ["persist"]);
  assert.equal(failures[0].operation, "upsert");
  assert.equal("note" in failures[0], false);
});

test("canonical delete failure leaves memory and derived state untouched", async () => {
  const calls = [];
  const lifecycle = createNoteLifecycle({
    persistUpsert: async () => {},
    persistRemove: async () => {
      calls.push("persist");
      throw new Error("blocked");
    },
    commitUpsert: () => {},
    commitRemove: () => calls.push("commit"),
    updateDerivedUpsert: async () => {},
    updateDerivedRemove: async () => calls.push("derived"),
  });

  await assert.rejects(lifecycle.remove("note-42"), /blocked/);
  assert.deepEqual(calls, ["persist"]);
});

test("derived upsert failure preserves canonical commit and reports degradation", async () => {
  const calls = [];
  const degraded = [];
  const lifecycle = createNoteLifecycle({
    persistUpsert: async () => calls.push("persist"),
    persistRemove: async () => {},
    commitUpsert: () => calls.push("commit"),
    commitRemove: () => {},
    updateDerivedUpsert: async () => {
      calls.push("derived");
      throw new Error("worker unavailable");
    },
    updateDerivedRemove: async () => {},
    onDerivedFailure: (failure) => degraded.push(failure),
  });

  const result = await lifecycle.upsert(syntheticNote());
  assert.deepEqual(calls, ["persist", "commit", "derived"]);
  assert.deepEqual(result, { derivedDegraded: true });
  assert.equal(degraded[0].operation, "upsert");
  assert.equal("note" in degraded[0], false);
});

test("successful remove completes canonical and derived stages in order", async () => {
  const calls = [];
  const succeeded = [];
  const lifecycle = createNoteLifecycle({
    persistUpsert: async () => {},
    persistRemove: async () => calls.push("persist"),
    commitUpsert: () => {},
    commitRemove: () => calls.push("commit"),
    updateDerivedUpsert: async () => {},
    updateDerivedRemove: async () => calls.push("derived"),
    onSuccess: (result) => succeeded.push(result),
  });

  const result = await lifecycle.remove("note-42");
  assert.deepEqual(calls, ["persist", "commit", "derived"]);
  assert.deepEqual(result, { derivedDegraded: false });
  assert.equal(succeeded[0].operation, "remove");
});