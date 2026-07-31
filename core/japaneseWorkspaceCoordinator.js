import { createJapaneseAppState } from "./japaneseState.js";

const WORKSPACES = Object.freeze(["notes", "japanese"]);

function createCoordinatorError() {
  return new TypeError("Invalid Japanese workspace coordinator dependencies");
}

function validateDependencies(options) {
  const actions = options?.actions;
  const noteWorkspace = options?.noteWorkspace;
  if (!options
    || typeof options.getState !== "function"
    || typeof options.setState !== "function"
    || typeof options.subscribe !== "function"
    || !actions
    || typeof actions.bootstrap !== "function"
    || typeof actions.chooseWorkspace !== "function"
    || typeof actions.createJapaneseNote !== "function"
    || typeof actions.deleteNote !== "function"
    || !noteWorkspace
    || typeof noteWorkspace.refresh !== "function"
    || typeof options.loadReviews !== "function"
    || typeof options.getContext !== "function") {
    throw createCoordinatorError();
  }
}

function workspaceOf(state) {
  return state?.workspace === "japanese" ? "japanese" : "notes";
}

function emptyLabel(workspace) {
  return workspace === "japanese" ? "No Japanese notes" : "No notes";
}

function templateOptions(type, context) {
  if (type === "output") {
    return { localDate: context.localDate };
  }
  if (type === "planner") {
    return { isoWeek: context.isoWeek };
  }
  return {};
}

function fallbackId(state, workspace) {
  if (workspace === "japanese") {
    return Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds[0] ?? null : null;
  }
  return Array.isArray(state.notes) ? state.notes[0]?.id ?? null : null;
}

export function createJapaneseWorkspaceCoordinator(options) {
  validateDependencies(options);
  const views = {
    notes: { query: "", activeId: null },
    japanese: { query: "", activeId: null },
  };
  let initialized = false;
  let initializing = false;
  let destroyed = false;
  let lastNotesReference = null;
  let synchronizing = false;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  function rememberView(state = options.getState()) {
    const workspace = workspaceOf(state);
    views[workspace] = {
      query: typeof state.query === "string" ? state.query : "",
      activeId: typeof state.activeId === "string" ? state.activeId : null,
    };
  }

  function synchronizeSlice(state) {
    if (!initialized || synchronizing || state.notes === lastNotesReference) {
      return;
    }
    lastNotesReference = state.notes;
    synchronizing = true;
    try {
      const context = state.studyContext || options.getContext();
      const slice = createJapaneseAppState({
        notes: state.notes,
        reviews: state.studyReviews || [],
        nowIso: context.nowIso,
        localDate: context.localDate,
        isoWeek: context.isoWeek,
      });
      options.setState({
        studyReviews: slice.studyReviews,
        japaneseNoteIds: slice.japaneseNoteIds,
        studyDashboard: slice.studyDashboard,
        studyStatus: slice.studyStatus,
        studyStatusOmitted: slice.studyStatusOmitted,
        studyContext: slice.studyContext,
        workspace: state.workspace,
        reviewSession: state.reviewSession,
      });
    } finally {
      synchronizing = false;
    }
  }

  async function initialize(state) {
    const previousActiveId = state.activeId ?? null;
    const previousQuery = typeof state.query === "string" ? state.query : "";
    const reviews = await options.loadReviews(state.db);
    const context = options.getContext();
    await options.actions.bootstrap({
      db: state.db,
      notes: state.notes,
      reviews,
      ...context,
    });
    options.setState({ activeId: previousActiveId, query: previousQuery });
    views.notes = { query: previousQuery, activeId: previousActiveId };
    lastNotesReference = options.getState().notes;
    initialized = true;
    resolveReady();
  }

  function beginInitialization(state) {
    if (destroyed || initialized || initializing || !state?.db || !Array.isArray(state.notes)) {
      return;
    }
    initializing = true;
    initialize(state).catch(rejectReady).finally(() => {
      initializing = false;
    });
  }

  function handleState(state) {
    beginInitialization(state);
    synchronizeSlice(state);
  }

  const unsubscribe = options.subscribe(handleState);
  beginInitialization(options.getState());

  async function refreshWorkspace(workspace, view = views[workspace]) {
    const state = options.getState();
    const result = await options.noteWorkspace.refresh({
      query: typeof view.query === "string" ? view.query : "",
      preferredId: view.activeId || fallbackId(state, workspace),
      emptyLabel: emptyLabel(workspace),
    });
    views[workspace] = {
      query: result.query,
      activeId: result.activeId,
    };
    return result;
  }

  async function switchWorkspace(workspace) {
    if (!WORKSPACES.includes(workspace)) {
      throw createCoordinatorError();
    }
    await ready;
    rememberView();
    options.actions.chooseWorkspace(workspace);
    return refreshWorkspace(workspace);
  }

  async function quickCreate(type) {
    await ready;
    const context = options.getContext();
    const note = await options.actions.createJapaneseNote(type, templateOptions(type, context), context);
    options.actions.chooseWorkspace("japanese");
    views.japanese = { query: "", activeId: note.id };
    await refreshWorkspace("japanese", views.japanese);
    return note;
  }

  async function deleteNote(noteId) {
    await ready;
    const state = options.getState();
    const workspace = workspaceOf(state);
    rememberView(state);
    await options.actions.deleteNote(noteId, options.getContext());
    return refreshWorkspace(workspace, views[workspace]);
  }

  async function refreshCurrent() {
    await ready;
    const state = options.getState();
    const workspace = workspaceOf(state);
    rememberView(state);
    return refreshWorkspace(workspace, views[workspace]);
  }

  return {
    ready,
    switchWorkspace,
    quickCreate,
    deleteNote,
    refreshCurrent,
    destroy() {
      destroyed = true;
      unsubscribe();
    },
  };
}
