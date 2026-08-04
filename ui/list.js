function createNode(note, isActive, onSelect, formatDate, onDelete) {
  const container = document.createElement("div");
  container.className = "note-item-container";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "note-item";
  button.dataset.id = note.id;
  if (isActive) {
    button.classList.add("active");
  }

  const title = document.createElement("strong");
  title.className = "note-item-title";
  title.textContent = note.pinned ? `* ${note.title}` : note.title;

  const date = document.createElement("span");
  date.className = "note-item-date";
  date.textContent = formatDate(note.updatedAt);

  const preview = document.createElement("p");
  preview.className = "note-item-preview";
  preview.textContent = note.content.trim().replace(/\s+/g, " ").slice(0, 120) || "Empty note";

  const tags = document.createElement("span");
  tags.className = "note-item-tags";
  tags.textContent = note.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ");

  button.append(title, date, preview, tags);
  button.addEventListener("click", () => onSelect(note.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "note-item-delete";
  deleteBtn.textContent = "×";
  deleteBtn.title = "Delete note";
  deleteBtn.setAttribute("aria-label", "Delete note");
  deleteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(note.id);
    }
  });

  container.append(button, deleteBtn);
  return container;
}

function patchNode(node, note, isActive, formatDate) {
  const button = node.querySelector(".note-item");
  button.classList.toggle("active", isActive);

  const title = node.querySelector(".note-item-title");
  const date = node.querySelector(".note-item-date");
  const preview = node.querySelector(".note-item-preview");
  const tags = node.querySelector(".note-item-tags");

  title.textContent = note.pinned ? `* ${note.title}` : note.title;
  date.textContent = formatDate(note.updatedAt);
  preview.textContent = note.content.trim().replace(/\s+/g, " ").slice(0, 120) || "Empty note";
  tags.textContent = note.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ");
}

export function createListView({ container, onSelect, formatDate, onDelete }) {
  const nodeCache = new Map();
  const ROW_HEIGHT = 112;
  const OVERSCAN = 8;
  let currentPayload = {
    notesById: new Map(),
    orderedIds: [],
    activeId: null,
    query: "",
  };

  function renderWindow() {
    const { notesById, orderedIds, activeId } = currentPayload;
    const scrollTop = container.scrollTop;
    const viewport = Math.max(container.clientHeight || ROW_HEIGHT * 6, ROW_HEIGHT * 6);

    const rawStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const maxStart = Math.max(0, orderedIds.length - 1);
    const startIndex = Math.min(rawStart, maxStart);
    const visibleCount = Math.ceil(viewport / ROW_HEIGHT) + OVERSCAN * 2;
    const endIndex = Math.min(orderedIds.length, startIndex + visibleCount);

    const visibleIds = orderedIds.slice(startIndex, endIndex);
    const fragment = document.createDocumentFragment();

    const topSpacer = document.createElement("div");
    topSpacer.className = "list-spacer";
    topSpacer.style.height = `${startIndex * ROW_HEIGHT}px`;
    fragment.append(topSpacer);

    const seen = new Set();
    for (const id of visibleIds) {
      const note = notesById.get(id);
      if (!note) {
        continue;
      }

      let node = nodeCache.get(id);
      if (!node) {
        node = createNode(note, id === activeId, onSelect, formatDate, onDelete);
        nodeCache.set(id, node);
      } else {
        patchNode(node, note, id === activeId, formatDate);
      }

      seen.add(id);
      fragment.append(node);
    }

    for (const id of nodeCache.keys()) {
      if (!seen.has(id) && !orderedIds.includes(id)) {
        nodeCache.delete(id);
      }
    }

    const bottomSpacer = document.createElement("div");
    bottomSpacer.className = "list-spacer";
    bottomSpacer.style.height = `${Math.max(0, (orderedIds.length - endIndex) * ROW_HEIGHT)}px`;
    fragment.append(bottomSpacer);

    container.replaceChildren(fragment);
  }

  function clearToEmpty(message) {
    nodeCache.clear();
    container.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    container.append(empty);
  }

  function render({ notesById, orderedIds, activeId, query }) {
    currentPayload = { notesById, orderedIds, activeId, query };

    if (orderedIds.length === 0) {
      clearToEmpty(query ? "No notes match this search." : "No notes yet. Create one to start.");
      return;
    }

    renderWindow();
  }

  container.addEventListener("scroll", () => {
    if (currentPayload.orderedIds.length > 0) {
      renderWindow();
    }
  });

  return { render };
}
