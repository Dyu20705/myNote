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

function initialState(overrides = {}) {
  return {
    notes: [{ id: "a" }, { id: "b" }],
    activeId: "a",
    filteredIds: ["a"],
    query: "",
    dirty: false,
    recentIds: ["a"],
    emptyLabel: "Ready",
    ...overrides,
  };
}

test("refresh owns query, selection, and render coordination without DOM events", async () => {
  const store = createStore(initialState({ dirty: true }));
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
    reconcileActive: true,
  });

  assert.deepEqual(result, {
    stale: false,
    query: "kanji",
    ids: ["b", "a"],
    activeId: "b",
  });
  assert.deepEqual(store.getState(), initialState({
    activeId: "b",
    filteredIds: ["b", "a"],
    query: "kanji",
    dirty: false,
    recentIds: ["b", "a"],
    emptyLabel: "No Japanese notes",
  }));
  assert.deepEqual(calls.map((entry) => entry[0]), ["query", "flush", "render"]);
  assert.deepEqual(calls.at(-1)[3], {
    reason: "refresh",
    activeChanged: true,
    stateActiveChanged: true,
    reconcileActive: true,
    synchronizeEditor: true,
  });
});

test("same-note search refresh declares that the editor must remain untouched", async () => {
  const store = createStore(initialState({
    filteredIds: ["a", "b"],
    dirty: true,
  }));
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

  assert.deepEqual(renderContext, {
    reason: "refresh",
    activeChanged: false,
    stateActiveChanged: false,
    reconcileActive: false,
    synchronizeEditor: false,
  });
  assert.equal(store.getState().dirty, true);
  assert.equal(store.getState().activeId, "a");
});

test("caller may synchronize a rendered editor after active state was committed elsewhere", async () => {
  const store = createStore(initialState());
  let renderContext = null;
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query() {
      return ["a"];
    },
    async flush() {
      throw new Error("same-note synchronization must not flush");
    },
    onSearchMetrics() {},
    onRender(_snapshot, context) {
      renderContext = context;
    },
  });

  await controller.refresh({
    query: "",
    preferredId: "a",
    reconcileActive: true,
    synchronizeEditor: true,
  });

  assert.deepEqual(renderContext, {
    reason: "refresh",
    activeChanged: true,
    stateActiveChanged: false,
    reconcileActive: true,
    synchronizeEditor: true,
  });
});

test("first clean result hydration synchronizes the existing active editor", async () => {
  const store = createStore(initialState({ filteredIds: [] }));
  let renderContext = null;
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query() {
      return ["a", "b"];
    },
    async flush() {
      throw new Error("initial hydration must not flush");
    },
    onSearchMetrics() {},
    onRender(_snapshot, context) {
      renderContext = context;
    },
  });

  await controller.refresh({ query: "" });

  assert.deepEqual(renderContext, {
    reason: "refresh",
    activeChanged: true,
    stateActiveChanged: false,
    reconcileActive: false,
    synchronizeEditor: true,
  });
});

test("non-reconciling refresh updates results without replacing the active editor note", async () => {
  const store = createStore(initialState({ dirty: true }));
  let renderContext = null;
  const controller = createNoteWorkspaceController({
    getState: store.getState,
    setState: store.setState,
    async query() {
      return ["b"];
    },
    async flush() {
      throw new Error("non-reconciling refresh must not flush");
    },
    onSearchMetrics() {},
    onRender(_snapshot, context) {
      renderContext = context;
    },
  });

  const result = await controller.refresh({
    query: "other",
    reconcileActive: false,
  });

  assert.deepEqual(result, {
    stale: false,
    query: "other",
    ids: ["b"],
    activeId: "a",
  });
  assert.equal(store.getState().activeId, "a");
  assert.deepEqual(store.getState().filteredIds, ["b"]);
  assert.equal(store.getState().dirty, true);
  assert.deepEqual(renderContext, {
    reason: "refresh",
    activeChanged: false,
    stateActiveChanged: false,
    reconcileActive: false,
    synchronizeEditor: false,
  });
});

test("refresh queries again after flushing a canonical draft mutation", async () => {
  const store = createStore(initialState({ dirty: true }));
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

  const result = await controller.refresh({
    query: "saved draft",
    preferredId: "b",
    reconcileActive: true,
  });

  assert.equal(queryCount, 2);
  assert.deepEqual(result.ids, ["b", "a"]);
  assert.deepEqual(store.getState().filteredIds, ["b", "a"]);
});

test("only the latest asynchronous refresh may commit state", async () => {
  const store = createStore(initialState());
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

  const first = controller.refresh({ query: "first", reconcileActive: true });
  const second = controller.refresh({ query: "second", reconcileActive: true });
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
  const store = createStore(initialState({
    filteredIds: ["a", "b"],
    dirty: true,
  }));
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
