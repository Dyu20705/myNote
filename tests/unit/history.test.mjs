import assert from "node:assert/strict";
import test from "node:test";
import { createHistory } from "../../core/history.js";

function operation(id) {
  return {
    id,
    kind: "synthetic",
    metadata: { source: { version: 1 } },
    patch: [{ key: "tags", before: ["before"], after: ["after"] }],
  };
}

test("history operations are isolated from caller mutation on ingress", () => {
  const history = createHistory();
  const input = operation(1);
  history.record(input);

  input.kind = "mutated";
  input.metadata.source.version = 99;
  input.patch[0].before[0] = "mutated";

  const retained = history.getOperations()[0];
  assert.equal(retained.kind, "synthetic");
  assert.equal(retained.metadata.source.version, 1);
  assert.deepEqual(retained.patch[0].before, ["before"]);
});

test("history snapshots are isolated from caller mutation on ingress", () => {
  const history = createHistory();
  const state = { notes: [{ id: "synthetic-note", meta: { version: 1 } }] };
  history.snapshot(state);

  state.notes[0].meta.version = 99;

  assert.equal(history.getSnapshots()[0].state.notes[0].meta.version, 1);
});

test("history getters cannot mutate retained nested data", () => {
  const history = createHistory();
  history.record(operation(1));
  history.snapshot({ notes: [{ id: "synthetic-note", meta: { version: 1 } }] });

  const operations = history.getOperations();
  const snapshots = history.getSnapshots();
  operations[0].metadata.source.version = 99;
  operations[0].patch[0].after[0] = "mutated";
  snapshots[0].state.notes[0].meta.version = 99;

  assert.equal(history.getOperations()[0].metadata.source.version, 1);
  assert.deepEqual(history.getOperations()[0].patch[0].after, ["after"]);
  assert.equal(history.getSnapshots()[0].state.notes[0].meta.version, 1);
});

test("history enforces literal operation and snapshot bounds", () => {
  const history = createHistory(3);
  for (let id = 1; id <= 4; id += 1) {
    history.record({ id });
  }
  for (let marker = 1; marker <= 31; marker += 1) {
    history.snapshot({ marker });
  }

  assert.deepEqual(history.getOperations().map(({ id }) => id), [2, 3, 4]);
  assert.equal(history.getSnapshots().length, 30);
  assert.equal(history.getSnapshots()[0].state.marker, 2);
  assert.equal(history.getSnapshots()[29].state.marker, 31);
});

test("history compaction keeps full patches for exactly the newest 120 entries", () => {
  const history = createHistory(150);
  for (let id = 1; id <= 121; id += 1) {
    history.record(operation(id));
  }

  const retained = history.getOperations();
  assert.equal(retained.length, 121);
  assert.equal(retained[0].patch, null);
  assert.equal(retained[0].patchSize, 1);
  assert.equal(retained.slice(1).every(({ patch }) => Array.isArray(patch)), true);
  assert.equal(retained.slice(1).length, 120);
});
