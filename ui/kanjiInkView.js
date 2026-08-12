import { commandRuntime, getActiveNoteId } from "../app.js";
import { kanjiInkApplication } from "../core/kanjiInkApplication.js";
import { KANJI_INK_LIMITS, KANJI_INK_WIDTHS } from "../core/kanjiInkEntry.js";
import {
  KANJI_LEGACY_PAPER_PATTERN,
  KANJI_PAPER_PATTERN,
  createKanjiPaperGeometry,
} from "../core/kanjiPaper.js";

const PRIMARY_VISIBLE_ENTRIES = 1;
const EXPANDED_WINDOW_ENTRIES = 64;
const MIN_POINT_DISTANCE = 0.002;
const MAX_DEVICE_PIXEL_RATIO = 3;

function ensureStylesheet() {
  if (document.querySelector('link[data-kanji-ink-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../kanji-ink.css", import.meta.url).href;
  link.dataset.kanjiInkStyles = "true";
  link.addEventListener("load", () => {
    if (viewDestroyed) return;
    if (dialog.open) renderCanvas();
    scheduleSynchronization();
  }, { once: true });
  document.head.append(link);
}

function iconButton(id, label, icon, className = "kanji-icon-button") {
  return `<button id="${id}" class="${className}" type="button" aria-label="${label}" title="${label}"><img src="${new URL(`../assets/icons/${icon}`, import.meta.url).href}" alt=""></button>`;
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "kanjiInkDialog";
  dialog.className = "kanji-ink-dialog";
  dialog.setAttribute("aria-labelledby", "kanjiInkDialogTitle");
  dialog.innerHTML = `
    <div class="kanji-ink-shell">
      <header class="kanji-ink-header">
        <h2 id="kanjiInkDialogTitle">Draw Kanji</h2>
        ${iconButton("closeKanjiDialogButton", "Close", "kanji-close.svg")}
      </header>
      <div class="kanji-ink-toolbar" role="toolbar" aria-label="Drawing tools">
        ${iconButton("kanjiPenButton", "Pen", "kanji-pen.svg", "kanji-icon-button kanji-tool-button")}
        ${iconButton("kanjiMarkerButton", "Marker", "kanji-marker.svg", "kanji-icon-button kanji-tool-button")}
        ${iconButton("kanjiEraserButton", "Eraser", "kanji-eraser.svg", "kanji-icon-button kanji-tool-button")}
        <span class="kanji-toolbar-divider" aria-hidden="true"></span>
        ${iconButton("undoKanjiStrokeButton", "Undo", "kanji-undo.svg")}
        ${iconButton("redoKanjiStrokeButton", "Redo", "kanji-redo.svg")}
        ${iconButton("clearKanjiButton", "Clear", "kanji-clear.svg")}
      </div>
      <div class="kanji-canvas-frame">
        <canvas id="kanjiInkCanvas" tabindex="0" aria-label="Kanji drawing canvas" data-paper-pattern="${KANJI_PAPER_PATTERN.semanticName}" data-paper-rule-count="${KANJI_PAPER_PATTERN.ruleCount}"></canvas>
      </div>
      <footer class="kanji-ink-footer">
        ${iconButton("saveKanjiButton", "Save drawing", "kanji-save.svg", "kanji-icon-button kanji-save-button")}
      </footer>
      <p id="kanjiInkStatus" class="kanji-ink-status" role="status" aria-live="polite"></p>
      <section id="kanjiDiscardConfirmation" class="kanji-discard-confirmation" aria-label="Discard handwriting draft" hidden>
        <strong>Discard this unsaved drawing?</strong>
        <div class="kanji-discard-actions">
          <button id="keepKanjiDrawingButton" type="button">Keep drawing</button>
          <button id="discardKanjiDrawingButton" type="button">Discard drawing</button>
        </div>
      </section>
    </div>`;
  document.body.append(dialog);
  return dialog;
}

function createSupplementaryRegion() {
  const region = document.createElement("section");
  region.id = "kanjiInkRegion";
  region.className = "kanji-ink-region";
  region.dataset.noteDrawingProjection = "kanji-ink";
  const header = document.createElement("div");
  header.className = "kanji-entry-header";
  const heading = document.createElement("h4");
  heading.textContent = "Saved drawings";
  const count = document.createElement("span");
  count.id = "kanjiInkCount";
  header.append(heading, count);
  const entries = document.createElement("div");
  entries.id = "kanjiInkEntries";
  entries.className = "kanji-ink-entries";
  const loadMore = document.createElement("button");
  loadMore.id = "showOlderKanjiEntriesButton";
  loadMore.type = "button";
  loadMore.className = "secondary-button kanji-ink-load-more";
  loadMore.textContent = "Show older drawings";
  loadMore.hidden = true;
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
  region.append(header, entries, loadMore, status, recovery);
  return { region, count, entries, loadMore, status, recovery, undo };
}

ensureStylesheet();
const dialog = createDialog();
const supplementary = createSupplementaryRegion();
const drawingHost = document.getElementById("noteDrawingRegion");
if (!drawingHost) throw new Error("KANJI_INK_UI_MISSING_HOST");

const elements = {
  title: document.getElementById("kanjiInkDialogTitle"),
  close: document.getElementById("closeKanjiDialogButton"),
  canvas: document.getElementById("kanjiInkCanvas"),
  pen: document.getElementById("kanjiPenButton"),
  marker: document.getElementById("kanjiMarkerButton"),
  eraser: document.getElementById("kanjiEraserButton"),
  undo: document.getElementById("undoKanjiStrokeButton"),
  redo: document.getElementById("redoKanjiStrokeButton"),
  clear: document.getElementById("clearKanjiButton"),
  save: document.getElementById("saveKanjiButton"),
  status: document.getElementById("kanjiInkStatus"),
  discardConfirmation: document.getElementById("kanjiDiscardConfirmation"),
  keepDrawing: document.getElementById("keepKanjiDrawingButton"),
  discardDrawing: document.getElementById("discardKanjiDrawingButton"),
};
if (Object.values(elements).some((element) => !element)) throw new Error("KANJI_INK_UI_MISSING_CONTROL");

let controller = null;
let dialogOpener = null;
let dialogNoteId = null;
let activePointerId = null;
let pointerCaptureActive = false;
let pointerFallbackAttached = false;
let strokeStartedAt = 0;
let liveStroke = null;
let pointerLimitMessage = "";
let lastDeletedEntry = null;
let syncSequence = 0;
let syncScheduled = false;
let visibleEntryNoteId = null;
let visibleEntryCount = PRIMARY_VISIBLE_ENTRIES;
let projectionError = "";
let pendingEntryFocus = null;
const previewLayoutTargets = new Map();
const previewRenderFrames = new Map();
let previewLayoutObserver = null;
let viewDestroyed = false;

function ensurePreviewLayoutObserver() {
  if (previewLayoutObserver) return previewLayoutObserver;
  previewLayoutObserver = new globalThis.ResizeObserver((observations) => {
    if (viewDestroyed) return;
    for (const observation of observations) {
      const canvas = observation.target;
      const entry = previewLayoutTargets.get(canvas);
      if (!entry) continue;
      if (!canvas.isConnected) {
        previewLayoutObserver.unobserve(canvas);
        previewLayoutTargets.delete(canvas);
        continue;
      }
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      previewLayoutObserver.unobserve(canvas);
      previewLayoutTargets.delete(canvas);
      drawEntryPreview(canvas, entry);
    }
  });
  return previewLayoutObserver;
}

function clearPreviewRenderingResources() {
  for (const frameId of previewRenderFrames.values()) cancelAnimationFrame(frameId);
  previewRenderFrames.clear();
  for (const canvas of previewLayoutTargets.keys()) previewLayoutObserver?.unobserve(canvas);
  previewLayoutTargets.clear();
}

function scheduleEntryPreview(canvas, entry) {
  if (viewDestroyed) return;
  const pendingFrame = previewRenderFrames.get(canvas);
  if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame);
  const frameId = requestAnimationFrame(() => {
    previewRenderFrames.delete(canvas);
    if (viewDestroyed || !canvas.isConnected) return;
    drawEntryPreview(canvas, entry);
  });
  previewRenderFrames.set(canvas, frameId);
}

function activeNoteButton() {
  return document.querySelector(".note-item[aria-current='true']");
}

function activeNoteId() {
  return getActiveNoteId();
}

function triggerDownload({ content, type, filename }) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function canvasMetrics(canvas = elements.canvas) {
  const rect = canvas.getBoundingClientRect();
  return { rect, width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function configureCanvas(canvas = elements.canvas) {
  const { width, height } = canvasMetrics(canvas);
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function drawPaper(context, width, height) {
  const paper = createKanjiPaperGeometry(width, height);
  context.fillStyle = KANJI_PAPER_PATTERN.backgroundColor;
  context.fillRect(0, 0, width, height);
  context.save();
  context.strokeStyle = KANJI_PAPER_PATTERN.ruleColor;
  context.lineWidth = KANJI_PAPER_PATTERN.ruleWidth;
  context.beginPath();
  for (const rule of paper.rules) {
    context.moveTo(rule.x1, rule.y1);
    context.lineTo(rule.x2, rule.y2);
  }
  context.stroke();
  context.restore();
}

function normalizedStroke(stroke) {
  return Array.isArray(stroke)
    ? { tool: "pen", width: KANJI_INK_WIDTHS.pen, points: stroke }
    : stroke;
}

function drawStrokes(context, strokes, width, height, inkColor = KANJI_PAPER_PATTERN.inkColor) {
  for (const input of strokes) {
    const stroke = normalizedStroke(input);
    if (!stroke?.points || stroke.points.length < 2) continue;
    context.save();
    context.strokeStyle = inkColor;
    context.globalAlpha = stroke.tool === "marker" ? 0.42 : 0.96;
    context.lineWidth = Math.max(1, stroke.width * Math.min(width, height));
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(stroke.points[0].x * width, stroke.points[0].y * height);
    for (const point of stroke.points.slice(1)) context.lineTo(point.x * width, point.y * height);
    context.stroke();
    context.restore();
  }
}

function renderCanvas() {
  const { context, width, height } = configureCanvas();
  drawPaper(context, width, height);
  drawStrokes(context, controller?.snapshot().strokes || [], width, height);
  if (liveStroke?.points.length > 1 && liveStroke.tool !== "eraser") {
    drawStrokes(context, [liveStroke], width, height);
  }
}

function drawEntryPreview(canvas, entry) {
  if (viewDestroyed || !canvas.isConnected) {
    if (previewLayoutTargets.delete(canvas)) previewLayoutObserver?.unobserve(canvas);
    return;
  }
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    if (!previewLayoutTargets.has(canvas)) ensurePreviewLayoutObserver().observe(canvas);
    previewLayoutTargets.set(canvas, entry);
    return;
  }
  if (previewLayoutTargets.delete(canvas)) previewLayoutObserver?.unobserve(canvas);
  const { context, width, height } = configureCanvas(canvas);
  if (entry.schemaVersion === 2) {
    drawPaper(context, width, height);
    drawStrokes(context, entry.strokes, width, height);
    canvas.dataset.paperRendered = "true";
    return;
  }
  context.fillStyle = KANJI_LEGACY_PAPER_PATTERN.backgroundColor;
  context.fillRect(0, 0, width, height);
  drawStrokes(context, entry.strokes, width, height, KANJI_LEGACY_PAPER_PATTERN.inkColor);
  canvas.dataset.paperRendered = "true";
}

function statusText(snapshot) {
  if (snapshot.status === "saving") return "Saving drawing locally…";
  if (snapshot.errorCode === "KANJI_SAVE_FAILED") return "Save failed. Your drawing is preserved; retry save.";
  if (pointerLimitMessage) return pointerLimitMessage;
  if (snapshot.strokes.length > 0) return `${snapshot.strokes.length} stroke${snapshot.strokes.length === 1 ? "" : "s"}`;
  return "";
}

function renderController() {
  if (!controller) return;
  const snapshot = controller.snapshot();
  const saving = snapshot.status === "saving";
  for (const [name, button] of [["pen", elements.pen], ["marker", elements.marker], ["eraser", elements.eraser]]) {
    button.setAttribute("aria-pressed", String(snapshot.tool === name));
    button.disabled = saving;
  }
  elements.undo.disabled = saving || !snapshot.canUndo;
  elements.redo.disabled = saving || !snapshot.canRedo;
  elements.clear.disabled = saving || snapshot.strokes.length === 0;
  elements.save.disabled = saving || snapshot.strokes.length === 0;
  elements.close.disabled = saving;
  elements.canvas.setAttribute("aria-disabled", String(saving));
  elements.save.setAttribute("aria-label", snapshot.errorCode === "KANJI_SAVE_FAILED" ? "Retry save drawing" : "Save drawing");
  elements.save.title = elements.save.getAttribute("aria-label");
  elements.status.textContent = statusText(snapshot);
  elements.discardConfirmation.hidden = snapshot.status !== "confirm-discard";
  renderCanvas();
}

function pointFromPointer(event, first = false) {
  const { rect, width, height } = canvasMetrics();
  const previousTime = liveStroke?.points.at(-1)?.t ?? 0;
  const elapsed = first ? 0 : Math.max(0, Math.min(KANJI_INK_LIMITS.maxStrokeDurationMs, Math.round(event.timeStamp - strokeStartedAt)));
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / height)),
    t: Math.max(previousTime, elapsed),
  };
}

