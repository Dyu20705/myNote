function overlayError() {
  return new TypeError("NOTE_EDITOR_OVERLAY_OPTIONS_INVALID");
}

function isFocusableElement(value) {
  return value instanceof globalThis.HTMLElement
    && value.isConnected
    && !value.matches(":disabled")
    && value.getClientRects().length > 0;
}

export function createNoteEditorOverlay(options = {}) {
  const {
    dialog,
    closeButton,
    modeLabel,
    titleInput,
    board,
    beforeClose,
    fallbackFocus,
  } = options;
  if (
    !dialog
    || typeof dialog.showModal !== "function"
    || typeof dialog.close !== "function"
    || !closeButton
    || !modeLabel
    || !titleInput
    || !board
    || typeof beforeClose !== "function"
    || typeof fallbackFocus !== "function"
  ) {
    throw overlayError();
  }

  const scrollOwner = board.closest(".notes-panel") || board;
  let opener = null;
  let returnCardId = "";
  let scrollTop = 0;
  let closingPromise = null;
  let destroyed = false;

  function replacementCard() {
    if (!returnCardId) {
      return null;
    }
    return [...board.querySelectorAll(".note-item")]
      .find((card) => card.dataset.id === returnCardId) ?? null;
  }

  function restoreBoardContext() {
    scrollOwner.scrollTop = scrollTop;
    const target = replacementCard()
      || (isFocusableElement(opener) ? opener : null)
      || fallbackFocus();
    if (isFocusableElement(target)) {
      target.focus({ preventScroll: true });
    }
    globalThis.requestAnimationFrame(() => {
      scrollOwner.scrollTop = scrollTop;
    });
  }

  function open({ opener: nextOpener = null, mode = "edit" } = {}) {
    if (destroyed) {
      throw overlayError();
    }
    const normalizedMode = mode === "create" ? "create" : "edit";
    if (!dialog.open) {
      opener = isFocusableElement(nextOpener) ? nextOpener : null;
      returnCardId = nextOpener?.classList?.contains("note-item")
        ? nextOpener.dataset.id || ""
        : "";
      scrollTop = scrollOwner.scrollTop;
      dialog.dataset.mode = normalizedMode;
      modeLabel.textContent = normalizedMode === "create" ? "Create note" : "Edit note";
      dialog.showModal();
    }
    queueMicrotask(() => titleInput.focus());
  }

  function requestClose() {
    if (!dialog.open) {
      return Promise.resolve(false);
    }
    if (closingPromise) {
      return closingPromise;
    }

    closeButton.disabled = true;
    closeButton.setAttribute("aria-busy", "true");
    closingPromise = Promise.resolve()
      .then(beforeClose)
      .then(() => {
        dialog.close();
        restoreBoardContext();
        return true;
      })
      .finally(() => {
        closeButton.disabled = false;
        closeButton.removeAttribute("aria-busy");
        closingPromise = null;
      });
    return closingPromise;
  }

  function handleCloseClick() {
    requestClose().catch(() => undefined);
  }

  function handleCancel(event) {
    event.preventDefault();
    requestClose().catch(() => undefined);
  }

  closeButton.addEventListener("click", handleCloseClick);
  dialog.addEventListener("cancel", handleCancel);

  return Object.freeze({
    open,
    requestClose,
    isOpen: () => dialog.open,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      closeButton.removeEventListener("click", handleCloseClick);
      dialog.removeEventListener("cancel", handleCancel);
    },
  });
}
