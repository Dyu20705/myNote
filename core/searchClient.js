export function createSearchClient() {
  const worker = new Worker(new URL("./search.worker.js", import.meta.url), { type: "module" });
  let sequence = 0;
  const pending = new Map();

  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data;
    const resolver = pending.get(id);
    if (!resolver) {
      return;
    }
    pending.delete(id);
    if (ok) {
      resolver.resolve(result);
    } else {
      resolver.reject(new Error(error || "Search worker failed"));
    }
  };

  function ask(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  }

  return {
    rebuild(notes) {
      return ask("rebuild", { notes });
    },
    upsert(note) {
      return ask("upsert", { note });
    },
    remove(id) {
      return ask("remove", { id });
    },
    query(queryText) {
      return ask("query", { query: queryText });
    },
    close() {
      worker.terminate();
    },
  };
}