function committedPointCount(snapshot) {
  return snapshot.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0);
}

function totalPointCount(snapshot) {
  return committedPointCount(snapshot) + (liveStroke?.points.length ?? 0);
}

function appendPointerPoint(event) {
  if (!controller || event.pointerId !== activePointerId || !liveStroke) return;
  if (liveStroke.points.length >= KANJI_INK_LIMITS.maxPointsPerStroke) return;
  if (totalPointCount(controller.snapshot()) >= KANJI_INK_LIMITS.maxTotalPoints) return;
  const point = pointFromPointer(event);
  const previous = liveStroke.points.at(-1);
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < MIN_POINT_DISTANCE) return;
  controller.appendGesture(point);
  liveStroke.points.push(point);
  renderCanvas();
}

function attachPointerFallback() {
  if (pointerFallbackAttached) return;
  document.addEventListener("pointerup", finishPointerStroke);
  document.addEventListener("pointercancel", finishPointerStroke);
  pointerFallbackAttached = true;
}

function detachPointerFallback() {
  if (!pointerFallbackAttached) return;
  document.removeEventListener("pointerup", finishPointerStroke);
  document.removeEventListener("pointercancel", finishPointerStroke);
  pointerFallbackAttached = false;
}

function clearPointerSession() {
  const pointerId = activePointerId;
  try {
    if (pointerId !== null && pointerCaptureActive) elements.canvas.releasePointerCapture(pointerId);
  } catch { /* pointer capture may already be released */
  } finally {
    activePointerId = null;
    pointerCaptureActive = false;
    strokeStartedAt = 0;
    liveStroke = null;
    detachPointerFallback();
  }
}

