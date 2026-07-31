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

export function createPalette({ overlay, input, list, onRun }) {
  let commands = [];
  let activeIndex = 0;

  function filtered() {
    const query = input.value.trim().toLowerCase();
    return commands.filter((command) => command.title.toLowerCase().includes(query));
  }

  function render() {
    const visible = filtered();
    list.textContent = "";
    visible.forEach((command, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `palette-item ${index === activeIndex ? "active" : ""}`;
      item.textContent = command.title;
      item.addEventListener("click", () => {
        close();
        onRun(command);
      });
      list.appendChild(item);
    });
  }

  function open(nextCommands) {
    commands = [...nextCommands, ...providedCommands()];
    activeIndex = 0;
    overlay.classList.remove("hidden");
    input.value = "";
    render();
    input.focus();
  }

  function close() {
    overlay.classList.add("hidden");
  }

  input.addEventListener("input", () => {
    activeIndex = 0;
    render();
  });

  input.addEventListener("keydown", (event) => {
    const visible = filtered();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(0, visible.length - 1));
      render();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      render();
    } else if (event.key === "Enter" && visible[activeIndex]) {
      event.preventDefault();
      close();
      onRun(visible[activeIndex]);
    } else if (event.key === "Escape") {
      close();
    }
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  return { open, close };
}
