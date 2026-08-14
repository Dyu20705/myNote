function descriptor({ kind, tone = "", message = "", announce = "off", persistent = false, actionId = null }) {
  return Object.freeze({ kind, tone, message, announce, persistent, actionId });
}

export function presentBoardState({ total, visible, japanese }) {
  if (total === 0) {
    return descriptor({
      kind: "empty",
      message: japanese ? "No Japanese notes yet" : "No notes yet",
      actionId: japanese ? "create-japanese-note" : "create-note",
    });
  }
  if (visible === 0) {
    return descriptor({
      kind: "no-match",
      message: japanese ? "No Japanese notes match these filters" : "No notes match this search",
      actionId: japanese ? null : "clear-search",
    });
  }
  return descriptor({ kind: "ready" });
}

export function presentNoteState({ dirty, phase, failureKind }) {
  if (failureKind === "edit") {
    return descriptor({ kind: "failure", tone: "danger", message: "Save failed. Your draft is preserved.", announce: "assertive", persistent: true, actionId: "retry-save" });
  }
  if (failureKind === "create") {
    return descriptor({ kind: "failure", tone: "danger", message: "Couldn't create note. No note was added. Try again.", announce: "assertive", persistent: true, actionId: "create-note" });
  }
  if (failureKind === "delete") {
    return descriptor({ kind: "failure", tone: "danger", message: "Delete failed. The note is unchanged. Try again.", announce: "assertive", persistent: true });
  }
  if (failureKind === "archive" || failureKind === "pin") {
    return descriptor({ kind: "failure", tone: "danger", message: "Change couldn't be saved. The note is unchanged. Try again.", announce: "assertive", persistent: true });
  }
  if (phase === "saving") return descriptor({ kind: "saving", message: "Saving…" });
  if (dirty) return descriptor({ kind: "unsaved", tone: "warning", message: "Unsaved" });
  return descriptor({ kind: "saved", tone: "success", message: "Saved" });
}

export function presentDerivedState({ searchUnavailable }) {
  return searchUnavailable
    ? descriptor({ kind: "degraded", tone: "warning", message: "Saved. Search is temporarily unavailable.", announce: "polite", persistent: true })
    : descriptor({ kind: "ready" });
}

export function presentDrawingState({ status, errorCode }) {
  if (errorCode === "KANJI_SAVE_FAILED") {
    return descriptor({ kind: "failure", tone: "danger", message: "Save failed. Your drawing is preserved.", announce: "assertive", persistent: true, actionId: "retry-drawing-save" });
  }
  if (status === "saving") return descriptor({ kind: "saving", message: "Saving drawing…" });
  if (status === "saved") return descriptor({ kind: "saved", tone: "success" });
  return descriptor({ kind: "ready" });
}

export function presentJapaneseReviewState({ phase }) {
  if (phase === "rating-failed") {
    return descriptor({ kind: "failure", tone: "danger", message: "Rating wasn't saved. This review item is unchanged. Try again.", announce: "assertive", persistent: true, actionId: "retry-rating" });
  }
  if (phase === "rating-pending") return descriptor({ kind: "saving", message: "Saving rating…" });
  if (phase === "complete") return descriptor({ kind: "complete", message: "Review complete" });
  return descriptor({ kind: "ready" });
}

export function presentApplicationRecoveryState({ storageUnavailable, resetConfirmationOpen, resetFailed }) {
  if (resetFailed) {
    return descriptor({ kind: "reset-failure", tone: "danger", message: "Reset failed. Local data was not cleared.", announce: "assertive", persistent: true, actionId: "retry-storage" });
  }
  if (!storageUnavailable) return descriptor({ kind: "ready" });
  if (resetConfirmationOpen) {
    return descriptor({ kind: "reset-confirmation", tone: "danger", message: "Reset local data? This permanently removes local myNote data on this device.", persistent: true, actionId: "confirm-reset" });
  }
  return descriptor({ kind: "storage-failure", tone: "danger", message: "Local storage couldn't be opened. Your existing local data has not been reset.", announce: "assertive", persistent: true, actionId: "retry-storage" });
}
