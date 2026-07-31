function createControllerError() {
  return new TypeError("Invalid note workspace controller dependencies");
}

function validateDependencies(options) {
  if (!options
    || typeof options !== "object"
    || typeof options.getState !== "function"
    || typeof options.setState !== "function"
    || typeof options.query !== "function"
    || typeof options.flush !== "function"
    || typeof options.onSearchMetrics !== "function"
    || typeof options.onRender !== "function") {
    throw createControllerError();
  }
}

function validateIds(value) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
    throw new TypeError("Invalid note workspace result IDs");
  }
  return [...value];
}

function normalizedQuery(value, fallback = "") {
  return typeof value === "string" ? value.trim() : String(fallback || "").trim();
}

function noteExists(state, id) {
  return typeof id === "string"
    && Array.isArray(state.notes)
    && state.notes.some((note) => note?.id === id);
}

function nextRecentIds(state, activeId) {
  const recent = Array.isArray(state.recentIds) ? state.recentIds : [];
  if (!activeId) {
    return [...recent];
  }
  return [activeId, ...recent.filter((id) => id !== activeId)].slice(0, 20);
}

function nowMs() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function createNoteWorkspaceController(options) {
  validateDependencies(options);
  let refreshToken = 0;

  async function select(id) {
    const state = options.getState();
    if (!noteExists(state, id)) {
      return false;
    }
    if (state.activeId === id) {
      return true;
    }

    await options.flush();
    const current = options.getState();
    if (!noteExists(current, id)) {
      return false;
    }

    options.setState({
      activeId: id,
      dirty: false,
      recentIds: nextRecentIds(current, id),
    });
    options.onRender(options.getState());
    return true;
  }

  async function refresh(input = {}) {
    const token = ++refreshToken;
    const beforeQuery = options.getState();
    const queryText = normalizedQuery(input.query, beforeQuery.query);
    const startedAt = nowMs();
    const ids = validateIds(await options.query(queryText));
    options.onSearchMetrics(Math.max(0, nowMs() - startedAt));

    if (token !== refreshToken) {
      return {
        stale: true,
        query: queryText,
        ids,
        activeId: options.getState().activeId ?? null,
      };
    }

    let state = options.getState();
    const preferredId = typeof input.preferredId === "string" ? input.preferredId : null;
    const activeId = preferredId && ids.includes(preferredId)
      ? preferredId
      : ids.includes(state.activeId)
        ? state.activeId
        : ids[0] ?? null;
    const activeChanged = state.activeId !== activeId;

    if (activeChanged) {
      await options.flush();
      if (token !== refreshToken) {
        return {
          stale: true,
          query: queryText,
          ids,
          activeId: options.getState().activeId ?? null,
        };
      }
      state = options.getState();
    }

    const patch = {
      query: queryText,
      filteredIds: ids,
      activeId,
      emptyLabel: typeof input.emptyLabel === "string"
        ? input.emptyLabel
        : state.emptyLabel || "Ready",
    };
    if (activeChanged) {
      patch.dirty = false;
      patch.recentIds = nextRecentIds(state, activeId);
    }

    options.setState(patch);
    const snapshot = options.getState();
    options.onRender(snapshot);
    return {
      stale: false,
      query: queryText,
      ids,
      activeId,
    };
  }

  async function moveSelection(step) {
    const state = options.getState();
    const ids = Array.isArray(state.filteredIds) ? state.filteredIds : [];
    if (ids.length === 0) {
      return false;
    }
    const currentIndex = ids.indexOf(state.activeId);
    const nextIndex = currentIndex === -1
      ? 0
      : Math.min(Math.max(currentIndex + step, 0), ids.length - 1);
    return select(ids[nextIndex]);
  }

  async function jumpBoundary(toBottom = false) {
    const state = options.getState();
    const ids = Array.isArray(state.filteredIds) ? state.filteredIds : [];
    if (ids.length === 0) {
      return false;
    }
    return select(toBottom ? ids.at(-1) : ids[0]);
  }

  return {
    refresh,
    select,
    moveSelection,
    jumpBoundary,
  };
}
