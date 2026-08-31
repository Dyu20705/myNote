import { commandRuntime } from "../app.js";
import "./kanjiInkApp.js";
import { createNoteActionRegistry } from "./noteActionRegistry.js";
import { computeNoteStats } from "../core/noteStats.js";
import { extractTags, parseWikiLinks } from "../core/parser/index.js";

const elements = {
  titleInput: document.getElementById("titleInput"),
  contentInput: document.getElementById("contentInput"),
  saveState: document.getElementById("saveState"),
  noteList: document.getElementById("noteList"),
  editorOverlay: document.getElementById("noteEditorOverlay"),
  closeEditorButton: document.getElementById("closeNoteEditorButton"),
  pinButton: document.getElementById("pinNoteButton"),
  newNoteButton: document.getElementById("newNoteButton"),
  newJapaneseNoteButton: document.getElementById("newJapaneseNoteButton"),
  detailsButton: document.getElementById("detailsButton"),
  closeDetailsButton: document.getElementById("closeDetailsButton"),
  inspector: document.getElementById("noteInspector"),
  statsRegion: document.getElementById("noteStatsRegion"),
  statsList: document.getElementById("noteStatsList"),
  tagsRegion: document.getElementById("noteTagsRegion"),
  tagsList: document.getElementById("noteTagsList"),
  outgoingLinksRegion: document.getElementById("outgoingLinksRegion"),
  outgoingLinksList: document.getElementById("outgoingLinksList"),
  backlinksRegion: document.getElementById("backlinksRegion"),
  backlinksList: document.getElementById("backlinksList"),
  japaneseStudyRegion: document.getElementById("japaneseStudyRegion"),
  japaneseStudyList: document.getElementById("japaneseStudyList"),
  metadataList: document.getElementById("noteMetadataList"),
  supplementaryRegion: document.getElementById("noteSupplementaryRegion"),
  actionsButton: document.getElementById("noteActionsButton"),
  closeActionsButton: document.getElementById("closeNoteActionsButton"),
  actionsPopover: document.getElementById("noteActionsPopover"),
  actionsList: document.getElementById("noteActionsList"),
  undoNotice: document.getElementById("undoNotice"),
  undoDeleteButton: document.getElementById("undoDeleteButton"),
};

const required = Object.entries(elements).filter(([, element]) => !element);
if (required.length > 0) {
  throw new Error("EDITOR_CHROME_MISSING_REGION");
}

const actionRegistry = createNoteActionRegistry();
const unregisterActions = [
  actionRegistry.register({ commandId: "notes.archive", order: 40 }),
  actionRegistry.register({ commandId: "notes.unarchive", order: 41 }),
  actionRegistry.register({ commandId: "notes.kanji-ink", order: 50 }),
  actionRegistry.register({ commandId: "notes.delete", tone: "danger", order: 90 }),
];

let detailsOpener = null;
let actionsOpener = null;
let destroyed = false;

function activeCard() {
  return elements.noteList.querySelector(".note-item[aria-current='true']");
}

function visibleCreateControl() {
  return elements.newNoteButton.hidden ? elements.newJapaneseNoteButton : elements.newNoteButton;
}

function activeMetadata() {
  const card = activeCard();
  return {
    title: elements.titleInput.value.trim() || "Untitled",
    updated: card?.querySelector(".note-item-date")?.textContent?.trim() || "Current session",
    states: [...(card?.querySelectorAll(".note-item-state") ?? [])]
      .map((element) => element.textContent.trim())
      .filter(Boolean),
    tags: card?.querySelector(".note-item-tags")?.textContent?.trim() || "None",
  };
}

function appendMetadata(term, description) {
  const termNode = document.createElement("dt");
  termNode.textContent = term;
  const descriptionNode = document.createElement("dd");
  descriptionNode.textContent = description;
  elements.metadataList.append(termNode, descriptionNode);
}

function renderMetadata() {
  const metadata = activeMetadata();
  elements.metadataList.replaceChildren();
  appendMetadata("Storage", "local");
  appendMetadata("Updated", metadata.updated);
  appendMetadata("Tags", metadata.tags);
  if (metadata.states.length > 0) appendMetadata("State", metadata.states.join(", "));
}

function renderStats() {
  if (!elements.statsList) return;
  const stats = computeNoteStats(elements.contentInput.value);
  elements.statsList.replaceChildren();
  const appendStat = (term, val) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = val;
    elements.statsList.append(dt, dd);
  };
  appendStat("Words", String(stats.words));
  appendStat("Characters", String(stats.characters));
  appendStat("Reading time", `${stats.readingTimeMinutes} min`);
}

