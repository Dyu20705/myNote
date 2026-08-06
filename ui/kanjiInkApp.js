import { commandRuntime } from "../app.js";
import { createKanjiInkController } from "../core/kanjiInkController.js";
import { KANJI_INK_LIMITS } from "../core/kanjiInkEntry.js";
import {
  createKanjiExportBundle,
  createKanjiHumanReadableExport,
  projectNoteForKanjiSearch,
} from "../core/kanjiInkProjection.js";
import { recognizeKanji } from "../core/kanjiRecognizer.js";
import { getActiveSearchClient } from "../core/searchClient.js";
import {
  addKanjiInkEntryToDb,
  deleteKanjiInkEntryFromDb,
  listKanjiInkEntriesFromDb,
  listNotesFromDb,
  openDatabase,
  putKanjiInkEntryToDb,
} from "../core/storage.js";

const MAX_RENDERED_ENTRIES = 64;
const MIN_POINT_DISTANCE = 0.006;
const MAX_DEVICE_PIXEL_RATIO = 3;

function ensureStylesheet() {
  if (document.querySelector('link[data-kanji-ink-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../kanji-ink.css", import.meta.url).href;
  link.dataset.kanjiInkStyles = "true";
  document.head.append(link);
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "kanjiInkDialog";
  dialog.className = "kanji-ink-dialog";
  dialog.setAttribute("aria-labelledby", "kanjiInkDialogTitle");
  dialog.innerHTML = `
    <div class="kanji-ink-shell">
      <header class="kanji-ink-header">
        <div>
          <p class="eyebrow" lang="ja">漢字 handwriting</p>
          <h2 id="kanjiInkDialogTitle">Add Kanji handwriting</h2>
        </div>
        <button id="closeKanjiDialogButton" type="button" aria-label="Close Kanji handwriting dialog">Close</button>
      </header>

      <section class="kanji-ink-candidate-region" aria-labelledby="kanjiCandidateHeading">
        <strong id="kanjiCandidateHeading">Candidates</strong>
        <div id="kanjiCandidateList" class="kanji-candidate-list" aria-live="polite"></div>
      </section>

      <div class="kanji-canvas-frame">
        <canvas id="kanjiInkCanvas" aria-label="Draw one Kanji with a mouse or pen"></canvas>
      </div>

      <div class="kanji-ink-toolbar" role="group" aria-label="Handwriting controls">
        <button id="undoKanjiStrokeButton" type="button">Undo stroke</button>
        <button id="clearKanjiButton" type="button">Clear</button>
        <button id="recognizeKanjiButton" class="primary-button" type="button">Recognize</button>
      </div>

      <section class="kanji-ink-preview" aria-label="Selected Kanji preview">
        <span>Selected standard character</span>
        <strong id="kanjiSelectedCharacter" class="kanji-selected-character" lang="ja">—</strong>
      </section>

      <p id="kanjiInkStatus" class="kanji-ink-status" role="status" aria-live="polite">Draw one character to begin.</p>

      <section id="kanjiDiscardConfirmation" class="kanji-discard-confirmation" aria-label="Discard handwriting draft" hidden>
        <strong>Discard this unsaved drawing?</strong>
        <div class="kanji-discard-actions">
          <button id="keepKanjiDrawingButton" type="button">Keep drawing</button>
          <button id="discardKanjiDrawingButton" type="button">Discard drawing</button>
        </div>
      </section>

      <footer class="kanji-ink-footer">
        <button id="cancelKanjiButton" type="button">Cancel</button>
        <button id="saveKanjiButton" class="primary-button" type="button" disabled>Save to note</button>
      </footer>
    </div>
  `;
  document.body.append(dialog);
  return dialog;
}

function createSupplementaryRegion() {
  const region = document.createElement("section");
  region.id = "kanjiInkRegion";
  region.className = "kanji-ink-region";
  region.dataset.supplementaryEntity = "kanji-handwriting";

  const header = document.createElement("div");
  header.className = "kanji-entry-header";
  const heading = document.createElement("h4");
  heading.textContent = "Kanji handwriting";
  const count = document.createElement("span");
  count.id = "kanjiInkCount";
  header.append(heading, count);

  const entries = document.createElement("div");
  entries.id = "kanjiInkEntries";
  entries.className = "kanji-ink-entries";

  const status = document.createElement("p");
  status.id = "kanjiInkRegionStatus";
  status.className = "hint";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const recovery = document.createElement("div");
  recovery.id = "kanjiInkRecovery";
  recovery.className = "kanji-ink-recovery";
  recovery.hidden = true;
  const recoveryText = document.createElement("span");
  recoveryText.textContent = "Handwriting entry deleted";
  const undo = document.createElement("button");
  undo.id = "undoKanjiDeleteButton";
  undo.type = "button";
  undo.className = "secondary-button";
  undo.setAttribute("aria-label", "Undo handwriting deletion");
  undo.textContent = "Undo delete";
  recovery.append(recoveryText, undo);

  region.append(header, entries, status, recovery);
  return { region, count, entries, status, recovery, undo };
}

ensureStylesheet();
const dialog = createDialog();
const supplementary = createSupplementaryRegion();
const supplementaryHost = document.getElementById("noteSupplementaryList");
const supplementaryContainer = document.getElementById("noteSupplementaryRegion");

if (!supplementaryHost || !supplementaryContainer) {
  throw new Error("KANJI_INK_UI_MISSING_HOST");
}

const elements = {
  title: document.getElementById("kanjiInkDialogTitle"),
  close: document.getElementById("closeKanjiDialogButton"),
  candidates: document.getElementById("kanjiCandidateList"),
  canvas: document.getElementById("kanjiInkCanvas"),
  undoStroke: document.getElementById("undoKanjiStrokeButton"),
  clear: document.getElementById("clearKanjiButton"),
  recognize: document.getElementById("recognizeKanjiButton"),
  selected: document.getElementById("kanjiSelectedCharacter"),
  status: document.getElementById("kanjiInkStatus"),
  discardConfirmation: document.getElementById("kanjiDiscardConfirmation"),
  keepDrawing: document.getElementById("keepKanjiDrawingButton"),
  discardDrawing: document.getElementById("discardKanjiDrawingButton"),
  cancel: document.getElementById("cancelKanjiButton"),
  save: document.getElementById("saveKanjiButton"),
};

const missingElements = Object.entries(elements).filter(([, element]) => !element);
if (missingElements.length > 0) {
  throw new Error("KANJI_INK_UI_MISSING_CONTROL");
}

let controller = null;
let editingEntry = null;
let dialogOpener = null;
let dialogNoteId = null;
let activePointerId = null;
let liveStroke = [];
let lastDeletedEntry = null;
let syncSequence = 0;
let syncScheduled = false;

function activeNoteButton() {
  return document.querySelector(".note-item[aria-current='true']");
}

function activeNoteId() {
  return activeNoteButton()?.dataset.id || null;
}

async function withDatabase(operation) {
  const database = await openDatabase();
  try {
    return await operation(database);
  } finally {
    database.close();
  }
}

function triggerDownload(content, type, filename) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

async function collectExportData() {
  return withDatabase(async (database) => {
    const notes = await listNotesFromDb(database);
    const entries = [];
    for (const note of notes) {
      const result = await listKanjiInkEntriesFromDb(database, note.id);
      if (result.invalidCount > 0) {
        const error = new Error("KANJI_EXPORT_INVALID_PERSISTED_ENTRY");
        error.code = "KANJI_EXPORT_INVALID_PERSISTED_ENTRY";
        throw error;
      }
      entries.push(...result.entries);
    }
    return { notes, entries };
  });
}

async function exportKanjiJson() {
  const { notes, entries } = await collectExportData();
  const bundle = createKanjiExportBundle(notes, entries);
  triggerDownload(
    JSON.stringify(bundle, null, 2),
    "application/json",
    "myNote-kanji-export.json",
  );
}

async function exportKanjiMarkdown() {
  const { notes, entries } = await collectExportData();
  triggerDownload(
    createKanjiHumanReadableExport(notes, entries),
    "text/markdown",
    "myNote-kanji-export.md",
  );
}

function canvasMetrics() {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    rect,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  };
}

function configureCanvas() {
  const { width, height } = canvasMetrics();
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (elements.canvas.width !== pixelWidth || elements.canvas.height !== pixelHeight) {
    elements.canvas.width = pixelWidth;
    elements.canvas.height = pixelHeight;
  }
  const context = elements.canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function drawStrokesOnContext(context, strokes, width, height, lineWidth = 4) {
  context.strokeStyle = "#111827";
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    context.beginPath();
    context.moveTo(stroke[0].x * width, stroke[0].y * height);
    for (const point of stroke.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
  }
}

function renderCanvas() {
  const { context, width, height } = configureCanvas();
  context.clearRect(0, 0, width, height);
  const strokes = controller?.snapshot().strokes || [];
  drawStrokesOnContext(context, strokes, width, height);
  if (liveStroke.length > 1) {
    drawStrokesOnContext(context, [liveStroke], width, height);
  }
}

function drawEntryPreview(canvas, entry) {
  const ratio = 2;
  const size = 88;
  canvas.width = size * ratio;
  canvas.height = size * ratio;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  drawStrokesOnContext(context, entry.strokes, size, size, 3);
}

function controllerStatus(snapshot) {
  if (snapshot.status === "recognizing") return "Recognizing locally…";
  if (snapshot.status === "saving") return "Saving drawing and character locally…";
  if (snapshot.errorCode === "KANJI_RECOGNITION_FAILED") {
    return "Recognition failed. Your drawing is preserved; retry recognition.";
  }
  if (snapshot.errorCode === "KANJI_SAVE_FAILED") {
    return "Save failed. Your drawing and selection are preserved; retry save.";
  }
  if (snapshot.status === "candidates" && snapshot.candidates.length === 0) {
    return "No supported candidate matched. Redraw and try again.";
  }
  if (snapshot.selectedCharacter) return `Selected ${snapshot.selectedCharacter}. Ready to save.`;
  if (snapshot.candidates.length > 0) return "Choose one candidate explicitly.";
  if (snapshot.strokes.length > 0) return `${snapshot.strokes.length} stroke${snapshot.strokes.length === 1 ? "" : "s"} captured.`;
  return "Draw one character to begin.";
}

function renderCandidates(snapshot) {
  elements.candidates.replaceChildren();
  for (const candidate of snapshot.candidates) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.character = candidate.character;
    button.lang = "ja";
    button.textContent = candidate.character;
    button.setAttribute("aria-label", `Select candidate ${candidate.character}`);
    button.setAttribute("aria-pressed", String(snapshot.selectedCharacter === candidate.character));
    button.addEventListener("click", () => {
      controller.selectCandidate(candidate.character);
      renderController();
    });
    elements.candidates.append(button);
  }
}

function renderController() {
  if (!controller) return;
  const snapshot = controller.snapshot();
  const busy = snapshot.status === "recognizing" || snapshot.status === "saving";
  elements.undoStroke.disabled = busy || snapshot.strokes.length === 0;
  elements.clear.disabled = busy || snapshot.strokes.length === 0;
  elements.recognize.disabled = busy || snapshot.strokes.length === 0;
  elements.recognize.textContent = snapshot.errorCode === "KANJI_RECOGNITION_FAILED"
    ? "Retry recognition"
    : "Recognize";
  elements.save.disabled = busy || !snapshot.selectedCharacter;
  elements.save.textContent = snapshot.errorCode === "KANJI_SAVE_FAILED"
    ? "Retry save"
    : editingEntry
      ? "Save changes"
      : "Save to note";
  elements.selected.textContent = snapshot.selectedCharacter || "—";
  elements.status.textContent = controllerStatus(snapshot);
  elements.discardConfirmation.hidden = snapshot.status !== "confirm-discard";
  renderCandidates(snapshot);
  renderCanvas();
}

function pointFromPointer(event) {
  const { rect, width, height } = canvasMetrics();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / height)),
  };
}

