let activeRegistry = null;
const legacyRegistrations = new Set();

function legacyCommandId(id) {
  return `legacy.${String(id).replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}`;
}

export function registerPaletteCommands(provider) {
  if (typeof provider !== "function") {
    throw new TypeError("Palette command provider must be a function");
  }
  if (!activeRegistry) {
    throw new TypeError("Command registry is not composed");
  }

  const initial = provider();
  if (!Array.isArray(initial)) {
    throw new TypeError("Palette command provider must return an array");
  }

  const unregister = initial.map((legacy) => activeRegistry.register({
    id: legacyCommandId(legacy.id),
    title: legacy.title,
    description: legacy.description || legacy.title,
    shortcuts: [],
    scope: "shell",
    isAvailable: () => {
      const current = provider();
      return Array.isArray(current) && current.some((candidate) => candidate.id === legacy.id);
    },
    unavailableReason: () => "Japanese study data is unavailable",
    run: () => legacy.run(),
  }));

  const cleanup = () => {
    if (!legacyRegistrations.delete(cleanup)) {
      return false;
    }
    for (const remove of unregister) {
      remove();
    }
    return true;
  };
  legacyRegistrations.add(cleanup);
  return cleanup;
}

function shortcutLabel(shortcut, platform) {
  if (!shortcut) {
    return "";
  }
  if (Array.isArray(shortcut.sequence)) {
    return shortcut.sequence.join(" ");
  }

  const parts = [];
  if (shortcut.primaryModifier) {
    parts.push(platform === "darwin" ? "Cmd" : "Ctrl");
  }
  if (shortcut.shiftKey) {
    parts.push("Shift");
  }
  if (shortcut.altKey) {
    parts.push(platform === "darwin" ? "Option" : "Alt");
  }
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return parts.join("+");
}

function appendText(parent, className, text, tagName = "span") {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

export function createPalette({ root, input, list, registry, getContext }) {
  if (!registry || typeof registry.snapshot !== "function" || typeof registry.execute !== "function") {
    throw new TypeError("Invalid command registry");
  }
  if (typeof getContext !== "function") {
    throw new TypeError("Invalid command context provider");
  }
  if (activeRegistry && activeRegistry !== registry) {
    throw new TypeError("A different command registry is already composed");
  }
  activeRegistry = registry;

  let query = "";
  let commands = [];
  let selectedIndex = 0;
  let opener = null;
  let destroyed = false;

  function currentContext(overrides = {}) {
    return {
      ...getContext(),
      source: "palette",
      activeScope: "palette",
      paletteOpen: true,
      focusToken: "palette",
      ...overrides,
    };
  }

  function filtered() {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commands;
    }
    return commands.filter((command) => (
      command.title.toLowerCase().includes(normalized)
      || command.description.toLowerCase().includes(normalized)
      || command.unavailableReason.toLowerCase().includes(normalized)
    ));
  }

  function focusSelected() {
    const buttons = [...list.querySelectorAll("[data-command-id]")];
    if (buttons.length === 0) {
      return;
    }
    selectedIndex = Math.max(0, Math.min(selectedIndex, buttons.length - 1));
    buttons[selectedIndex].focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (root.hidden) {
      return;
    }
    root.hidden = true;
    registry.resetSequences();
    if (restoreFocus && opener instanceof HTMLElement && opener.isConnected && !opener.matches(":disabled")) {
      opener.focus();
    }
  }

  function runCommand(command) {
    if (!command.available) {
      return;
    }
    const context = currentContext();
    close({ restoreFocus: false });
    Promise.resolve(registry.execute(command.id, context))
      .finally(() => {
        const activeElement = document.activeElement;
        const commandMovedFocus = activeElement instanceof HTMLElement
          && activeElement !== document.body
          && !root.contains(activeElement);
        if (!commandMovedFocus
          && opener instanceof HTMLElement
          && opener.isConnected
          && !opener.matches(":disabled")) {
          opener.focus();
        }
      })
      .catch(() => undefined);
  }

  function render() {
    const current = filtered();
    selectedIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, current.length - 1)));
    list.replaceChildren();

    current.forEach((command, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-item";
      button.dataset.commandId = command.id;
      button.setAttribute("aria-disabled", String(!command.available));
      button.tabIndex = index === selectedIndex ? 0 : -1;

      const content = document.createElement("span");
      content.className = "command-item-content";
      appendText(content, "command-item-title", command.title, "strong");
      appendText(content, "command-item-description", command.description);
      if (!command.available) {
        appendText(content, "command-item-reason", `Unavailable — ${command.unavailableReason}`);
      }
      button.append(content);

      const label = shortcutLabel(command.shortcuts[0], currentContext().platform);
      if (label) {
        appendText(button, "command-item-shortcut", label, "kbd");
      }

      button.addEventListener("click", () => runCommand(command));
      button.addEventListener("focus", () => {
        selectedIndex = index;
      });
      list.append(button);
    });
  }

  function refresh() {
    commands = registry.snapshot(currentContext());
    render();
  }

  function open(nextOpener = document.activeElement) {
    if (destroyed) {
      return;
    }
    opener = nextOpener instanceof HTMLElement ? nextOpener : document.activeElement;
    query = "";
    selectedIndex = 0;
    root.hidden = false;
    input.value = "";
    refresh();
    input.focus();
  }

  function isOpen() {
    return !root.hidden;
  }

  function onInput(event) {
    query = event.target.value;
    selectedIndex = 0;
    render();
  }

  function onInputKeydown(event) {
    if (!["Escape", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      selectedIndex = Math.min(selectedIndex + 1, Math.max(0, filtered().length - 1));
      render();
      focusSelected();
      return;
    }
    if (event.key === "ArrowUp") {
      selectedIndex = Math.max(0, selectedIndex - 1);
      render();
      focusSelected();
      return;
    }

    const selected = filtered()[selectedIndex] ?? filtered()[0];
    if (selected) {
      runCommand(selected);
    }
  }

  function onListKeydown(event) {
    if (!["Escape", "ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const count = filtered().length;
      selectedIndex = count === 0 ? 0 : (selectedIndex + delta + count) % count;
      render();
      focusSelected();
      return;
    }

    const selected = filtered()[selectedIndex];
    if (selected) {
      runCommand(selected);
    }
  }

  function onRootClick(event) {
    if (event.target === root) {
      close();
    }
  }

  input.addEventListener("input", onInput);
  input.addEventListener("keydown", onInputKeydown);
  list.addEventListener("keydown", onListKeydown);
  root.addEventListener("click", onRootClick);

  return Object.freeze({
    open,
    close,
    isOpen,
    refresh,
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", onInputKeydown);
      list.removeEventListener("keydown", onListKeydown);
      root.removeEventListener("click", onRootClick);
      close({ restoreFocus: false });
      for (const cleanup of [...legacyRegistrations]) {
        cleanup();
      }
      if (activeRegistry === registry) {
        activeRegistry = null;
      }
    },
  });
}