function showPointerLimit() {
  pointerLimitMessage = "Drawing limit reached. Undo, erase, clear, or save to continue.";
}

function beginPointerStroke(event) {
  if (!controller || activePointerId !== null || event.button !== 0 || controller.snapshot().status === "saving") return;
  event.preventDefault();
  const snapshot = controller.snapshot();
  if (["pen", "marker"].includes(snapshot.tool) && (
    snapshot.strokes.length >= KANJI_INK_LIMITS.maxStrokes
    || committedPointCount(snapshot) >= KANJI_INK_LIMITS.maxTotalPoints - 1
  )) {
    showPointerLimit();
    renderController();
    return;
  }
  pointerLimitMessage = "";
  activePointerId = event.pointerId;
  strokeStartedAt = event.timeStamp;
  const point = pointFromPointer(event, true);
  liveStroke = { tool: snapshot.tool, width: KANJI_INK_WIDTHS[snapshot.tool] ?? KANJI_INK_WIDTHS.pen, points: [point] };
  try {
    controller.beginGesture(point);
    try {
      elements.canvas.setPointerCapture(event.pointerId);
      pointerCaptureActive = true;
    } catch {
      attachPointerFallback();
    }
  } catch (error) {
    clearPointerSession();
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") {
      showPointerLimit();
      renderController();
      return;
    }
    throw error;
  }
  renderCanvas();
}