function totalPointCount(snapshot) {
  return snapshot.strokes.reduce((sum, stroke) => sum + stroke.length, 0) + liveStroke.length;
}

function pointIsFarEnough(point) {
  const previous = liveStroke.at(-1);
  return !previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= MIN_POINT_DISTANCE;
}

function beginPointerStroke(event) {
  if (!controller || activePointerId !== null || event.button !== 0) return;
  const snapshot = controller.snapshot();
  if (snapshot.strokes.length >= KANJI_INK_LIMITS.maxStrokes) {
    elements.status.textContent = `Maximum ${KANJI_INK_LIMITS.maxStrokes} strokes reached.`;
    return;
  }
  event.preventDefault();
  const point = pointFromPointer(event);
  activePointerId = event.pointerId;
  liveStroke = [point];
  controller.beginStroke(point);
  try {
    elements.canvas.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is progressive enhancement; document events still preserve mouse input.
  }
  renderCanvas();
}

function appendPointerPoint(event) {
  if (!controller || event.pointerId !== activePointerId) return;
  if (liveStroke.length >= KANJI_INK_LIMITS.maxPointsPerStroke) return;
  if (totalPointCount(controller.snapshot()) >= KANJI_INK_LIMITS.maxTotalPoints) return;
  const point = pointFromPointer(event);
  if (!pointIsFarEnough(point)) return;
  controller.appendPoint(point);
  liveStroke.push(point);
  renderCanvas();
}