function renderTags() {
  if (!elements.tagsList || !elements.tagsRegion) return;
  const tags = extractTags(elements.contentInput.value);
  elements.tagsList.replaceChildren();
  if (tags.length === 0) {
    elements.tagsRegion.hidden = true;
    return;
  }
  elements.tagsRegion.hidden = false;
  for (const tag of tags) {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = `#${tag}`;
    elements.tagsList.append(chip);
  }
}

function renderOutgoingLinks() {
  if (!elements.outgoingLinksList || !elements.outgoingLinksRegion) return;
  const links = parseWikiLinks(elements.contentInput.value);
  elements.outgoingLinksList.replaceChildren();
  if (links.length === 0) {
    elements.outgoingLinksRegion.hidden = true;
    return;
  }
  elements.outgoingLinksRegion.hidden = false;
  for (const linkTarget of links) {
    const linkItem = document.createElement("span");
    linkItem.className = "outgoing-link-item";
    linkItem.textContent = `[[${linkTarget}]]`;
    elements.outgoingLinksList.append(linkItem);
  }
}

function renderJapaneseStudyStatus() {
  if (!elements.japaneseStudyList || !elements.japaneseStudyRegion) return;
  const card = activeCard();
  const rawReviewState = card?.getAttribute("data-review-state");
  let reviewState = null;
  if (rawReviewState) {
    try {
      reviewState = JSON.parse(rawReviewState);
    } catch {
      reviewState = null;
    }
  }

  elements.japaneseStudyList.replaceChildren();
  if (!reviewState) {
    elements.japaneseStudyRegion.hidden = true;
    return;
  }

  elements.japaneseStudyRegion.hidden = false;
  const appendStudyField = (term, val) => {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = val;
    elements.japaneseStudyList.append(dt, dd);
  };

  if (reviewState.due) appendStudyField("Due", String(reviewState.due).slice(0, 10));
  if (reviewState.intervalDays != null) appendStudyField("Interval", `${reviewState.intervalDays}d`);
  if (reviewState.stability != null) appendStudyField("Stability", String(reviewState.stability));
  if (reviewState.difficulty != null) appendStudyField("Difficulty", String(reviewState.difficulty));
}

function normalizeBacklinks() {
  for (const hint of elements.backlinksList.querySelectorAll(".hint")) {
    if (hint.textContent.trim() === "No backlinks yet") hint.remove();
  }
  elements.backlinksRegion.hidden = elements.backlinksList.querySelector(".backlink-item") === null;
}

function synchronizeInspector() {
  normalizeBacklinks();
  renderStats();
  renderTags();
  renderOutgoingLinks();
  renderJapaneseStudyStatus();
  renderMetadata();
  elements.supplementaryRegion.hidden = elements.supplementaryRegion.querySelector("[data-supplementary-entity]") === null;
}

function restoreFocus(opener) {
  if (opener instanceof HTMLElement && opener.isConnected && !opener.matches(":disabled") && !opener.hidden) {
    opener.focus();
    return;
  }
  const fallback = activeCard() || visibleCreateControl();
  fallback.focus();
}

function closeDetails({ restore = true } = {}) {
  if (elements.inspector.hidden) return;
  elements.inspector.hidden = true;
  elements.detailsButton.setAttribute("aria-expanded", "false");
  if (restore) restoreFocus(detailsOpener || elements.detailsButton);
}

function openDetails(opener = elements.detailsButton) {
  closeActions({ restore: false });
  detailsOpener = opener;
  synchronizeInspector();
  elements.inspector.hidden = false;
  elements.detailsButton.setAttribute("aria-expanded", "true");
  elements.closeDetailsButton.focus();
}

function closeActions({ restore = true } = {}) {
  if (elements.actionsPopover.hidden) return;
  elements.actionsPopover.hidden = true;
  elements.actionsButton.setAttribute("aria-expanded", "false");
  if (restore) restoreFocus(actionsOpener || elements.actionsButton);
}

function actionDescription(action) {
  if (action.commandId === "notes.delete") return "Recoverable through Undo";
  return action.command.description;
}

