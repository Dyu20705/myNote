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

function createSection(section, nodes, viewId, topSpacerHeight = 0, bottomSpacerHeight = 0) {
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

  if (topSpacerHeight > 0) {
    const topSpacer = document.createElement("div");
    topSpacer.className = "list-spacer";
    topSpacer.style.height = `${topSpacerHeight}px`;
    grid.append(topSpacer);
  }

  grid.append(...nodes);

  if (bottomSpacerHeight > 0) {
    const bottomSpacer = document.createElement("div");
    bottomSpacer.className = "list-spacer";
    bottomSpacer.style.height = `${bottomSpacerHeight}px`;
    grid.append(bottomSpacer);
  }

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
    sections: [],
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

  function measureSectionGeometry(viewMode) {
    const isGrid = viewMode === "grid";
    const defaultMetrics = {
      cols: isGrid ? 3 : 1,
      cardHeight: isGrid ? 152 : 88,
      gap: isGrid ? 16 : 8,
      rowStride: isGrid ? 168 : 96,
      headingHeight: 14.4,
      headingMarginBottom: 16,
      sectionMarginTop: 32,
    };

    if (typeof window === "undefined" || !window.getComputedStyle) {
      return defaultMetrics;
    }

    let probeSection1 = container.querySelector(".note-board-section");
    let probeSection2;
    let createdProbe = false;
    let probeRoot = null;

    if (!probeSection1) {
      createdProbe = true;
      probeRoot = document.createElement("div");
      probeRoot.style.visibility = "hidden";
      probeRoot.style.position = "absolute";
      probeRoot.style.pointerEvents = "none";
      probeRoot.style.inset = "0";

      probeSection1 = document.createElement("section");
      probeSection1.className = "note-board-section";
      const h1 = document.createElement("h3");
      h1.className = "note-board-heading";
      h1.textContent = "PROBE 1";
      const g1 = document.createElement("div");
      g1.className = "note-board-grid";
      const item1 = document.createElement("div");
      item1.className = "note-item";
      g1.append(item1);
      probeSection1.append(h1, g1);

      const s2 = document.createElement("section");
      s2.className = "note-board-section";
      const h2 = document.createElement("h3");
      h2.className = "note-board-heading";
      h2.textContent = "PROBE 2";
      s2.append(h2);

      probeRoot.append(probeSection1, s2);
      container.append(probeRoot);
      probeSection2 = s2;
    } else {
      probeSection2 = container.querySelectorAll(".note-board-section")[1] || null;
    }

    const headingEl = probeSection1.querySelector(".note-board-heading");
    const gridEl = probeSection1.querySelector(".note-board-grid");
    const itemEl = probeSection1.querySelector(".note-item");

    let cols = 1;
    if (isGrid && gridEl) {
      const template = window.getComputedStyle(gridEl).gridTemplateColumns;
      if (template && template !== "none") {
        cols = Math.max(1, template.trim().split(/\s+/).filter(Boolean).length);
      } else {
        const width = container.clientWidth || scrollOwner.clientWidth || 800;
        cols = Math.max(1, Math.floor(width / 300));
      }
    }

    let cardHeight = defaultMetrics.cardHeight;
    if (itemEl) {
      const csItem = window.getComputedStyle(itemEl);
      const h = parseFloat(csItem.height);
      if (h > 0) cardHeight = h;
    }

    let gap = defaultMetrics.gap;
    if (gridEl) {
      const csGrid = window.getComputedStyle(gridEl);
      const g = parseFloat(csGrid.rowGap || csGrid.gap);
      if (!isNaN(g) && g >= 0) gap = g;
    }

    const rowStride = cardHeight + gap;

    let headingHeight = defaultMetrics.headingHeight;
    let headingMarginBottom = defaultMetrics.headingMarginBottom;
    if (headingEl) {
      const csH = window.getComputedStyle(headingEl);
      const h = parseFloat(csH.height) || headingEl.offsetHeight;
      if (h > 0) headingHeight = h;
      const mb = parseFloat(csH.marginBottom);
      if (!isNaN(mb)) headingMarginBottom = mb;
    }

    let sectionMarginTop = defaultMetrics.sectionMarginTop;
    if (probeSection2) {
      const csS2 = window.getComputedStyle(probeSection2);
      const mt = parseFloat(csS2.marginTop);
      if (!isNaN(mt)) sectionMarginTop = mt;
    }

    if (createdProbe && probeRoot) {
      probeRoot.remove();
    }

    return {
      cols,
      cardHeight,
      gap,
      rowStride,
      headingHeight,
      headingMarginBottom,
      sectionMarginTop,
    };
  }

  function renderWindow() {
    const { notesById, sections, activeId, viewMode } = currentPayload;
    const geometry = measureSectionGeometry(viewMode);
    const { cols, gap, rowStride, headingHeight, headingMarginBottom, sectionMarginTop } = geometry;

    const headingTotalHeight = headingHeight + headingMarginBottom;

    const scrollTop = scrollOwner.scrollTop;
    const viewport = Math.max(
      scrollOwner.clientHeight || rowStride * 6,
      rowStride * 6,
    );

    const visibleYStart = Math.max(0, scrollTop - VIRTUAL_OVERSCAN * rowStride);
    const visibleYEnd = scrollTop + viewport + VIRTUAL_OVERSCAN * rowStride;

    // Compute cumulative layout coordinates for all non-empty sections
    let currentY = 0;
    const sectionLayouts = sections.map((section, index) => {
      const isFirst = index === 0;
      const sectionStart = isFirst ? currentY : (currentY + sectionMarginTop);
      const gridYStart = sectionStart + headingTotalHeight;
      const totalItems = section.orderedIds.length;
      const totalRows = Math.ceil(totalItems / cols);
      const gridHeight = totalRows > 0 ? (totalRows * rowStride - gap) : 0;
      const sectionEnd = gridYStart + gridHeight;
      currentY = sectionEnd;

      return {
        section,
        totalItems,
        totalRows,
        sectionStart,
        gridYStart,
        gridHeight,
        sectionEnd,
      };
    });

    const totalScrollHeight = currentY;
    const fragment = document.createDocumentFragment();
    const retainedIds = new Set();

    let firstVisibleIndex = -1;
    let lastVisibleIndex = -1;
    const visibleSections = [];

    for (let i = 0; i < sectionLayouts.length; i++) {
      const layout = sectionLayouts[i];
      if (layout.totalItems === 0) continue;

      // Check if section intersects [visibleYStart, visibleYEnd]
      if (layout.sectionEnd < visibleYStart) {
        continue;
      }
      if (layout.sectionStart > visibleYEnd) {
        continue;
      }

      if (firstVisibleIndex === -1) firstVisibleIndex = i;
      lastVisibleIndex = i;

      // Section is visible: calculate row window within section grid
      const rawStartRow = Math.max(0, Math.floor((visibleYStart - layout.gridYStart) / rowStride));
      const startRow = Math.min(rawStartRow, Math.max(0, layout.totalRows - 1));
      const rawEndRow = Math.ceil((visibleYEnd - layout.gridYStart) / rowStride);
      const endRow = Math.min(layout.totalRows, Math.max(startRow + 1, rawEndRow));

      const startIndex = startRow * cols;
      const endIndex = Math.min(layout.totalItems, endRow * cols);
      const visibleIds = layout.section.orderedIds.slice(startIndex, endIndex);

      const nodes = visibleIds.map((id) => {
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

      // Compute intra-grid top and bottom spacers (R * stride - gap)
      const topSpacerHeight = startRow > 0 ? (startRow * rowStride - gap) : 0;
      const bottomRows = layout.totalRows - endRow;
      const bottomSpacerHeight = bottomRows > 0 ? (bottomRows * rowStride - gap) : 0;

      const sectionEl = createSection(layout.section, nodes, viewId, topSpacerHeight, bottomSpacerHeight);
      visibleSections.push(sectionEl);
    }

    if (firstVisibleIndex > 0) {
      const topSpacerHeight = sectionLayouts[firstVisibleIndex].sectionStart;
      if (topSpacerHeight > 0) {
        const topSpacer = document.createElement("div");
        topSpacer.className = "list-spacer";
        topSpacer.style.height = `${topSpacerHeight}px`;
        fragment.append(topSpacer);
      }
    }

    fragment.append(...visibleSections);

    if (lastVisibleIndex !== -1 && lastVisibleIndex < sectionLayouts.length - 1) {
      const bottomSpacerHeight = totalScrollHeight - sectionLayouts[lastVisibleIndex].sectionEnd;
      if (bottomSpacerHeight > 0) {
        const bottomSpacer = document.createElement("div");
        bottomSpacer.className = "list-spacer";
        bottomSpacer.style.height = `${bottomSpacerHeight}px`;
        fragment.append(bottomSpacer);
      }
    }

    pruneCache(retainedIds);
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
    if (items.length < 2) return measureSectionGeometry(currentPayload.viewMode).cols;
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
      sections,
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