function finishPointerStroke(event) {
  if (!controller || event.pointerId !== activePointerId) return;
  if (event.type === "pointerup") appendPointerPoint(event);
  controller.endStroke();
  activePointerId = null;
  liveStroke = [];
  renderController();
}

function restoreDialogFocus() {
  const fallback = activeNoteButton() || document.getElementById("noteActionsButton");
  const target = dialogOpener instanceof HTMLElement && dialogOpener.isConnected
    ? dialogOpener
    : fallback;
  target?.focus();
}

function closeDialogCleanly() {
  if (dialog.open) dialog.close();
  controller = null;
  editingEntry = null;
  dialogNoteId = null;
  activePointerId = null;
  liveStroke = [];
  restoreDialogFocus();
}

function requestDialogClose() {
  if (!controller) {
    closeDialogCleanly();
    return;
  }
  const outcome = controller.requestClose();
  if (outcome.closed) {
    closeDialogCleanly();
    return;
  }
  renderController();
  elements.keepDrawing.focus();
}

async function persistControllerEntry(entry) {
  return withDatabase(async (database) => {
    if (!editingEntry) return addKanjiInkEntryToDb(database, entry);
    return putKanjiInkEntryToDb(database, {
      ...entry,
      id: editingEntry.id,
      revision: editingEntry.revision + 1,
      createdAt: editingEntry.createdAt,
    });
  });
}

