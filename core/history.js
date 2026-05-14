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
    const next = { ...operation };
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
      state,
    });
    if (snapshots.length > 30) {
      snapshots.shift();
    }
  }

  function getOperations() {
    return operations.slice();
  }

  function getSnapshots() {
    return snapshots.slice();
  }

  return { record, snapshot, getOperations, getSnapshots };
}