function finishPointerStroke(event) {
  if (!controller || event.pointerId !== activePointerId) return;
  let unexpectedError = null;
  try {
    if (event.type === "pointerup") appendPointerPoint(event);
    controller.endGesture();
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") showPointerLimit();
    else unexpectedError = error;
  } finally {
    clearPointerSession();
    renderController();
  }
  if (unexpectedError) throw unexpectedError;
}

function restoreDialogFocus() {
  const fallback = activeNoteButton() || document.getElementById("noteActionsButton");
  const target = dialogOpener instanceof HTMLElement && dialogOpener.isConnected ? dialogOpener : fallback;
  target?.focus();
}

function closeDialogCleanly() {
  if (dialog.open) dialog.close();
  controller = null;
  dialogNoteId = null;
  clearPointerSession();
  pointerLimitMessage = "";
  restoreDialogFocus();
}

function requestDialogClose() {
  if (controller?.snapshot().status === "saving") return;
  if (!controller) return closeDialogCleanly();
  let outcome;
  let unexpectedError = null;
  try {
    outcome = controller.requestClose();
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") showPointerLimit();
    else unexpectedError = error;
  } finally {
    clearPointerSession();
  }
  if (unexpectedError) throw unexpectedError;
  if (!outcome) return renderController();
  if (outcome.closed) return closeDialogCleanly();
  renderController();
  elements.keepDrawing.focus();
}

