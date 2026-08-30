function toolbarError() {
  const error = new TypeError("EDITOR_TOOLBAR_OPTIONS_INVALID");
  error.code = "EDITOR_TOOLBAR_OPTIONS_INVALID";
  return error;
}

const TOOLBAR_ACTIONS = [
  { id: "bold", label: "Bold", title: "Bold (Ctrl+B)", text: "B", tag: "strong" },
  { id: "italic", label: "Italic", title: "Italic (Ctrl+I)", text: "I", tag: "em" },
  { id: "strikethrough", label: "Strikethrough", title: "Strikethrough", text: "S", tag: "s" },
  { id: "code", label: "Inline code", title: "Inline code", text: "<>", tag: "code" },
  { id: "separator-1", isSeparator: true },
  { id: "link", label: "Insert link", title: "Insert link", text: "Link", tag: "span" },
  { id: "heading", label: "Heading", title: "Cycle heading (#)", text: "H", tag: "strong" },
  { id: "task", label: "Task item", title: "Task item", text: "☑", tag: "span" },
  { id: "separator-2", isSeparator: true },
  { id: "kanji-draw", label: "Insert Kanji Drawing", title: "Add Kanji drawing", text: "描", tag: "span" },
];

export function createEditorToolbar(options = {}) {
  const { container, textarea, onAction, document: doc = globalThis.document } = options;

  if (
    !container ||
    !textarea ||
    typeof onAction !== "function" ||
    !doc ||
    typeof doc.createElement !== "function"
  ) {
    throw toolbarError();
  }

  let destroyed = false;
  let active = false;
  const buttons = [];

  function createButton(action) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "editor-toolbar-button";
    button.tabIndex = -1;
    button.dataset.action = action.id;
    button.setAttribute("aria-label", action.label);
    button.title = action.title;

    const content = doc.createElement(action.tag || "span");
    content.textContent = action.text;
    button.append(content);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      active = true;
      onAction(action.id);
    });

    return button;
  }

  function render() {
    container.replaceChildren();

    for (const item of TOOLBAR_ACTIONS) {
      if (item.isSeparator) {
        const sep = doc.createElement("span");
        sep.className = "editor-toolbar-separator";
        sep.setAttribute("aria-hidden", "true");
        container.append(sep);
      } else {
        const button = createButton(item);
        buttons.push(button);
        container.append(button);
      }
    }
  }

  function syncVisibilityFromSelection() {
    if (destroyed) return;
    const isTextareaFocused = doc.activeElement === textarea;
    const isToolbarFocused = doc.activeElement && (container === doc.activeElement || container.contains?.(doc.activeElement));
    const hasSelection = typeof textarea.selectionStart === "number" &&
      typeof textarea.selectionEnd === "number" &&
      textarea.selectionStart !== textarea.selectionEnd;

    if (hasSelection && (isTextareaFocused || isToolbarFocused)) {
      active = true;
      container.hidden = false;
    } else if (!isToolbarFocused && !active) {
      container.hidden = true;
    }
  }

  function handleKeydown(event) {
    if (container.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      active = false;
      container.hidden = true;
      textarea.focus();
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const activeIdx = buttons.indexOf(doc.activeElement);
      if (activeIdx === -1) {
        buttons[0]?.focus();
        return;
      }

      event.preventDefault();
      const nextIdx =
        event.key === "ArrowRight"
          ? (activeIdx + 1) % buttons.length
          : (activeIdx - 1 + buttons.length) % buttons.length;
      buttons[nextIdx]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    }
  }

  function handleTextareaEvents() {
    syncVisibilityFromSelection();
  }

  container.addEventListener("keydown", handleKeydown);
  textarea.addEventListener?.("select", handleTextareaEvents);
  textarea.addEventListener?.("pointerup", handleTextareaEvents);
  textarea.addEventListener?.("keyup", handleTextareaEvents);
  textarea.addEventListener?.("blur", () => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => {
        const isToolbarFocused = doc.activeElement && (container === doc.activeElement || container.contains?.(doc.activeElement));
        if (!isToolbarFocused && doc.activeElement !== textarea) {
          active = false;
          container.hidden = true;
        }
      });
    }
  });

  render();

  return Object.freeze({
    show() {
      if (destroyed) return;
      active = true;
      container.hidden = false;
    },
    hide() {
      if (destroyed) return;
      active = false;
      container.hidden = true;
    },
    syncSelection() {
      syncVisibilityFromSelection();
    },
    isVisible() {
      return !container.hidden;
    },
    focus() {
      if (buttons.length > 0) {
        active = true;
        container.hidden = false;
        buttons[0].focus();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active = false;
      container.removeEventListener("keydown", handleKeydown);
      textarea.removeEventListener?.("select", handleTextareaEvents);
      textarea.removeEventListener?.("pointerup", handleTextareaEvents);
      textarea.removeEventListener?.("keyup", handleTextareaEvents);
      container.replaceChildren();
    },
  });
}
