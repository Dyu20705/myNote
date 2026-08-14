import {
  createNoteBoardSections,
  createNoteCardPresentation,
} from "./notePresentation.js";

const VIRTUALIZATION_THRESHOLD = 500;
const VIRTUAL_ROW_HEIGHT = 168;
const VIRTUAL_OVERSCAN = 8;
let nextListViewId = 0;

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
  if (isActive) {
    button.setAttribute("aria-current", "true");
  } else {
    button.removeAttribute("aria-current");
  }
  button.replaceChildren();

  const heading = document.createElement("span");
  heading.className = "note-item-heading";
  appendText(heading, "note-item-title", presentation.title, "strong");

  const metadata = document.createElement("span");
  metadata.className = "note-item-metadata";
  appendText(metadata, "note-item-date", presentation.date);
  if (presentation.pinned) appendText(metadata, "note-item-state", "Pinned");
  if (presentation.archived) appendText(metadata, "note-item-state", "Archived");
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
  button.addEventListener("click", () => onSelect(note.id, button));
  renderButton(button, note, isActive, formatDate);

  container.append(button);
  return container;
}

function patchNode(node, note, isActive, formatDate) {
  const button = node.querySelector(".note-item");
  renderButton(button, note, isActive, formatDate);
}

function createSection(section, nodes, viewId) {
  const root = document.createElement("section");
  root.className = "note-board-section";
  root.dataset.sectionId = section.id;

  const heading = document.createElement("h3");
  heading.id = `note-board-${viewId}-${section.id}-heading`;
  heading.className = "note-board-heading";
  heading.textContent = section.label;
  root.setAttribute("aria-labelledby", heading.id);

  const grid = document.createElement("div");
  grid.className = "note-board-grid";
  grid.append(...nodes);
  root.append(heading, grid);
  return root;
}

function actionLabel(actionId) {
  if (actionId === "create-note") return "New note";
  if (actionId === "create-japanese-note") return "New Japanese note";
  if (actionId === "clear-search") return "Clear search";
  return "";
}

export function createListView({ container, onSelect, onEmptyAction = () => {}, formatDate }) {
  const viewId = nextListViewId;
  nextListViewId += 1;
  const nodeCache = new Map();
  const scrollOwner = container.closest(".notes-panel") || container;
  let currentPayload = {
    notesById: new Map(),
    orderedIds: [],
    activeId: null,
    query: "",
    boardIds: [],
    virtualized: false,
  };

  function projectSections(notesById, orderedIds) {
    return createNoteBoardSections({ notesById, orderedIds })
      .filter((section) => section.orderedIds.length > 0);
  }

  function createCardNodes(sections, retainedIds) {
    const { notesById, activeId } = currentPayload;
    return sections.map((section) => {
      const nodes = section.orderedIds.map((id) => {
        const note = notesById.get(id);
        let node = nodeCache.get(id);
        if (!node) {
          node = createNode(note, id === activeId, onSelect, formatDate);
          nodeCache.set(id, node);
        } else {
          patchNode(node, note, id === activeId, formatDate);
        }
        retainedIds.add(id);
        return node;
      });
      return createSection(section, nodes, viewId);
    });
  }

  function pruneCache(retainedIds) {
    for (const id of nodeCache.keys()) {
      if (!retainedIds.has(id)) nodeCache.delete(id);
    }
  }

  function renderCompleteBoard(sections) {
    const retainedIds = new Set();
    const roots = createCardNodes(sections, retainedIds);
    pruneCache(retainedIds);
    container.replaceChildren(...roots);
  }

  function renderWindow() {
    const { notesById, boardIds } = currentPayload;
    const scrollTop = scrollOwner.scrollTop;
    const viewport = Math.max(
      scrollOwner.clientHeight || VIRTUAL_ROW_HEIGHT * 6,
      VIRTUAL_ROW_HEIGHT * 6,
    );

    const rawStart = Math.max(
      0,
      Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN,
    );
    const maxStart = Math.max(0, boardIds.length - 1);
    const startIndex = Math.min(rawStart, maxStart);
    const visibleCount = Math.ceil(viewport / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const endIndex = Math.min(boardIds.length, startIndex + visibleCount);
    const visibleIds = boardIds.slice(startIndex, endIndex);
    const sections = projectSections(notesById, visibleIds);
    const retainedIds = new Set();
    const fragment = document.createDocumentFragment();

    const topSpacer = document.createElement("div");
    topSpacer.className = "list-spacer";
    topSpacer.style.height = `${startIndex * VIRTUAL_ROW_HEIGHT}px`;
    fragment.append(topSpacer);
    fragment.append(...createCardNodes(sections, retainedIds));
    pruneCache(retainedIds);

    const bottomSpacer = document.createElement("div");
    bottomSpacer.className = "list-spacer";
    bottomSpacer.style.height = `${Math.max(
      0,
      (boardIds.length - endIndex) * VIRTUAL_ROW_HEIGHT,
    )}px`;
    fragment.append(bottomSpacer);

    container.replaceChildren(fragment);
  }

  function clearToEmpty(presentation) {
    nodeCache.clear();
    container.dataset.virtualized = "false";
    container.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty-state";
    const message = document.createElement("p");
    message.textContent = presentation?.message || "No notes";
    empty.append(message);

    const label = actionLabel(presentation?.actionId);
    if (presentation?.actionId && label) {
      const action = document.createElement("button");
      action.type = "button";
      action.className = presentation.actionId === "clear-search"
        ? "secondary-button"
        : "primary-button";
      action.textContent = label;
      action.addEventListener("click", () => onEmptyAction(presentation.actionId, action));
      empty.append(action);
    }

    container.append(empty);
  }

  function render({ notesById, orderedIds, activeId, query, emptyPresentation }) {
    const sections = projectSections(notesById, orderedIds);
    const boardIds = sections.flatMap((section) => section.orderedIds);
    const virtualized = boardIds.length >= VIRTUALIZATION_THRESHOLD;
    currentPayload = {
      notesById,
      orderedIds,
      activeId,
      query,
      boardIds,
      virtualized,
    };
    container.dataset.virtualized = String(virtualized);

    if (boardIds.length === 0) {
      clearToEmpty(emptyPresentation);
      return;
    }

    if (virtualized) renderWindow();
    else renderCompleteBoard(sections);
  }

  scrollOwner.addEventListener("scroll", () => {
    if (currentPayload.virtualized) renderWindow();
  });

  return { render };
}