async function openDialog(entry = null, opener = document.activeElement) {
  const noteId = activeNoteId();
  if (!noteId || entry?.schemaVersion === 1) return false;
  dialogNoteId = noteId;
  dialogOpener = opener instanceof HTMLElement ? opener : document.getElementById("noteActionsButton");
  controller = kanjiInkApplication.createEntryController(entry);
  elements.title.textContent = entry ? "Edit Kanji drawing" : "Draw Kanji";
  elements.discardConfirmation.hidden = true;
  dialog.showModal();
  requestAnimationFrame(() => {
    renderController();
    elements.close.focus();
  });
  return true;
}

async function saveEntry() {
  if (!controller || !dialogNoteId) return;
  try {
    const snapshot = controller.snapshot();
    const operation = snapshot.errorCode === "KANJI_SAVE_FAILED"
      ? controller.retrySave({ noteId: dialogNoteId })
      : controller.save({ noteId: dialogNoteId });
    renderController();
    await operation;
    const savedEntryId = controller.snapshot().savedEntry?.id ?? null;
    projectionError = "";
    await synchronizeActiveNote();
    if (savedEntryId) {
      const refreshedCard = [...supplementary.entries.children]
        .find((card) => card.dataset.kanjiEntryId === savedEntryId);
      const refreshedEditButton = refreshedCard
        ?.querySelector('button[aria-label="Edit Kanji drawing"]');
      if (refreshedEditButton instanceof HTMLElement) dialogOpener = refreshedEditButton;
    }
    closeDialogCleanly();
  } catch { renderController(); }
}

function detachSupplementaryRegion() {
  clearPreviewRenderingResources();
  supplementary.region.remove();
  drawingHost.hidden = true;
}

function newestFirstEntries(entries) {
  return [...entries].sort((left, right) => (
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id)
  ));
}

function visibleEntriesForNote(noteId, entries) {
  if (visibleEntryNoteId !== noteId) {
    visibleEntryNoteId = noteId;
    visibleEntryCount = PRIMARY_VISIBLE_ENTRIES;
    projectionError = "";
    pendingEntryFocus = null;
  } else {
    visibleEntryCount = Math.max(
      PRIMARY_VISIBLE_ENTRIES,
      Math.min(visibleEntryCount, Math.max(entries.length, PRIMARY_VISIBLE_ENTRIES)),
    );
  }
  return entries.slice(0, visibleEntryCount);
}

function restoreEntryFocus(noteId) {
  if (!pendingEntryFocus) return;
  const focus = pendingEntryFocus;
  pendingEntryFocus = null;
  if (focus.noteId !== noteId) return;
  if (focus.target === "load-more" && !supplementary.loadMore.hidden) {
    supplementary.loadMore.focus();
    return;
  }
  const card = focus.target === "load-more"
    ? supplementary.entries.lastElementChild
    : [...supplementary.entries.children].find((candidate) => candidate.dataset.kanjiEntryId === focus.target);
  const control = card?.querySelector('button[aria-label="Edit Kanji drawing"], button[aria-label^="Delete handwriting"], button[aria-label="Delete Kanji drawing"]');
  if (control instanceof HTMLElement) control.focus();
}