function createControllerFor(entry) {
  return createKanjiInkController({
    recognize: (strokes) => Promise.resolve(recognizeKanji(strokes)),
    persist: persistControllerEntry,
    createId: () => entry?.id || crypto.randomUUID(),
    initialStrokes: entry?.strokes || [],
  });
}

async function openDialog(entry = null, opener = document.activeElement) {
  const noteId = activeNoteId();
  if (!noteId) return false;
  editingEntry = entry;
  dialogNoteId = noteId;
  dialogOpener = opener instanceof HTMLElement ? opener : document.getElementById("noteActionsButton");
  controller = createControllerFor(entry);
  elements.title.textContent = entry ? "Edit Kanji handwriting" : "Add Kanji handwriting";
  elements.discardConfirmation.hidden = true;
  dialog.showModal();
  requestAnimationFrame(() => {
    configureCanvas();
    renderController();
    elements.close.focus();
  });
  return true;
}

async function recognizeCurrentDraft() {
  if (!controller) return;
  try {
    await controller.recognize();
  } catch (error) {
    if (error?.code !== "KANJI_STROKES_REQUIRED") throw error;
  }
  renderController();
}

async function saveCurrentEntry() {
  if (!controller || !dialogNoteId) return;
  try {
    const snapshot = controller.snapshot();
    if (snapshot.errorCode === "KANJI_SAVE_FAILED") {
      await controller.retrySave({ noteId: dialogNoteId });
    } else {
      await controller.save({ noteId: dialogNoteId });
    }
    await synchronizeActiveNote();
    closeDialogCleanly();
  } catch {
    renderController();
  }
}

