let activeStore = null;

export function getActiveStore() {
  return activeStore;
}

export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(next) {
    const patch = typeof next === "function" ? next(state) : next;
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  activeStore = { getState, setState, subscribe };
  return activeStore;
}