function makeEntryCard(entry) {
  const legacy = entry.schemaVersion === 1;
  const label = legacy ? entry.character : "Kanji drawing";
  const card = document.createElement("article");
  card.className = "kanji-entry";
  card.dataset.kanjiEntryId = entry.id;
  card.dataset.kanjiSchemaVersion = String(entry.schemaVersion);
  const preview = document.createElement("canvas");
  preview.className = "kanji-entry-preview";
  if (!legacy) {
    preview.dataset.paperPattern = KANJI_PAPER_PATTERN.semanticName;
    preview.dataset.paperRuleCount = String(KANJI_PAPER_PATTERN.ruleCount);
  }
  preview.setAttribute("role", "img");
  preview.setAttribute("aria-label", legacy ? `Handwriting sample for ${entry.character}` : "Kanji drawing preview");
  const copy = document.createElement("div");
  copy.className = "kanji-entry-copy";
  const heading = document.createElement("strong");
  heading.className = "kanji-entry-label";
  heading.textContent = label;
  if (legacy) heading.lang = "ja";
  const detail = document.createElement("span");
  detail.className = "hint";
  detail.textContent = legacy ? "Legacy recognized entry · read only" : "Saved grid drawing";
  const actions = document.createElement("div");
  actions.className = "kanji-entry-actions";
  if (!legacy) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", "Edit Kanji drawing");
    edit.addEventListener("click", () => void openDialog(entry, edit));
    actions.append(edit);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Delete";
  remove.setAttribute("aria-label", legacy ? `Delete handwriting ${entry.character}` : "Delete Kanji drawing");
  remove.addEventListener("click", async () => {
    try {
      const deleted = await kanjiInkApplication.deleteEntry(entry.id);
      if (deleted) lastDeletedEntry = deleted;
      projectionError = "";
      await synchronizeActiveNote();
      supplementary.undo.focus();
    } catch {
      projectionError = "Delete failed. The saved drawing is unchanged.";
      pendingEntryFocus = { noteId: activeNoteId(), target: entry.id };
      await synchronizeActiveNote();
    }
  });
  actions.append(remove);
  copy.append(heading, detail, actions);
  card.append(preview, copy);
  scheduleEntryPreview(preview, entry);
  return card;
}

async function synchronizeActiveNote() {
  if (viewDestroyed) return;
  const sequence = ++syncSequence;
  const noteId = activeNoteId();
  if (!noteId) {
    visibleEntryNoteId = null;
    visibleEntryCount = PRIMARY_VISIBLE_ENTRIES;
    projectionError = "";
    return detachSupplementaryRegion();
  }
  const result = await kanjiInkApplication.loadNoteContext(noteId);
  if (viewDestroyed) return;
  if (sequence !== syncSequence || noteId !== activeNoteId()) return;
  const hasRecovery = lastDeletedEntry?.noteId === noteId;
  if (result.entries.length === 0 && result.invalidCount === 0 && !hasRecovery) return detachSupplementaryRegion();
  if (!supplementary.region.isConnected) drawingHost.append(supplementary.region);
  drawingHost.hidden = false;
  const sortedEntries = newestFirstEntries(result.entries);
  const visibleEntries = visibleEntriesForNote(noteId, sortedEntries);
  clearPreviewRenderingResources();
  supplementary.entries.replaceChildren(...visibleEntries.map(makeEntryCard));
  supplementary.count.textContent = `${result.entries.length} entr${result.entries.length === 1 ? "y" : "ies"}`;
  const messages = [];
  supplementary.loadMore.hidden = visibleEntries.length >= sortedEntries.length;
  if (!supplementary.loadMore.hidden) messages.push(`Showing newest ${visibleEntries.length} of ${sortedEntries.length} entries.`);
  if (result.invalidCount > 0) messages.push(`${result.invalidCount} invalid stored entr${result.invalidCount === 1 ? "y was" : "ies were"} isolated.`);
  if (projectionError) messages.push(projectionError);
  supplementary.status.textContent = messages.join(" ");
  supplementary.recovery.hidden = !hasRecovery;
  restoreEntryFocus(noteId);
}

function scheduleSynchronization() {
  if (viewDestroyed || syncScheduled) return;
  syncScheduled = true;
  queueMicrotask(() => { syncScheduled = false; void synchronizeActiveNote(); });
}

