let activeHistory = null;

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function getActiveHistory() {
  return activeHistory;
}

export function createHistory(maxEntries = 300) {
  const operations = [];
  const snapshots = [];

  function compactPatch(patch) {
    if (!Array.isArray(patch)) {
      return patch;
    }
    return patch.map((op) => ({ key: op.key, before: op.before, after: op.after }));
  }

  function record(operation) {
    const next = deepClone(operation);
    if (Array.isArray(next.patch)) {
      next.patch = compactPatch(next.patch);
      next.patchSize = next.patch.length;
    }

    operations.push(next);
    if (operations.length > maxEntries) {
      operations.shift();
    }

    if (operations.length > Math.floor(maxEntries * 0.8)) {
      for (let i = 0; i < operations.length - 120; i += 1) {
        if (operations[i].patch) {
          operations[i].patch = null;
        }
      }
    }
  }

  function snapshot(state) {
    snapshots.push({
      timestamp: new Date().toISOString(),
      state: deepClone(state),
    });
    if (snapshots.length > 30) {
      snapshots.shift();
    }
  }

  function getOperations() {
    return deepClone(operations);
  }

  function getSnapshots() {
    return deepClone(snapshots);
  }

  activeHistory = { record, snapshot, getOperations, getSnapshots };
  return activeHistory;
}
