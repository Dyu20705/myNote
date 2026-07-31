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
    onRender(snapshot, context) {
      calls.push(["render", snapshot.query, snapshot.activeId, context]);
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
  assert.deepEqual(calls.at(-1)[3], { reason: "refresh", activeChanged: true });
});

test("same-note refresh declares that the editor must remain untouched", async () => {
  const store = createStore({
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "a",
    filteredIds: ["a", "b"],
    query: "",
    dirty: true,
    recentIds: ["a"],
    emptyLabel: "Ready",
  });
  let renderContext = null;
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query() {
      return ["a"];
    },
    async flush() {
      throw new Error("same-note refresh must not flush");
    },
    onSearchMetrics() {},
    onRender(_snapshot, context) {
      renderContext = context;
    },
  });

  await controller.refresh({ query: "active" });

  assert.deepEqual(renderContext, { reason: "refresh", activeChanged: false });
  assert.equal(store.getState().dirty, true);
  assert.equal(store.getState().activeId, "a");
});

test("refresh queries again after flushing a canonical draft mutation", async () => {
  const store = createStore({
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "a",
    filteredIds: ["a"],
    query: "",
    dirty: true,
    recentIds: ["a"],
    emptyLabel: "Ready",
  });
  let queryCount = 0;
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query() {
      queryCount += 1;
      return queryCount === 1 ? ["b"] : ["b", "a"];
    },
    async flush() {
      store.setState({ dirty: false });
      return true;
    },
    onSearchMetrics() {},
    onRender() {},
  });

  const result = await controller.refresh({ query: "saved draft", preferredId: "b" });

  assert.equal(queryCount, 2);
  assert.deepEqual(result.ids, ["b", "a"]);
  assert.deepEqual(store.getState().filteredIds, ["b", "a"]);
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
