let activeBacklinkIndex = null;

function keyOf(value) {
  return String(value || "").trim().toLowerCase();
}

function cloneMapOfSets(input) {
  const output = new Map();
  for (const [key, values] of input.entries()) {
    output.set(key, new Set(values));
  }
  return output;
}

export function getActiveBacklinkIndex() {
  return activeBacklinkIndex;
}

export function createBacklinkIndex() {
  const notesById = new Map();
  const titleToId = new Map();
  const sourceToTitles = new Map();
  const sourceToTargets = new Map();
  const titleRefs = new Map();
  const backlinks = new Map();

  function removeResolvedEdgesForSource(sourceId) {
    const targets = sourceToTargets.get(sourceId);
    if (!targets) {
      return;
    }

    for (const targetId of targets) {
      const bucket = backlinks.get(targetId);
      if (!bucket) {
        continue;
      }
      bucket.delete(sourceId);
      if (bucket.size === 0) {
        backlinks.delete(targetId);
      }
    }

    sourceToTargets.delete(sourceId);
  }

  function removeTitleRefsForSource(sourceId) {
    const titles = sourceToTitles.get(sourceId);
    if (!titles) {
      return;
    }

    for (const title of titles) {
      const refs = titleRefs.get(title);
      if (!refs) {
        continue;
      }
      refs.delete(sourceId);
      if (refs.size === 0) {
        titleRefs.delete(title);
      }
    }

    sourceToTitles.delete(sourceId);
  }

  function setTitleRefsForSource(sourceId, note) {
    const titles = new Set((note.links || []).map(keyOf).filter(Boolean));
    sourceToTitles.set(sourceId, titles);

    for (const title of titles) {
      if (!titleRefs.has(title)) {
        titleRefs.set(title, new Set());
      }
      titleRefs.get(title).add(sourceId);
    }
  }

  function resolveSource(sourceId) {
    const note = notesById.get(sourceId);
    if (!note) {
      return;
    }

    removeResolvedEdgesForSource(sourceId);

    const targetIds = new Set();
    const titles = sourceToTitles.get(sourceId) || new Set();
    for (const title of titles) {
      const targetId = titleToId.get(title);
      if (!targetId || targetId === sourceId) {
        continue;
      }
      targetIds.add(targetId);
    }

    if (targetIds.size > 0) {
      sourceToTargets.set(sourceId, targetIds);
      for (const targetId of targetIds) {
        if (!backlinks.has(targetId)) {
          backlinks.set(targetId, new Set());
        }
        backlinks.get(targetId).add(sourceId);
      }
    }
  }

  function removeTitleOwnership(note) {
    const title = keyOf(note.title);
    if (!title) {
      return;
    }

    if (titleToId.get(title) === note.id) {
      titleToId.delete(title);

      for (const candidate of notesById.values()) {
        if (candidate.id !== note.id && keyOf(candidate.title) === title) {
          titleToId.set(title, candidate.id);
          break;
        }
      }
    }
  }

  function rebuild(notes) {
    notesById.clear();
    titleToId.clear();
    sourceToTitles.clear();
    sourceToTargets.clear();
    titleRefs.clear();
    backlinks.clear();

    for (const note of notes) {
      notesById.set(note.id, note);
      titleToId.set(keyOf(note.title), note.id);
    }

    for (const note of notes) {
      setTitleRefsForSource(note.id, note);
    }

    for (const note of notes) {
      resolveSource(note.id);
    }
  }

  function upsert(note, previous = null) {
    const oldNote = previous || notesById.get(note.id) || null;
    const oldTitle = oldNote ? keyOf(oldNote.title) : "";
    const nextTitle = keyOf(note.title);

    notesById.set(note.id, note);
    titleToId.set(nextTitle, note.id);

    removeTitleRefsForSource(note.id);
    setTitleRefsForSource(note.id, note);

    const affectedSourceIds = new Set([note.id]);

    if (oldTitle && oldTitle !== nextTitle) {
      removeTitleOwnership(oldNote);
      const oldRefs = titleRefs.get(oldTitle) || new Set();
      for (const id of oldRefs) {
        affectedSourceIds.add(id);
      }
    }

    const nextRefs = titleRefs.get(nextTitle) || new Set();
    for (const id of nextRefs) {
      affectedSourceIds.add(id);
    }

    for (const sourceId of affectedSourceIds) {
      resolveSource(sourceId);
    }
  }

  function remove(id) {
    const note = notesById.get(id);
    if (!note) {
      return;
    }

    const title = keyOf(note.title);
    const affectedSourceIds = new Set(titleRefs.get(title) || []);

    removeResolvedEdgesForSource(id);
    removeTitleRefsForSource(id);
    removeTitleOwnership(note);
    notesById.delete(id);

    for (const sourceId of affectedSourceIds) {
      resolveSource(sourceId);
    }
  }

  function toMap() {
    return cloneMapOfSets(backlinks);
  }

  activeBacklinkIndex = {
    rebuild,
    upsert,
    remove,
    toMap,
  };
  return activeBacklinkIndex;
}