function detachSupplementaryRegion() {
  supplementary.region.remove();
  const remaining = supplementaryHost.querySelector("[data-supplementary-entity]");
  supplementaryContainer.hidden = remaining === null;
}

function makeEntryCard(entry) {
  const card = document.createElement("article");
  card.className = "kanji-entry";
  card.dataset.kanjiEntryId = entry.id;

  const preview = document.createElement("canvas");
  preview.className = "kanji-entry-preview";
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-label", `Handwriting sample for ${entry.character}`);
  drawEntryPreview(preview, entry);

  const copy = document.createElement("div");
  copy.className = "kanji-entry-copy";
  const character = document.createElement("span");
  character.className = "kanji-entry-character";
  character.dataset.kanjiCharacter = entry.character;
  character.lang = "ja";
  character.textContent = entry.character;
  character.setAttribute("aria-label", `${entry.character}, handwriting sample attached`);

  const actions = document.createElement("div");
  actions.className = "kanji-entry-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Edit";
  edit.setAttribute("aria-label", `Edit handwriting ${entry.character}`);
  edit.addEventListener("click", () => {
    void openDialog(entry, edit);
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Delete";
  remove.setAttribute("aria-label", `Delete handwriting ${entry.character}`);
  remove.addEventListener("click", async () => {
    const deleted = await withDatabase((database) => deleteKanjiInkEntryFromDb(database, entry.id));
    if (deleted) lastDeletedEntry = deleted;
    await synchronizeActiveNote();
    supplementary.undo.focus();
  });
  actions.append(edit, remove);
  copy.append(character, actions);
  card.append(preview, copy);
  return card;
}

async function applySearchProjection(note, entries) {
  const searchClient = getActiveSearchClient();
  if (!searchClient || !note) return;
  await searchClient.upsert(projectNoteForKanjiSearch(note, entries));
}

async function synchronizeActiveNote() {
  const sequence = ++syncSequence;
  const noteId = activeNoteId();
  if (!noteId) {
    detachSupplementaryRegion();
    return;
  }

  const result = await withDatabase(async (database) => {
    const notes = await listNotesFromDb(database);
    const note = notes.find((candidate) => candidate.id === noteId) || null;
    const listing = await listKanjiInkEntriesFromDb(database, noteId);
    return { note, ...listing };
  });
  if (sequence !== syncSequence || noteId !== activeNoteId()) return;

  await applySearchProjection(result.note, result.entries);
  if (sequence !== syncSequence || noteId !== activeNoteId()) return;

  const hasRecovery = lastDeletedEntry?.noteId === noteId;
  if (result.entries.length === 0 && result.invalidCount === 0 && !hasRecovery) {
    detachSupplementaryRegion();
    return;
  }

  if (!supplementary.region.isConnected) supplementaryHost.append(supplementary.region);
  supplementaryContainer.hidden = false;
  supplementary.entries.replaceChildren();
  for (const entry of result.entries.slice(0, MAX_RENDERED_ENTRIES)) {
    supplementary.entries.append(makeEntryCard(entry));
  }
  supplementary.count.textContent = `${result.entries.length} entr${result.entries.length === 1 ? "y" : "ies"}`;
  const messages = [];
  if (result.entries.length > MAX_RENDERED_ENTRIES) {
    messages.push(`Showing the first ${MAX_RENDERED_ENTRIES} entries.`);
  }
  if (result.invalidCount > 0) {
    messages.push(`${result.invalidCount} invalid stored entr${result.invalidCount === 1 ? "y was" : "ies were"} isolated.`);
  }
  supplementary.status.textContent = messages.join(" ");
  supplementary.recovery.hidden = !hasRecovery;
}

function scheduleSynchronization() {
  if (syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(() => {
    syncScheduled = false;
    void synchronizeActiveNote();
  });
}

supplementary.undo.addEventListener("click", async () => {
  const entry = lastDeletedEntry;
  if (!entry) return;
  await withDatabase((database) => addKanjiInkEntryToDb(database, entry));
  lastDeletedEntry = null;
  await synchronizeActiveNote();
});

elements.canvas.addEventListener("pointerdown", beginPointerStroke);
elements.canvas.addEventListener("pointermove", appendPointerPoint);
elements.canvas.addEventListener("pointerup", finishPointerStroke);
elements.canvas.addEventListener("pointercancel", finishPointerStroke);
elements.canvas.addEventListener("lostpointercapture", finishPointerStroke);
elements.undoStroke.addEventListener("click", () => {
  controller?.undoLastStroke();
  renderController();
});
elements.clear.addEventListener("click", () => {
  controller?.clear();
  renderController();
});
elements.recognize.addEventListener("click", () => {
  void recognizeCurrentDraft();
});
elements.save.addEventListener("click", () => {
  void saveCurrentEntry();
});
elements.close.addEventListener("click", requestDialogClose);
elements.cancel.addEventListener("click", requestDialogClose);
elements.keepDrawing.addEventListener("click", () => {
  controller?.keepDrawing();
  renderController();
  elements.canvas.focus();
});
elements.discardDrawing.addEventListener("click", () => {
  controller?.discardDraft();
  closeDialogCleanly();
});

dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  requestDialogClose();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) requestDialogClose();
});
dialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    requestDialogClose();
  }
  event.stopPropagation();
}, true);
window.addEventListener("resize", () => {
  if (dialog.open) renderCanvas();
});

