import {
  createKanjiInkEntryV2,
  KANJI_INK_LIMITS,
  KANJI_INK_WIDTHS,
  validateKanjiInkEntryV2,
} from "./kanjiInkEntry.js";

const MAX_HISTORY_STATES = 100;
const ERASER_RADIUS = 0.03;

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function clonePoint(point, previousTime = null, first = false) {
  if (
    point === null
    || typeof point !== "object"
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || point.x < 0
    || point.x > 1
    || point.y < 0
    || point.y > 1
    || !Number.isInteger(point.t)
    || point.t < 0
    || point.t > KANJI_INK_LIMITS.maxStrokeDurationMs
    || (first && point.t !== 0)
    || (previousTime !== null && point.t < previousTime)
  ) {
    throw codedError("KANJI_INK_POINT_INVALID");
  }
  return { x: point.x, y: point.y, t: point.t };
}

function cloneStrokes(strokes) {
  return strokes.map((stroke) => ({
    tool: stroke.tool,
    width: stroke.width,
    points: stroke.points.map((point) => ({ ...point })),
  }));
}

function equalStrokes(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function distanceSquaredToSegment(point, start, end) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared === 0) return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
  const projection = Math.max(0, Math.min(1, ((point.x - start.x) * deltaX + (point.y - start.y) * deltaY) / lengthSquared));
  const closestX = start.x + projection * deltaX;
  const closestY = start.y + projection * deltaY;
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2;
}

function orientation(first, second, third) {
  return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}

function segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
  const first = orientation(firstStart, firstEnd, secondStart);
  const second = orientation(firstStart, firstEnd, secondEnd);
  const third = orientation(secondStart, secondEnd, firstStart);
  const fourth = orientation(secondStart, secondEnd, firstEnd);
  if (first * second < 0 && third * fourth < 0) return true;
  const between = (value, start, end) => value >= Math.min(start, end) && value <= Math.max(start, end);
  return (first === 0 && between(secondStart.x, firstStart.x, firstEnd.x) && between(secondStart.y, firstStart.y, firstEnd.y))
    || (second === 0 && between(secondEnd.x, firstStart.x, firstEnd.x) && between(secondEnd.y, firstStart.y, firstEnd.y))
    || (third === 0 && between(firstStart.x, secondStart.x, secondEnd.x) && between(firstStart.y, secondStart.y, secondEnd.y))
    || (fourth === 0 && between(firstEnd.x, secondStart.x, secondEnd.x) && between(firstEnd.y, secondStart.y, secondEnd.y));
}

function segmentsWithinRadius(firstStart, firstEnd, secondStart, secondEnd) {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) return true;
  const radiusSquared = ERASER_RADIUS ** 2;
  return [
    distanceSquaredToSegment(firstStart, secondStart, secondEnd),
    distanceSquaredToSegment(firstEnd, secondStart, secondEnd),
    distanceSquaredToSegment(secondStart, firstStart, firstEnd),
    distanceSquaredToSegment(secondEnd, firstStart, firstEnd),
  ].some((distance) => distance <= radiusSquared);
}

function strokeIntersectsEraser(stroke, eraserPoints) {
  const radiusSquared = ERASER_RADIUS ** 2;
  for (let strokeIndex = 1; strokeIndex < stroke.points.length; strokeIndex += 1) {
    const strokeStart = stroke.points[strokeIndex - 1];
    const strokeEnd = stroke.points[strokeIndex];
    for (let eraserIndex = 1; eraserIndex < eraserPoints.length; eraserIndex += 1) {
      if (segmentsWithinRadius(strokeStart, strokeEnd, eraserPoints[eraserIndex - 1], eraserPoints[eraserIndex])) {
        return true;
      }
    }
    if (eraserPoints.length === 1 && distanceSquaredToSegment(eraserPoints[0], strokeStart, strokeEnd) <= radiusSquared) {
      return true;
    }
  }
  return false;
}

function defaultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ink-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneEntry(entry) {
  return entry ? validateKanjiInkEntryV2(entry) : null;
}

