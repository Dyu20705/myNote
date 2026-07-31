import assert from "node:assert/strict";
import test from "node:test";
import { createNoteWorkspaceController } from "../../core/noteWorkspaceController.js";

function createStore(initialState) {
  let state = { ...initialState };
  return {
    getState() {
      return state;
    },
    setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      return state;
    },
  };
}

test("refresh owns query, result, active-note, and render coordination without DOM events", async () => {
  const store = createStore({
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "a",
    filteredIds: ["a"],
    query: "",
    dirty: true,
    recentIds: ["a"],
    emptyLabel: "Ready",
  });
  const calls = [];
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query(queryText) {
      calls.push(["query", queryText]);
      return ["b", "a"];
    },
    async flush() {
      calls.push(["flush"]);
      store.setState({ dirty: false });
    },
    onSearchMetrics(elapsed) {
      assert.equal(Number.isFinite(elapsed), true);
    },
    onRender(snapshot) {
      calls.push(["render", snapshot.query, snapshot.activeId]);
    },
  });

  const result = await controller.refresh({
    query: "kanji",
    preferredId: "b",
    emptyLabel: "No Japanese notes",
  });

  assert.deepEqual(result, {
    stale: false,
    query: "kanji",
    ids: ["b", "a"],
    activeId: "b",
  });
  assert.deepEqual(store.getState(), {
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "b",
    filteredIds: ["b", "a"],
    query: "kanji",
    dirty: false,
    recentIds: ["b", "a"],
    emptyLabel: "No Japanese notes",
  });
  assert.deepEqual(calls.map((entry) => entry[0]), ["query", "flush", "render"]);
});

test("only the latest asynchronous refresh may commit state", async () => {
  const store = createStore({
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "a",
    filteredIds: ["a"],
    query: "",
    dirty: false,
    recentIds: ["a"],
    emptyLabel: "Ready",
  });
  const resolvers = new Map();
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    query(queryText) {
      return new Promise((resolve) => resolvers.set(queryText, resolve));
    },
    async flush() {},
    onSearchMetrics() {},
    onRender() {},
  });

  const first = controller.refresh({ query: "first" });
  const second = controller.refresh({ query: "second" });
  resolvers.get("second")(["b"]);
  assert.deepEqual(await second, {
    stale: false,
    query: "second",
    ids: ["b"],
    activeId: "b",
  });
  resolvers.get("first")(["a"]);
  assert.deepEqual(await first, {
    stale: true,
    query: "first",
    ids: ["a"],
    activeId: "b",
  });
  assert.equal(store.getState().query, "second");
  assert.deepEqual(store.getState().filteredIds, ["b"]);
});

test("select flushes before changing the active note and rejects missing notes", async () => {
  const store = createStore({
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "a",
    filteredIds: ["a", "b"],
    query: "",
    dirty: true,
    recentIds: ["a"],
    emptyLabel: "Ready",
  });
  const order = [];
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query() {
      return [];
    },
    async flush() {
      order.push("flush");
      store.setState({ dirty: false });
    },
    onSearchMetrics() {},
    onRender() {
      order.push("render");
    },
  });

  assert.equal(await controller.select("b"), true);
  assert.deepEqual(order, ["flush", "render"]);
  assert.equal(store.getState().activeId, "b");
  assert.equal(await controller.select("missing"), false);
  assert.equal(store.getState().activeId, "b");
});
