import assert from "node:assert/strict";
import test from "node:test";
import { createJapaneseWorkspaceCoordinator } from "../../core/japaneseWorkspaceCoordinator.js";

function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();
  return {
    getState() {
      return state;
    },
    setState(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      for (const listener of listeners) {
        listener(state);
      }
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function context() {
  return {
    nowIso: "2026-07-31T10:00:00.000Z",
    localDate: "2026-07-31",
    isoWeek: "2026-W31",
  };
}

test("workspace switching restores query and active-note state through the workspace API", async () => {
  const store = createStore({
    db: {},
    notes: [{ id: "ordinary" }, { id: "jp" }],
    activeId: "ordinary",
    query: "ordinary query",
    workspace: "notes",
    studyReviews: [],
    japaneseNoteIds: [],
    reviewSession: { status: "idle" },
  });
  const refreshes = [];
  const actions = {
    async bootstrap() {
      store.setState({ japaneseNoteIds: ["jp"], studyReviews: [] });
    },
    chooseWorkspace(workspace) {
      store.setState({ workspace });
    },
    async createJapaneseNote() {
      return { id: "created" };
    },
    async deleteNote() {},
  };
  const coordinator = createJapaneseWorkspaceCoordinator({
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    actions,
    noteWorkspace: {
      async refresh(options) {
        refreshes.push(options);
        store.setState({
          query: options.query,
          activeId: options.preferredId,
          filteredIds: options.preferredId ? [options.preferredId] : [],
        });
        return {
          query: options.query,
          activeId: options.preferredId,
        };
      },
    },
    async loadReviews() {
      return [];
    },
    getContext: context,
  });

  await coordinator.ready;
  await coordinator.switchWorkspace("japanese");
  assert.deepEqual(refreshes.at(-1), {
    query: "",
    preferredId: "jp",
    emptyLabel: "No Japanese notes",
  });

  store.setState({ query: "jp query", activeId: "jp" });
  await coordinator.switchWorkspace("notes");
  assert.deepEqual(refreshes.at(-1), {
    query: "ordinary query",
    preferredId: "ordinary",
    emptyLabel: "No notes",
  });

  await coordinator.switchWorkspace("japanese");
  assert.deepEqual(refreshes.at(-1), {
    query: "jp query",
    preferredId: "jp",
    emptyLabel: "No Japanese notes",
  });
  coordinator.destroy();
});

test("quick create and enrolled delete refresh through the explicit workspace API", async () => {
  const store = createStore({
    db: {},
    notes: [{ id: "ordinary" }, { id: "jp" }],
    activeId: "ordinary",
    query: "ordinary query",
    workspace: "notes",
    studyReviews: [],
    japaneseNoteIds: [],
    reviewSession: { status: "idle" },
  });
  const calls = [];
  const actions = {
    async bootstrap() {
      store.setState({ japaneseNoteIds: ["jp"], studyReviews: [] });
    },
    chooseWorkspace(workspace) {
      calls.push(["workspace", workspace]);
      store.setState({ workspace });
    },
    async createJapaneseNote(type, options, suppliedContext) {
      calls.push(["create", type, options, suppliedContext]);
      return { id: "created" };
    },
    async deleteNote(noteId, suppliedContext) {
      calls.push(["delete", noteId, suppliedContext]);
    },
  };
  const coordinator = createJapaneseWorkspaceCoordinator({
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    actions,
    noteWorkspace: {
      async refresh(options) {
        calls.push(["refresh", options]);
        store.setState({ query: options.query, activeId: options.preferredId });
        return {
          query: options.query,
          activeId: options.preferredId,
        };
      },
    },
    async loadReviews() {
      return [];
    },
    getContext: context,
  });

  await coordinator.ready;
  const note = await coordinator.quickCreate("output");
  assert.deepEqual(note, { id: "created" });
  assert.deepEqual(calls.find((entry) => entry[0] === "create"), [
    "create",
    "output",
    { localDate: "2026-07-31" },
    context(),
  ]);
  assert.deepEqual(calls.filter((entry) => entry[0] === "refresh").at(-1), [
    "refresh",
    { query: "", preferredId: "created", emptyLabel: "No Japanese notes" },
  ]);

  await coordinator.deleteNote("jp");
  assert.deepEqual(calls.find((entry) => entry[0] === "delete"), ["delete", "jp", context()]);
  assert.equal(calls.filter((entry) => entry[0] === "refresh").length, 2);
  coordinator.destroy();
});

test("invalid persisted review data becomes bounded read-only Japanese state without blocking workspace access", async () => {
  const store = createStore({
    db: {},
    notes: [{ id: "ordinary" }],
    activeId: "ordinary",
    query: "",
    workspace: "notes",
    studyReviews: [],
    japaneseNoteIds: [],
    reviewSession: { status: "idle" },
  });
  const refreshes = [];
  const actions = {
    async bootstrap() {},
    chooseWorkspace(workspace) {
      store.setState({ workspace });
    },
    async createJapaneseNote() {
      throw new Error("must stay disabled");
    },
    async deleteNote() {},
  };
  const coordinator = createJapaneseWorkspaceCoordinator({
    getState: store.getState,
    setState: store.setState,
    subscribe: store.subscribe,
    actions,
    noteWorkspace: {
      async refresh(options) {
        refreshes.push(options);
        store.setState({ query: options.query, activeId: options.preferredId });
        return {
          query: options.query,
          activeId: options.preferredId,
        };
      },
    },
    async loadReviews() {
      const error = new TypeError("Invalid study review");
      error.code = "INVALID_STUDY_REVIEW";
      throw error;
    },
    getContext: context,
  });

  await coordinator.ready;
  assert.equal(store.getState().studyDataUnavailable, true);
  assert.deepEqual(store.getState().japaneseNoteIds, []);
  assert.deepEqual(store.getState().studyStatus, [
    { code: "study-data-unavailable", count: 1 },
  ]);

  await coordinator.switchWorkspace("japanese");
  assert.equal(store.getState().workspace, "japanese");
  assert.deepEqual(refreshes.at(-1), {
    query: "",
    preferredId: null,
    emptyLabel: "No Japanese notes",
  });

  await assert.rejects(
    coordinator.quickCreate("vocabulary"),
    (error) => error?.code === "STUDY_DATA_UNAVAILABLE",
  );
  coordinator.destroy();
});
