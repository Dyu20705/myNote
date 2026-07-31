import { createSearchResultPipeline } from "./searchResultPipeline.js";

let activeSearchClient = null;

export function getActiveSearchClient() {
  return activeSearchClient;
}

export function createSearchClient() {
  const worker = new Worker(new URL("./search.worker.js", import.meta.url), { type: "module" });
  const resultPipeline = createSearchResultPipeline();
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

  activeSearchClient = {
    rebuild(notes) {
      return ask("rebuild", { notes });
    },
    upsert(note) {
      return ask("upsert", { note });
    },
    remove(id) {
      return ask("remove", { id });
    },
    async query(queryText) {
      const ids = await ask("query", { query: queryText });
      return resultPipeline.apply(ids, { queryText });
    },
    registerResultPolicy(policy) {
      return resultPipeline.register(policy);
    },
    close() {
      worker.terminate();
    },
  };
  return activeSearchClient;
}