function renderActions() {
  const actions = actionRegistry.snapshot(commandRuntime.snapshot());
  elements.actionsList.replaceChildren();

  for (const action of actions) {
    if ((action.commandId === "notes.archive" || action.commandId === "notes.unarchive") && !action.command.available) {
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = action.tone === "danger"
      ? "note-action-item note-action-danger"
      : "note-action-item";
    button.dataset.commandId = action.commandId;
    button.setAttribute("role", "menuitem");
    button.setAttribute("aria-disabled", String(!action.command.available));
    button.disabled = !action.command.available;

    const label = document.createElement("strong");
    label.textContent = action.command.title;
    const description = document.createElement("span");
    description.textContent = action.command.available
      ? actionDescription(action)
      : action.command.unavailableReason;
    button.append(label, description);

    button.addEventListener("click", async () => {
      if (!action.command.available) return;
      const wasDelete = action.commandId === "notes.delete";
      let outcome;
      try {
        outcome = await commandRuntime.execute(action.commandId, {
          source: "note-actions",
          target: elements.actionsButton,
        });
      } catch {
        renderActions();
        elements.actionsList.querySelector(`[data-command-id="${action.commandId}"]`)?.focus();
        return;
      }

      closeActions({ restore: false });
      if (wasDelete && outcome?.executed) {
        elements.editorOverlay.addEventListener("close", () => {
          elements.undoNotice.hidden = false;
        }, { once: true });
        elements.closeEditorButton.click();
      } else {
        restoreFocus(actionsOpener || elements.actionsButton);
      }
      queueMicrotask(synchronizeInspector);
    });
    elements.actionsList.append(button);
  }
}

function openActions(opener = elements.actionsButton) {
  closeDetails({ restore: false });
  actionsOpener = opener;
  renderActions();
  elements.actionsPopover.hidden = false;
  elements.actionsButton.setAttribute("aria-expanded", "true");
  const firstAvailable = elements.actionsList.querySelector("button:not(:disabled)");
  (firstAvailable || elements.closeActionsButton).focus();
}

async function undoDelete() {
  const outcome = await commandRuntime.execute("history.undo", {
    source: "deletion-recovery",
    target: elements.undoDeleteButton,
  });
  if (outcome?.executed) {
    elements.undoNotice.hidden = true;
    queueMicrotask(() => {
      synchronizeInspector();
      restoreFocus(activeCard() || visibleCreateControl());
    });
  }
}

async function togglePin() {
  try {
    const outcome = await commandRuntime.execute("notes.pin", {
      source: "note-toolbar",
      target: elements.pinButton,
    });
    if (outcome?.executed) queueMicrotask(synchronizeInspector);
  } finally {
    elements.pinButton.focus();
  }
}

function scheduleInspectorSync() {
  queueMicrotask(synchronizeInspector);
}

function handleEscape(event) {
  if (event.key !== "Escape") return;
  if (!elements.actionsPopover.hidden) {
    event.preventDefault();
    event.stopPropagation();
    closeActions();
    return;
  }
  if (!elements.inspector.hidden) {
    event.preventDefault();
    event.stopPropagation();
    closeDetails();
  }
}

function handleDocumentPointer(event) {
  if (
    !elements.actionsPopover.hidden
    && !elements.actionsPopover.contains(event.target)
    && !elements.actionsButton.contains(event.target)
  ) {
    closeActions({ restore: false });
  }
}

function removeLegacySaveAdapter() {
  document.getElementById("saveButton")?.remove();
}

elements.detailsButton.addEventListener("click", () => {
  if (elements.inspector.hidden) openDetails(elements.detailsButton);
  else closeDetails();
});
elements.closeDetailsButton.addEventListener("click", () => closeDetails());
elements.actionsButton.addEventListener("click", () => {
  if (elements.actionsPopover.hidden) openActions(elements.actionsButton);
  else closeActions();
});
elements.closeActionsButton.addEventListener("click", () => closeActions());
elements.pinButton.addEventListener("click", () => {
  togglePin().catch(() => undefined);
});
elements.undoDeleteButton.addEventListener("click", () => {
  void undoDelete();
});
elements.editorOverlay.addEventListener("close", () => {
  closeActions({ restore: false });
  closeDetails({ restore: false });
});
elements.noteList.addEventListener("click", scheduleInspectorSync);
elements.titleInput.addEventListener("blur", scheduleInspectorSync);
elements.contentInput.addEventListener("blur", scheduleInspectorSync);
document.addEventListener("keydown", handleEscape, true);
document.addEventListener("pointerdown", handleDocumentPointer);

const saveObserver = new MutationObserver(scheduleInspectorSync);
saveObserver.observe(elements.saveState, { childList: true, characterData: true, subtree: true });

removeLegacySaveAdapter();
synchronizeInspector();

export const editorChrome = Object.freeze({
  synchronize: synchronizeInspector,
  destroy() {
    if (destroyed) return;
    destroyed = true;
    saveObserver.disconnect();
    document.removeEventListener("keydown", handleEscape, true);
    document.removeEventListener("pointerdown", handleDocumentPointer);
    for (const unregister of unregisterActions) unregister();
  },
});
