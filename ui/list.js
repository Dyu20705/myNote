import {
  createNoteBoardSections,
  createNoteCardPresentation,
} from "./notePresentation.js";

const VIRTUALIZATION_THRESHOLD = 500;
/**
 * Invariant Row Geometries:
 * - Grid View: 152px card height + 16px row gap (--mn-space-4) = 168px deterministic row height.
 * - List View: 88px card height + 8px row gap (--mn-space-2) = 96px deterministic row height.
 * Fixed card bounding boxes and multi-line text clamping in styles.css enforce this invariant
 * across variable content lengths without DOM height recalculation drift.
 */
const VIRTUAL_ROW_HEIGHT_GRID = 168;
const VIRTUAL_ROW_HEIGHT_LIST = 96;
const VIRTUAL_OVERSCAN = 8;
let nextListViewId = 0;

function getRowHeight(viewMode) {
  return viewMode === "grid" ? VIRTUAL_ROW_HEIGHT_GRID : VIRTUAL_ROW_HEIGHT_LIST;
}

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

function actionAccessibleLabel(actionId) {
  if (actionId === "create-note") return "Create first note";
  if (actionId === "create-japanese-note") return "Create first Japanese note";
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
    viewMode: "list",
  };

  function projectSections(notesById, orderedIds, query = "") {
    return createNoteBoardSections({ notesById, orderedIds, query })
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

  function computeGridColumns(viewMode) {
    if (viewMode !== "grid") return 1;
    if (typeof window !== "undefined" && window.getComputedStyle) {
      // 1. Inspect existing rendered grid in container
      const existingGrid = container.querySelector(".note-board-grid");
      if (existingGrid) {
        const template = window.getComputedStyle(existingGrid).gridTemplateColumns;
        if (template && template !== "none") {
          const cols = template.trim().split(/\s+/).filter(Boolean).length;
          if (cols > 0) return cols;
        }
      }

      // 2. If no grid is mounted yet, measure via a lightweight layout probe inheriting CSS styles
      const probe = document.createElement("div");
      probe.className = "note-board-grid";
      probe.style.visibility = "hidden";
      probe.style.position = "absolute";
      probe.style.pointerEvents = "none";
      container.append(probe);
      const template = window.getComputedStyle(probe).gridTemplateColumns;
      probe.remove();
      if (template && template !== "none") {
        const cols = template.trim().split(/\s+/).filter(Boolean).length;
        if (cols > 0) return cols;
      }
    }

    // Fallback if computed styles are unavailable (e.g. non-browser environment)
    const width = container.clientWidth || scrollOwner.clientWidth || 800;
    return Math.max(1, Math.floor(width / 300));
  }

  function renderWindow() {
    const { notesById, boardIds, query, viewMode } = currentPayload;
    const cols = computeGridColumns(viewMode);
    const rowHeight = getRowHeight(viewMode);
    const totalItems = boardIds.length;
    const totalRows = Math.ceil(totalItems / cols);

    const scrollTop = scrollOwner.scrollTop;
    const viewport = Math.max(
      scrollOwner.clientHeight || rowHeight * 6,
      rowHeight * 6,
    );

    const rawStartRow = Math.max(
      0,
      Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN,
    );
    const maxStartRow = Math.max(0, totalRows - 1);
    const startRow = Math.min(rawStartRow, maxStartRow);
    const visibleRowCount = Math.ceil(viewport / rowHeight) + VIRTUAL_OVERSCAN * 2;
    const endRow = Math.min(totalRows, startRow + visibleRowCount);

    const startIndex = startRow * cols;
    const endIndex = Math.min(totalItems, endRow * cols);
    const visibleIds = boardIds.slice(startIndex, endIndex);
    const sections = projectSections(notesById, visibleIds, query);
    const retainedIds = new Set();
    const fragment = document.createDocumentFragment();

    const topSpacer = document.createElement("div");
    topSpacer.className = "list-spacer";
    topSpacer.style.height = `${startRow * rowHeight}px`;
    fragment.append(topSpacer);
    fragment.append(...createCardNodes(sections, retainedIds));
    pruneCache(retainedIds);

    const bottomSpacer = document.createElement("div");
    bottomSpacer.className = "list-spacer";
    bottomSpacer.style.height = `${Math.max(
      0,
      (totalRows - endRow) * rowHeight,
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
      const accessibleLabel = actionAccessibleLabel(presentation.actionId);
      if (accessibleLabel) action.setAttribute("aria-label", accessibleLabel);
      action.addEventListener("click", () => onEmptyAction(presentation.actionId, action));
      empty.append(action);
    }

    container.append(empty);
  }

  function getGridColumnCount() {
    const items = [...container.querySelectorAll(".note-item")];
    if (items.length < 2) return computeGridColumns(currentPayload.viewMode);
    const firstTop = items[0].getBoundingClientRect().top;
    let count = 0;
    for (const item of items) {
      if (Math.abs(item.getBoundingClientRect().top - firstTop) < 15) {
        count += 1;
      } else {
        break;
      }
    }
    return Math.max(1, count);
  }

  function handleKeyNavigation(event) {
    const target = event.target?.closest?.(".note-item");
    if (!target) return;

    const items = [...container.querySelectorAll(".note-item")];
    const currentIndex = items.indexOf(target);
    if (currentIndex === -1) return;

    const isGrid = container.dataset.viewMode === "grid";
    const cols = isGrid ? getGridColumnCount() : 1;
    let nextIndex;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = Math.min(items.length - 1, currentIndex + 1);
        break;
      case "ArrowLeft":
        nextIndex = Math.max(0, currentIndex - 1);
        break;
      case "ArrowDown":
        nextIndex = Math.min(items.length - 1, currentIndex + cols);
        break;
      case "ArrowUp":
        nextIndex = Math.max(0, currentIndex - cols);
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex !== -1 && nextIndex !== currentIndex) {
      event.preventDefault();
      const nextItem = items[nextIndex];
      nextItem.focus();
    }
  }

  function render({ notesById, orderedIds, activeId, query = "", emptyPresentation, viewMode = "list" }) {
    const sections = projectSections(notesById, orderedIds, query);
    const boardIds = sections.flatMap((section) => section.orderedIds);
    const virtualized = boardIds.length >= VIRTUALIZATION_THRESHOLD;
    currentPayload = {
      notesById,
      orderedIds,
      activeId,
      query,
      boardIds,
      virtualized,
      viewMode,
    };
    container.dataset.virtualized = String(virtualized);
    container.dataset.viewMode = viewMode;

    if (boardIds.length === 0) {
      clearToEmpty(emptyPresentation);
      return;
    }

    if (virtualized) renderWindow();
    else renderCompleteBoard(sections);
  }

  container.addEventListener("keydown", handleKeyNavigation);

  scrollOwner.addEventListener("scroll", () => {
    if (currentPayload.virtualized) renderWindow();
  });

  return { render };
}
