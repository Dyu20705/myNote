const commandProviders = new Set();

export function registerPaletteCommands(provider) {
  if (typeof provider !== "function") {
    throw new TypeError("Palette command provider must be a function");
  }
  commandProviders.add(provider);
  return () => commandProviders.delete(provider);
}

function providedCommands() {
  const commands = [];
  for (const provider of commandProviders) {
    const next = provider();
    if (Array.isArray(next)) {
      commands.push(...next);
    }
  }
  return commands;
}

export function createPalette({ root, input, list, onRun }) {
  let commands = [];
  let query = "";

  function filtered() {
    const q = query.trim().toLowerCase();
    if (!q) {
      return commands;
    }
    return commands.filter((item) => item.title.toLowerCase().includes(q));
  }

  function render() {
    const current = filtered();
    list.replaceChildren();

    for (const command of current) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "command-item";
      button.textContent = command.title;
      button.addEventListener("click", () => {
        close();
        onRun(command);
      });
      list.append(button);
    }
  }

  function open(nextCommands) {
    commands = [...nextCommands, ...providedCommands()];
    query = "";
    root.hidden = false;
    input.value = "";
    render();
    input.focus();
  }

  function close() {
    root.hidden = true;
  }

  function isOpen() {
    return !root.hidden;
  }

  input.addEventListener("input", (event) => {
    query = event.target.value;
    render();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const first = filtered()[0];
      if (first) {
        close();
        onRun(first);
      }
    }
  });

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      close();
    }
  });

  return { open, close, isOpen };
}