supplementary.undo.addEventListener("click", async () => {
  if (!lastDeletedEntry) return;
  const restoredEntry = lastDeletedEntry;
  await kanjiInkApplication.restoreEntry(restoredEntry);
  lastDeletedEntry = null;
  projectionError = "";
  pendingEntryFocus = { noteId: restoredEntry.noteId, target: restoredEntry.id };
  await synchronizeActiveNote();
});

supplementary.loadMore.addEventListener("click", async () => {
  visibleEntryCount += EXPANDED_WINDOW_ENTRIES - PRIMARY_VISIBLE_ENTRIES;
  pendingEntryFocus = { noteId: activeNoteId(), target: "load-more" };
  await synchronizeActiveNote();
});

elements.canvas.addEventListener("pointerdown", beginPointerStroke);
elements.canvas.addEventListener("pointermove", appendPointerPoint);
elements.canvas.addEventListener("pointerup", finishPointerStroke);
elements.canvas.addEventListener("pointercancel", finishPointerStroke);
elements.canvas.addEventListener("lostpointercapture", finishPointerStroke);
for (const [tool, button] of [["pen", elements.pen], ["marker", elements.marker], ["eraser", elements.eraser]]) {
  button.addEventListener("click", () => { pointerLimitMessage = ""; controller?.selectTool(tool); renderController(); });
}
elements.undo.addEventListener("click", () => { pointerLimitMessage = ""; controller?.undo(); renderController(); });
elements.redo.addEventListener("click", () => { pointerLimitMessage = ""; controller?.redo(); renderController(); });
elements.clear.addEventListener("click", () => { pointerLimitMessage = ""; controller?.clear(); renderController(); });
elements.save.addEventListener("click", () => void saveEntry());
elements.close.addEventListener("click", requestDialogClose);
elements.keepDrawing.addEventListener("click", () => { controller?.keepDrawing(); renderController(); elements.canvas.focus(); });
elements.discardDrawing.addEventListener("click", () => { controller?.discardDraft(); closeDialogCleanly(); });
dialog.addEventListener("cancel", (event) => { event.preventDefault(); requestDialogClose(); });
dialog.addEventListener("click", (event) => { if (event.target === dialog) requestDialogClose(); });
dialog.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { event.preventDefault(); requestDialogClose(); }
  event.stopPropagation();
}, true);
window.addEventListener("resize", () => { if (dialog.open) renderCanvas(); });

const noteObserver = new MutationObserver(scheduleSynchronization);
noteObserver.observe(document.getElementById("noteList"), { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current"] });
const saveObserver = new MutationObserver(scheduleSynchronization);
saveObserver.observe(document.getElementById("saveState"), { childList: true, subtree: true, characterData: true });

const unregisterCommands = [
  commandRuntime.registry.register({
    id: "notes.kanji-ink",
    title: "Add drawing",
    description: "Draw a saved Kanji grid and attach it to the active note",
    shortcuts: [], scope: "shell",
    isAvailable: () => Boolean(activeNoteId()),
    unavailableReason: () => "No active note is available",
    run: (context) => openDialog(null, context.opener),
  }),
  commandRuntime.registry.register({
    id: "export.kanji-json", title: "Export Kanji data as JSON",
    description: "Download lossless note-linked handwriting records",
    shortcuts: [], scope: "shell", isAvailable: () => true,
    unavailableReason: () => "Kanji export is unavailable",
    run: async () => triggerDownload(await kanjiInkApplication.exportJson()),
  }),
  commandRuntime.registry.register({
    id: "export.kanji-markdown", title: "Export Kanji data as Markdown",
    description: "Download grid-backed handwriting previews",
    shortcuts: [], scope: "shell", isAvailable: () => true,
    unavailableReason: () => "Kanji export is unavailable",
    run: async () => triggerDownload(await kanjiInkApplication.exportMarkdown()),
  }),
];

scheduleSynchronization();

export const kanjiInkApp = Object.freeze({
  open: openDialog,
  synchronize: synchronizeActiveNote,
  destroy() {
    viewDestroyed = true;
    clearPointerSession();
    noteObserver.disconnect();
    saveObserver.disconnect();
    for (const unregister of unregisterCommands) unregister();
    dialog.remove();
    detachSupplementaryRegion();
    previewLayoutObserver?.disconnect();
    previewLayoutObserver = null;
  },
});
