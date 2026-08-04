import { createNoteCardPresentation } from "./notePresentation.js";

function appendText(parent, className, text, tagName = "span") {
  const node = document.createElement(tagName);
  node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function renderButton(button, note, isActive, formatDate) {
  const presentation = createNoteCardPresentation(note, { formatDate });
  button.classList.toggle("active", isActive);
  button.toggleAttribute("aria-current", isActive);
  button.replaceChildren();

  const heading = document.createElement("span");
  heading.className = "note-item-heading";
  appendText(heading, "note-item-title", presentation.title, "strong");

  const metadata = document.createElement("span");
  metadata.className = "note-item-metadata";
  appendText(metadata, "note-item-date", presentation.date);
  if (presentation.pinned) {
    appendText(metadata, "note-item-state", "Pinned");
  }
  if (presentation.archived) {
    appendText(metadata, "note-item-state", "Archived");
  }
  heading.append(metadata);
  button.append(heading);

  if (presentation.preview) {
    appendText(button, "note-item-preview", presentation.preview, "p");
  }

  if (presentation.tags.length > 0) {
    appendText(
      button,
      "note-item-tags",
      presentation.tags.map((tag) => `#${tag}`).join(" "),
    );
  }
}

function createNode(note, isActive, onSelect, formatDate) {
  const container = document.createElement("div");
  container.className = "note-item-container";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "note-item";
  button.dataset.id = note.id;
  button.addEventListener("click", () => onSelect(note.id));
  renderButton(button, note, isActive, formatDate);

  container.append(button);
  return container;
}

function patchNode(node, note, isActive, formatDate) {
  const button = node.querySelector(".note-item");
  renderButton(button, note, isActive, formatDate);
}

export function createListView({ container, onSelect, formatDate }) {
  const nodeCache = new Map();
  const ROW_HEIGHT = 120;
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
        node = createNode(note, id === activeId, onSelect, formatDate);
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