export function createKanjiInkController({
  persist = async (entry) => entry,
  createId = defaultId,
  now = () => new Date().toISOString(),
  initialEntry = null,
} = {}) {
  if (typeof persist !== "function" || typeof createId !== "function" || typeof now !== "function") {
    throw codedError("KANJI_CONTROLLER_OPTIONS_INVALID");
  }

  let savedEntry;
  try {
    savedEntry = cloneEntry(initialEntry);
  } catch {
    throw codedError("KANJI_CONTROLLER_OPTIONS_INVALID");
  }

  let baselineStrokes = savedEntry ? cloneStrokes(savedEntry.strokes) : [];
  let strokes = cloneStrokes(baselineStrokes);
  let tool = "pen";
  let status = strokes.length > 0 ? "drawing" : "idle";
  let errorCode = null;
  let activeGesture = null;
  let undoStack = [];
  let redoStack = [];
  let saveInFlight = null;
  let lastSaveInput = null;
  let retryEntry = null;

  function isDirty() {
    return !equalStrokes(strokes, baselineStrokes);
  }

  function assertDraftMutable() {
    if (saveInFlight) throw codedError("KANJI_SAVE_IN_PROGRESS");
  }

  function recordHistory(previousStrokes) {
    undoStack = [...undoStack, cloneStrokes(previousStrokes)].slice(-MAX_HISTORY_STATES);
    redoStack = [];
    retryEntry = null;
  }

  function setDrawingStatus() {
    status = strokes.length > 0 ? "drawing" : "idle";
    errorCode = null;
  }

  function snapshot() {
    return {
      status,
      dirty: isDirty(),
      tool,
      strokes: cloneStrokes(strokes),
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      errorCode,
      savedEntry: savedEntry ? cloneEntry(savedEntry) : null,
    };
  }

  function selectTool(nextTool) {
    assertDraftMutable();
    if (!["pen", "marker", "eraser"].includes(nextTool)) throw codedError("KANJI_TOOL_INVALID");
    if (activeGesture) throw codedError("KANJI_GESTURE_ACTIVE");
    tool = nextTool;
    return tool;
  }

  function beginGesture(point) {
    assertDraftMutable();
    if (activeGesture) throw codedError("KANJI_GESTURE_ACTIVE");
    activeGesture = [clonePoint(point, null, true)];
    errorCode = null;
  }

  function appendGesture(point) {
    assertDraftMutable();
    if (!activeGesture) throw codedError("KANJI_GESTURE_NOT_ACTIVE");
    if (activeGesture.length >= KANJI_INK_LIMITS.maxPointsPerStroke) throw codedError("KANJI_INK_ENTRY_LIMIT");
    activeGesture.push(clonePoint(point, activeGesture.at(-1).t));
  }

  function endGesture() {
    assertDraftMutable();
    if (!activeGesture) return false;
    const gesture = activeGesture;
    activeGesture = null;
    const previousStrokes = strokes;

    if (tool === "eraser") {
      const nextStrokes = strokes.filter((stroke) => !strokeIntersectsEraser(stroke, gesture));
      if (nextStrokes.length === strokes.length) return false;
      recordHistory(previousStrokes);
      strokes = cloneStrokes(nextStrokes);
      setDrawingStatus();
      return true;
    }

    if (gesture.length < 2) return false;
    if (strokes.length >= KANJI_INK_LIMITS.maxStrokes
      || strokes.reduce((total, stroke) => total + stroke.points.length, 0) + gesture.length > KANJI_INK_LIMITS.maxTotalPoints) {
      throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    recordHistory(previousStrokes);
    strokes = [...strokes, {
      tool,
      width: KANJI_INK_WIDTHS[tool],
      points: gesture.map((point) => ({ ...point })),
    }];
    setDrawingStatus();
    return true;
  }

  function undo() {
    assertDraftMutable();
    activeGesture = null;
    const previousStrokes = undoStack.at(-1);
    if (!previousStrokes) return false;
    undoStack = undoStack.slice(0, -1);
    redoStack = [...redoStack, cloneStrokes(strokes)].slice(-MAX_HISTORY_STATES);
    strokes = cloneStrokes(previousStrokes);
    retryEntry = null;
    setDrawingStatus();
    return true;
  }

  function redo() {
    assertDraftMutable();
    activeGesture = null;
    const nextStrokes = redoStack.at(-1);
    if (!nextStrokes) return false;
    redoStack = redoStack.slice(0, -1);
    undoStack = [...undoStack, cloneStrokes(strokes)].slice(-MAX_HISTORY_STATES);
    strokes = cloneStrokes(nextStrokes);
    retryEntry = null;
    setDrawingStatus();
    return true;
  }

  function clear() {
    assertDraftMutable();
    activeGesture = null;
    if (strokes.length === 0) return false;
    recordHistory(strokes);
    strokes = [];
    setDrawingStatus();
    return true;
  }

  function requestClose() {
    assertDraftMutable();
    activeGesture = null;
    if (!isDirty()) return { closed: true, focusTarget: "opener" };
    status = "confirm-discard";
    return { closed: false, focusTarget: "keep-drawing" };
  }

  function keepDrawing() {
    assertDraftMutable();
    setDrawingStatus();
  }

  function discardDraft() {
    assertDraftMutable();
    activeGesture = null;
    strokes = cloneStrokes(baselineStrokes);
    undoStack = [];
    redoStack = [];
    retryEntry = null;
    lastSaveInput = null;
    setDrawingStatus();
    return { closed: true, focusTarget: "opener" };
  }

  function buildEntry(input) {
    const timestamp = now();
    const existing = savedEntry;
    const entry = createKanjiInkEntryV2({
      id: existing ? existing.id : createId(),
      noteId: existing ? existing.noteId : input?.noteId,
      strokes,
      paperStyle: "grid",
      timestamp: existing ? existing.createdAt : timestamp,
    });
    return existing ? validateKanjiInkEntryV2({ ...entry, updatedAt: timestamp }) : entry;
  }

  function entryForSave(input, useRetryEntry) {
    if (useRetryEntry && retryEntry) return cloneEntry(retryEntry);
    return buildEntry(input);
  }

  function startSave(input = {}, useRetryEntry = false) {
    if (saveInFlight) return saveInFlight;
    if (strokes.length === 0) return Promise.reject(codedError("KANJI_STROKES_REQUIRED"));
    if (activeGesture) return Promise.reject(codedError("KANJI_GESTURE_ACTIVE"));

    let resolveSave;
    let rejectSave;
    const operation = new Promise((resolve, reject) => {
      resolveSave = resolve;
      rejectSave = reject;
    });
    saveInFlight = operation;
    status = "saving";
    errorCode = null;

    void (async () => {
      try {
        lastSaveInput = { ...input };
        const entry = entryForSave(input, useRetryEntry);
        retryEntry = cloneEntry(entry);
        const persisted = validateKanjiInkEntryV2(await persist(cloneEntry(entry)) ?? entry);
        savedEntry = cloneEntry(persisted);
        baselineStrokes = cloneStrokes(persisted.strokes);
        strokes = cloneStrokes(persisted.strokes);
        undoStack = [];
        redoStack = [];
        retryEntry = null;
        status = "idle";
        errorCode = null;
        saveInFlight = null;
        resolveSave(cloneEntry(persisted));
      } catch {
        status = "error";
        errorCode = "KANJI_SAVE_FAILED";
        saveInFlight = null;
        rejectSave(codedError("KANJI_SAVE_FAILED"));
      }
    })();

    return operation;
  }

  function save(input = {}) {
    return startSave(input, false);
  }

  function retrySave(input = lastSaveInput ?? {}) {
    return startSave(input, true);
  }

  return Object.freeze({
    selectTool,
    beginGesture,
    appendGesture,
    endGesture,
    undo,
    redo,
    clear,
    requestClose,
    keepDrawing,
    discardDraft,
    save,
    retrySave,
    snapshot,
  });
}
