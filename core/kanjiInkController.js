import {
  createKanjiInkEntry,
  validateKanjiStrokes,
} from "./kanjiInkEntry.js";
import { KANJI_RECOGNIZER_INFO } from "./kanjiRecognizer.js";

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function clonePoint(point) {
  if (
    point === null
    || typeof point !== "object"
    || !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || point.x < 0
    || point.x > 1
    || point.y < 0
    || point.y > 1
  ) {
    throw codedError("KANJI_INK_POINT_INVALID");
  }
  return { x: point.x, y: point.y };
}

function cloneStrokes(strokes) {
  return strokes.map((stroke) => stroke.map(clonePoint));
}

function cloneCandidate(candidate) {
  return {
    character: candidate.character,
    score: candidate.score,
  };
}

function sanitizeCandidates(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const candidates = [];
  for (const item of value) {
    if (
      !item
      || typeof item !== "object"
      || typeof item.character !== "string"
      || !/^\p{Script=Han}$/u.test(item.character)
      || !Number.isFinite(item.score)
      || item.score < 0
      || item.score > 1
      || seen.has(item.character)
    ) continue;
    seen.add(item.character);
    candidates.push(cloneCandidate(item));
    if (candidates.length === 8) break;
  }
  return candidates;
}

function defaultId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `ink-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hydrateInitialStrokes(value) {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) return [];
  try {
    return validateKanjiStrokes(value);
  } catch {
    throw codedError("KANJI_CONTROLLER_OPTIONS_INVALID");
  }
}

export function createKanjiInkController({
  recognize,
  persist = async (entry) => entry,
  createId = defaultId,
  now = () => new Date().toISOString(),
  initialStrokes = [],
} = {}) {
  if (typeof recognize !== "function" || typeof persist !== "function") {
    throw codedError("KANJI_CONTROLLER_OPTIONS_INVALID");
  }

  const hydratedStrokes = hydrateInitialStrokes(initialStrokes);
  let recognitionToken = 0;
  let activeStroke = null;
  let lastSaveInput = null;
  let saveInFlight = null;
  let state = {
    status: hydratedStrokes.length > 0 ? "drawing" : "idle",
    dirty: hydratedStrokes.length > 0,
    strokes: hydratedStrokes,
    candidates: [],
    selectedCharacter: null,
    errorCode: null,
    savedEntry: null,
  };

  function assertDraftMutable() {
    if (saveInFlight) {
      throw codedError("KANJI_SAVE_IN_PROGRESS");
    }
  }

  function invalidateRecognition() {
    recognitionToken += 1;
    state = {
      ...state,
      candidates: [],
      selectedCharacter: null,
      errorCode: null,
    };
  }

  function snapshot() {
    return {
      ...state,
      strokes: cloneStrokes(state.strokes),
      candidates: state.candidates.map(cloneCandidate),
      savedEntry: state.savedEntry ? structuredClone(state.savedEntry) : null,
    };
  }

  function beginStroke(point) {
    assertDraftMutable();
    const cloned = clonePoint(point);
    invalidateRecognition();
    activeStroke = [cloned];
    state = {
      ...state,
      status: "drawing",
      dirty: true,
    };
  }

  function appendPoint(point) {
    assertDraftMutable();
    if (!activeStroke) throw codedError("KANJI_STROKE_NOT_ACTIVE");
    activeStroke.push(clonePoint(point));
  }

  function endStroke() {
    assertDraftMutable();
    if (!activeStroke) return false;
    if (activeStroke.length < 2) {
      activeStroke = null;
      return false;
    }
    state = {
      ...state,
      status: "drawing",
      dirty: true,
      strokes: [...state.strokes, activeStroke],
    };
    activeStroke = null;
    return true;
  }

  function undoLastStroke() {
    assertDraftMutable();
    if (activeStroke) activeStroke = null;
    if (state.strokes.length === 0) return false;
    invalidateRecognition();
    state = {
      ...state,
      status: "drawing",
      dirty: true,
      strokes: state.strokes.slice(0, -1),
    };
    return true;
  }

  function clear() {
    assertDraftMutable();
    const changed = Boolean(activeStroke) || state.strokes.length > 0;
    if (!changed) return false;
    activeStroke = null;
    invalidateRecognition();
    state = {
      ...state,
      status: "drawing",
      dirty: true,
      strokes: [],
    };
    return true;
  }

  async function runRecognition() {
    assertDraftMutable();
    if (state.strokes.length === 0) throw codedError("KANJI_STROKES_REQUIRED");
    const token = ++recognitionToken;
    const input = cloneStrokes(state.strokes);
    state = {
      ...state,
      status: "recognizing",
      candidates: [],
      selectedCharacter: null,
      errorCode: null,
    };
    try {
      const result = await recognize(input);
      if (token !== recognitionToken) return [];
      const candidates = sanitizeCandidates(result);
      state = {
        ...state,
        status: "candidates",
        candidates,
        selectedCharacter: null,
        errorCode: null,
      };
      return candidates.map(cloneCandidate);
    } catch {
      if (token !== recognitionToken) return [];
      state = {
        ...state,
        status: "error",
        errorCode: "KANJI_RECOGNITION_FAILED",
        candidates: [],
        selectedCharacter: null,
      };
      return [];
    }
  }

  function selectCandidate(character) {
    assertDraftMutable();
    if (!state.candidates.some((candidate) => candidate.character === character)) {
      throw codedError("KANJI_CANDIDATE_INVALID");
    }
    state = {
      ...state,
      status: "selected",
      selectedCharacter: character,
      errorCode: null,
    };
  }

  function requestClose() {
    assertDraftMutable();
    if (!state.dirty) {
      return { closed: true, focusTarget: "opener" };
    }
    state = { ...state, status: "confirm-discard" };
    return { closed: false, focusTarget: "keep-drawing" };
  }

  function keepDrawing() {
    assertDraftMutable();
    state = { ...state, status: "drawing", errorCode: null };
  }

  function discardDraft() {
    assertDraftMutable();
    recognitionToken += 1;
    activeStroke = null;
    lastSaveInput = null;
    state = {
      status: "idle",
      dirty: false,
      strokes: [],
      candidates: [],
      selectedCharacter: null,
      errorCode: null,
      savedEntry: state.savedEntry,
    };
    return { closed: true, focusTarget: "opener" };
  }

  async function persistSelected({ noteId } = {}) {
    try {
      lastSaveInput = { noteId };
      const selectedRank = state.candidates.findIndex(
        (candidate) => candidate.character === state.selectedCharacter,
      );
      const timestamp = now();
      const entry = createKanjiInkEntry({
        id: createId(),
        noteId,
        character: state.selectedCharacter,
        strokes: state.strokes,
        recognizer: KANJI_RECOGNIZER_INFO,
        timestamp,
      });
      const persisted = await persist(entry, { selectedRank });
      state = {
        status: "idle",
        dirty: false,
        strokes: [],
        candidates: [],
        selectedCharacter: null,
        errorCode: null,
        savedEntry: structuredClone(persisted ?? entry),
      };
      return structuredClone(persisted ?? entry);
    } catch {
      state = {
        ...state,
        status: "error",
        errorCode: "KANJI_SAVE_FAILED",
      };
      throw codedError("KANJI_SAVE_FAILED");
    }
  }

  function save(input = {}) {
    if (saveInFlight) {
      return saveInFlight;
    }

    if (!state.selectedCharacter) {
      return Promise.reject(codedError("KANJI_CANDIDATE_REQUIRED"));
    }

    let resolveSave;
    let rejectSave;
    const operation = new Promise((resolve, reject) => {
      resolveSave = resolve;
      rejectSave = reject;
    });

    saveInFlight = operation;
    state = { ...state, status: "saving", errorCode: null };

    void persistSelected(input).then((result) => {
      saveInFlight = null;
      resolveSave(result);
    }, (error) => {
      saveInFlight = null;
      rejectSave(error);
    });

    return operation;
  }

  function retrySave(input = lastSaveInput) {
    return save(input ?? {});
  }

  return Object.freeze({
    snapshot,
    beginStroke,
    appendPoint,
    endStroke,
    undoLastStroke,
    clear,
    recognize: runRecognition,
    retryRecognition: runRecognition,
    selectCandidate,
    requestClose,
    keepDrawing,
    discardDraft,
    save,
    retrySave,
  });
}
