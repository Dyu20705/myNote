export const KANJI_INK_LIMITS = Object.freeze({
  maxStrokes: 32,
  maxPointsPerStroke: 256,
  maxTotalPoints: 4096,
  maxSerializedBytes: 262144,
});

const ENTRY_KEYS = Object.freeze([
  "id",
  "noteId",
  "schemaVersion",
  "revision",
  "character",
  "strokes",
  "recognizer",
  "createdAt",
  "updatedAt",
]);
const LEGACY_RECOGNIZER_KEYS = Object.freeze([
  "engineId",
  "engineVersion",
  "datasetVersion",
]);
const RECOGNIZER_KEYS = Object.freeze([
  ...LEGACY_RECOGNIZER_KEYS,
  "selectedRank",
]);
const POINT_KEYS = Object.freeze(["x", "y"]);
const HAN_CHARACTER = /^\p{Script=Han}$/u;

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value, expectedKeys) {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function cloneRequiredString(value, maxLength = 256) {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  return value;
}

function cloneTimestamp(value) {
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  return value;
}

function cloneRecognizer(value) {
  const isLegacy = isPlainObject(value) && hasExactOwnKeys(value, LEGACY_RECOGNIZER_KEYS);
  const hasProvenance = isPlainObject(value) && hasExactOwnKeys(value, RECOGNIZER_KEYS);
  if (!isLegacy && !hasProvenance) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  const recognizer = {
    engineId: cloneRequiredString(value.engineId, 128),
    engineVersion: cloneRequiredString(value.engineVersion, 64),
    datasetVersion: cloneRequiredString(value.datasetVersion, 128),
  };
  if (hasProvenance) {
    if (!Number.isInteger(value.selectedRank) || value.selectedRank < 0 || value.selectedRank > 7) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    recognizer.selectedRank = value.selectedRank;
  }
  return recognizer;
}

export function validateKanjiStrokes(strokes) {
  if (!Array.isArray(strokes) || strokes.length < 1) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  if (strokes.length > KANJI_INK_LIMITS.maxStrokes) {
    throw codedError("KANJI_INK_ENTRY_LIMIT");
  }

  let totalPoints = 0;
  const cloned = strokes.map((stroke) => {
    if (!Array.isArray(stroke) || stroke.length < 2) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    if (stroke.length > KANJI_INK_LIMITS.maxPointsPerStroke) {
      throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    totalPoints += stroke.length;
    if (totalPoints > KANJI_INK_LIMITS.maxTotalPoints) {
      throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    return stroke.map((point) => {
      if (!isPlainObject(point) || !hasExactOwnKeys(point, POINT_KEYS)) {
        throw codedError("KANJI_INK_ENTRY_INVALID");
      }
      const x = point.x;
      const y = point.y;
      if (
        !Number.isFinite(x)
        || !Number.isFinite(y)
        || x < 0
        || x > 1
        || y < 0
        || y > 1
      ) {
        throw codedError("KANJI_INK_ENTRY_INVALID");
      }
      return { x, y };
    });
  });

  return cloned;
}

function byteLength(value) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function validateKanjiInkEntry(input) {
  try {
    if (!isPlainObject(input) || !hasExactOwnKeys(input, ENTRY_KEYS)) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const schemaVersion = input.schemaVersion;
    const revision = input.revision;
    const character = input.character;
    if (
      schemaVersion !== 1
      || !Number.isInteger(revision)
      || revision < 1
      || typeof character !== "string"
      || !HAN_CHARACTER.test(character)
    ) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }

    const entry = {
      id: cloneRequiredString(input.id),
      noteId: cloneRequiredString(input.noteId),
      schemaVersion,
      revision,
      character,
      strokes: validateKanjiStrokes(input.strokes),
      recognizer: cloneRecognizer(input.recognizer),
      createdAt: cloneTimestamp(input.createdAt),
      updatedAt: cloneTimestamp(input.updatedAt),
    };

    if (byteLength(JSON.stringify(entry)) > KANJI_INK_LIMITS.maxSerializedBytes) {
      throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    return entry;
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") {
      throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function createKanjiInkEntry({
  id,
  noteId,
  character,
  strokes,
  recognizer,
  timestamp,
}) {
  return validateKanjiInkEntry({
    id,
    noteId,
    schemaVersion: 1,
    revision: 1,
    character,
    strokes,
    recognizer,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function serializeKanjiInkEntry(entry) {
  return JSON.stringify(validateKanjiInkEntry(entry));
}

export function validateKanjiImportBundle(input) {
  try {
    if (
      !isPlainObject(input)
      || !hasExactOwnKeys(input, ["schemaVersion", "kanjiInkEntries"])
      || input.schemaVersion !== 3
      || !Array.isArray(input.kanjiInkEntries)
    ) {
      throw codedError("KANJI_IMPORT_INVALID");
    }
    const seenIds = new Set();
    const entries = input.kanjiInkEntries.map((entry) => {
      const validated = validateKanjiInkEntry(entry);
      if (seenIds.has(validated.id)) {
        throw codedError("KANJI_IMPORT_INVALID");
      }
      seenIds.add(validated.id);
      return validated;
    });
    return {
      schemaVersion: 3,
      kanjiInkEntries: entries,
    };
  } catch {
    throw codedError("KANJI_IMPORT_INVALID");
  }
}