const noteObserver = new MutationObserver(scheduleSynchronization);
noteObserver.observe(document.getElementById("noteList"), {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["aria-current"],
});
const saveObserver = new MutationObserver(scheduleSynchronization);
saveObserver.observe(document.getElementById("saveState"), {
  childList: true,
  subtree: true,
  characterData: true,
});

const unregisterCommands = [
  commandRuntime.registry.register({
    id: "notes.kanji-ink",
    title: "Add Kanji handwriting",
    description: "Draw one Kanji and attach the confirmed character to the active note",
    shortcuts: [],
    scope: "shell",
    isAvailable: () => Boolean(activeNoteId()),
    unavailableReason: () => "No active note is available",
    run: (context) => openDialog(null, context.opener),
  }),
  commandRuntime.registry.register({
    id: "export.kanji-json",
    title: "Export Kanji data as JSON",
    description: "Download lossless note-linked handwriting records",
    shortcuts: [],
    scope: "shell",
    isAvailable: () => true,
    unavailableReason: () => "Kanji export is unavailable",
    run: exportKanjiJson,
  }),
  commandRuntime.registry.register({
    id: "export.kanji-markdown",
    title: "Export Kanji data as Markdown",
    description: "Download confirmed characters with SVG handwriting previews",
    shortcuts: [],
    scope: "shell",
    isAvailable: () => true,
    unavailableReason: () => "Kanji export is unavailable",
    run: exportKanjiMarkdown,
  }),
];

scheduleSynchronization();

export const kanjiInkApp = Object.freeze({
  open: openDialog,
  synchronize: synchronizeActiveNote,
  destroy() {
    noteObserver.disconnect();
    saveObserver.disconnect();
    for (const unregister of unregisterCommands) unregister();
    dialog.remove();
    detachSupplementaryRegion();
  },
});
