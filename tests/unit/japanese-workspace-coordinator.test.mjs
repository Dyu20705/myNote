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

function createWorkspaceStub(store, calls) {
  return {
    async refresh(options) {
      calls.push(options);
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
  };
}

test("workspace switching restores view state and requests editor synchronization", async () => {
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
    noteWorkspace: createWorkspaceStub(store, refreshes),
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
    reconcileActive: true,
    synchronizeEditor: true,
  });

  store.setState({ query: "jp query", activeId: "jp" });
  await coordinator.switchWorkspace("notes");
  assert.deepEqual(refreshes.at(-1), {
    query: "ordinary query",
    preferredId: "ordinary",
    emptyLabel: "No notes",
    reconcileActive: true,
    synchronizeEditor: true,
  });

  await coordinator.switchWorkspace("japanese");
  assert.deepEqual(refreshes.at(-1), {
    query: "jp query",
    preferredId: "jp",
    emptyLabel: "No Japanese notes",
    reconcileActive: true,
    synchronizeEditor: true,
  });
  coordinator.destroy();
});

test("quick create and enrolled delete request authoritative editor refresh", async () => {
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
  const refreshes = [];
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
    noteWorkspace: createWorkspaceStub(store, refreshes),
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
  assert.deepEqual(refreshes.at(-1), {
    query: "",
    preferredId: "created",
    emptyLabel: "No Japanese notes",
    reconcileActive: true,
    synchronizeEditor: true,
  });

  await coordinator.deleteNote("jp");
  assert.deepEqual(calls.find((entry) => entry[0] === "delete"), ["delete", "jp", context()]);
  assert.deepEqual(refreshes.at(-1), {
    query: "",
    preferredId: "created",
    emptyLabel: "No Japanese notes",
    reconcileActive: true,
    synchronizeEditor: true,
  });
  coordinator.destroy();
});

test("filter refresh reconciles visibility without forcing same-note editor synchronization", async () => {
  const store = createStore({
    db: {},
    notes: [{ id: "ordinary" }, { id: "jp" }],
    activeId: "jp",
    query: "filter query",
    workspace: "japanese",
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
    noteWorkspace: createWorkspaceStub(store, refreshes),
    async loadReviews() {
      return [];
    },
    getContext: context,
  });

  await coordinator.ready;
  store.setState({ workspace: "japanese", query: "filter query", activeId: "jp" });
  await coordinator.refreshCurrent();

  assert.deepEqual(refreshes.at(-1), {
    query: "filter query",
    preferredId: "jp",
    emptyLabel: "No Japanese notes",
    reconcileActive: true,
    synchronizeEditor: false,
  });
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
    noteWorkspace: createWorkspaceStub(store, refreshes),
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
    reconcileActive: true,
    synchronizeEditor: true,
  });

  await assert.rejects(
    coordinator.quickCreate("vocabulary"),
    (error) => error?.code === "STUDY_DATA_UNAVAILABLE",
  );
  coordinator.destroy();
});

test("initialization uses live notes and preserves user view changes made while reviews load", async () => {
  const store = createStore({
    db: { id: "db" },
    notes: [{ id: "ordinary" }],
    activeId: "ordinary",
    query: "initial query",
    workspace: "notes",
    studyReviews: [],
    japaneseNoteIds: [],
    reviewSession: { status: "idle" },
  });
  let resolveReviews;
  let bootstrapInput = null;
  const reviewsPending = new Promise((resolve) => {
    resolveReviews = resolve;
  });
  const actions = {
    async bootstrap(input) {
      bootstrapInput = input;
      store.setState({
        db: input.db,
        notes: input.notes,
        activeId: input.notes[0]?.id ?? null,
        workspace: "notes",
        studyReviews: input.reviews,
        japaneseNoteIds: [],
        reviewSession: { status: "idle" },
      });
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
    noteWorkspace: createWorkspaceStub(store, []),
    async loadReviews() {
      return reviewsPending;
    },
    getContext: context,
  });

  const liveNotes = [{ id: "new" }, { id: "ordinary" }];
  store.setState({
    notes: liveNotes,
    activeId: "new",
    query: "user query",
  });
  resolveReviews([]);
  await coordinator.ready;

  assert.equal(bootstrapInput.db, store.getState().db);
  assert.deepEqual(bootstrapInput.notes, liveNotes);
  assert.equal(store.getState().activeId, "new");
  assert.equal(store.getState().query, "user query");
  coordinator.destroy();
});

test("rapid workspace switches keep the last committed view for each workspace", async () => {
  const store = createStore({
    db: {},
    notes: [{ id: "ordinary" }, { id: "jp-1" }, { id: "jp-2" }],
    activeId: "ordinary",
    query: "notes query",
    workspace: "notes",
    studyReviews: [],
    japaneseNoteIds: [],
    reviewSession: { status: "idle" },
  });
  const pending = [];
  let deferRefresh = false;
  const noteWorkspace = {
    refresh(options) {
      if (!deferRefresh) {
        store.setState({
          query: options.query,
          activeId: options.preferredId,
          filteredIds: options.preferredId ? [options.preferredId] : [],
        });
        return Promise.resolve({
          stale: false,
          query: options.query,
          activeId: options.preferredId,
        });
      }
      return new Promise((resolve) => pending.push({ options, resolve }));
    },
  };
  const actions = {
    async bootstrap() {
      store.setState({ japaneseNoteIds: ["jp-1", "jp-2"], studyReviews: [] });
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
    noteWorkspace,
    async loadReviews() {
      return [];
    },
    getContext: context,
  });

  await coordinator.ready;
  await coordinator.switchWorkspace("japanese");
  store.setState({ query: "kanji query", activeId: "jp-2" });
  await coordinator.refreshCurrent();
  await coordinator.switchWorkspace("notes");

  deferRefresh = true;
  const firstSwitch = coordinator.switchWorkspace("japanese");
  await Promise.resolve();
  const secondSwitch = coordinator.switchWorkspace("notes");
  await Promise.resolve();

  assert.equal(pending.length, 2);
  store.setState({
    workspace: "notes",
    query: pending[1].options.query,
    activeId: pending[1].options.preferredId,
  });
  pending[1].resolve({
    stale: false,
    query: pending[1].options.query,
    activeId: pending[1].options.preferredId,
  });
  await secondSwitch;
  pending[0].resolve({
    stale: true,
    query: pending[0].options.query,
    activeId: store.getState().activeId,
  });
  await firstSwitch;

  const returnToJapanese = coordinator.switchWorkspace("japanese");
  await Promise.resolve();
  assert.equal(pending[2].options.query, "kanji query");
  assert.equal(pending[2].options.preferredId, "jp-2");
  pending[2].resolve({
    stale: false,
    query: pending[2].options.query,
    activeId: pending[2].options.preferredId,
  });
  await returnToJapanese;
  coordinator.destroy();
});
