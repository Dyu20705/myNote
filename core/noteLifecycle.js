export function createNoteLifecycle({
  persistUpsert,
  persistRemove,
  commitUpsert,
  commitRemove,
  updateDerivedUpsert,
  updateDerivedRemove,
  onCanonicalFailure = () => {},
  onDerivedFailure = () => {},
  onSuccess = () => {},
}) {
  async function execute(operation, persist, commit, updateDerived) {
    try {
      await persist();
    } catch (error) {
      onCanonicalFailure({ operation, subsystem: "storage", error });
      throw error;
    }

    commit();

    try {
      await updateDerived();
    } catch (error) {
      onDerivedFailure({ operation, subsystem: "derived-index", error });
      return { derivedDegraded: true };
    }

    onSuccess({ operation });
    return { derivedDegraded: false };
  }

  function upsert(note, context = {}) {
    return execute(
      "upsert",
      () => persistUpsert(note, context),
      () => commitUpsert(note, context),
      () => updateDerivedUpsert(note, context)
    );
  }

  function remove(id, context = {}) {
    return execute(
      "remove",
      () => persistRemove(id, context),
      () => commitRemove(id, context),
      () => updateDerivedRemove(id, context)
    );
  }

  return { upsert, remove };
}