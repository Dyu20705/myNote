export const KANJI_INK_LIMITS = Object.freeze({
  maxStrokes: 32,
  maxPointsPerStroke: 256,
  maxTotalPoints: 4096,
  maxSerializedBytes: 262144,
  maxStrokeDurationMs: 600000,
});

export const KANJI_INK_WIDTHS = Object.freeze({
  pen: 0.008,
  marker: 0.024,
});

const V1_REQUIRED_KEYS = Object.freeze([
  "id", "noteId", "schemaVersion", "revision", "character", "strokes",
  "recognizer", "createdAt", "updatedAt",
]);
const V2_KEYS = Object.freeze([
  "id", "noteId", "strokes", "paperStyle", "createdAt", "updatedAt", "schemaVersion",
]);
const LEGACY_RECOGNIZER_KEYS = Object.freeze(["engineId", "engineVersion", "datasetVersion"]);
const RECOGNIZER_KEYS = Object.freeze([...LEGACY_RECOGNIZER_KEYS, "selectedRank"]);
const POINT_KEYS = Object.freeze(["x", "y"]);
const V2_STROKE_KEYS = Object.freeze(["tool", "width", "points"]);
const V2_POINT_KEYS = Object.freeze(["x", "y", "t"]);
const HAN_CHARACTER = /^\p{Script=Han}$/u;
const TYPED_ARRAYS = Object.freeze([
  "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
].filter((name) => typeof globalThis[name] === "function"));

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactOwnKeys(value, expectedKeys) {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key));
}

function hasRequiredOwnKeys(value, requiredKeys) {
  return requiredKeys.every((key) => Object.hasOwn(value, key));
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

function assertDataProperty(descriptor) {
  if (!descriptor || !Object.hasOwn(descriptor, "value")) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

function assertNoOwnProperties(value) {
  if (Object.getOwnPropertyNames(value).length > 0 || Object.getOwnPropertySymbols(value).length > 0) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

function assertCloneableData(value, ancestors = new WeakSet()) {
  if (value === null || ["string", "number", "boolean", "undefined", "bigint"].includes(typeof value)) {
    return;
  }
  if (typeof value !== "object" || ancestors.has(value)) throw codedError("KANJI_INK_ENTRY_INVALID");

  ancestors.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter((key) => key !== "length");
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    for (const key of keys) {
      assertDataProperty(descriptors[key]);
      assertCloneableData(descriptors[key].value, ancestors);
    }
  } else if (isPlainObject(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0) throw codedError("KANJI_INK_ENTRY_INVALID");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      assertDataProperty(descriptor);
      if (!descriptor.enumerable) throw codedError("KANJI_INK_ENTRY_INVALID");
      assertCloneableData(descriptor.value, ancestors);
    }
  } else if (Object.getPrototypeOf(value) === Date.prototype
    || Object.getPrototypeOf(value) === ArrayBuffer.prototype) {
    assertNoOwnProperties(value);
  } else if (Object.getPrototypeOf(value) === RegExp.prototype) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.getOwnPropertySymbols(value).length > 0 || Object.getOwnPropertyNames(value).some((key) => key !== "lastIndex")
      || !Object.hasOwn(descriptors, "lastIndex") || !Object.hasOwn(descriptors.lastIndex, "value")) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
  } else if (Object.getPrototypeOf(value) === Map.prototype) {
    assertNoOwnProperties(value);
    for (const [key, mappedValue] of Map.prototype.entries.call(value)) {
      assertCloneableData(key, ancestors);
      assertCloneableData(mappedValue, ancestors);
    }
  } else if (Object.getPrototypeOf(value) === Set.prototype) {
    assertNoOwnProperties(value);
    for (const item of Set.prototype.values.call(value)) {
      assertCloneableData(item, ancestors);
    }
  } else if (ArrayBuffer.isView(value) && (Object.getPrototypeOf(value) === DataView.prototype
    || TYPED_ARRAYS.some((name) => Object.getPrototypeOf(value) === globalThis[name].prototype))) {
    const names = Object.getOwnPropertyNames(value);
    if (Object.getOwnPropertySymbols(value).length > 0
      || (Object.getPrototypeOf(value) === DataView.prototype && names.length > 0)
      || (Object.getPrototypeOf(value) !== DataView.prototype
        && (names.length !== value.length || names.some((name, index) => name !== String(index))))) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
  } else {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  ancestors.delete(value);
}

function cloneData(value) {
  assertCloneableData(value);
  try {
    return decodeNode(encodeNode(value));
  } catch {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

function cloneRecognizer(value) {
  const isLegacy = isPlainObject(value) && hasExactOwnKeys(value, LEGACY_RECOGNIZER_KEYS);
  const hasProvenance = isPlainObject(value) && hasExactOwnKeys(value, RECOGNIZER_KEYS);
  if (!isLegacy && !hasProvenance) throw codedError("KANJI_INK_ENTRY_INVALID");
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
  if (!Array.isArray(strokes) || strokes.length < 1) throw codedError("KANJI_INK_ENTRY_INVALID");
  if (strokes.length > KANJI_INK_LIMITS.maxStrokes) throw codedError("KANJI_INK_ENTRY_LIMIT");

  let totalPoints = 0;
  return strokes.map((stroke) => {
    if (!Array.isArray(stroke) || stroke.length < 2) throw codedError("KANJI_INK_ENTRY_INVALID");
    if (stroke.length > KANJI_INK_LIMITS.maxPointsPerStroke) throw codedError("KANJI_INK_ENTRY_LIMIT");
    totalPoints += stroke.length;
    if (totalPoints > KANJI_INK_LIMITS.maxTotalPoints) throw codedError("KANJI_INK_ENTRY_LIMIT");
    return stroke.map((point) => {
      if (!isPlainObject(point) || !hasExactOwnKeys(point, POINT_KEYS)) {
        throw codedError("KANJI_INK_ENTRY_INVALID");
      }
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)
        || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        throw codedError("KANJI_INK_ENTRY_INVALID");
      }
      return { x: point.x, y: point.y };
    });
  });
}

function validateV2Strokes(strokes) {
  if (!Array.isArray(strokes) || strokes.length < 1) throw codedError("KANJI_INK_ENTRY_INVALID");
  if (strokes.length > KANJI_INK_LIMITS.maxStrokes) throw codedError("KANJI_INK_ENTRY_LIMIT");

  let totalPoints = 0;
  return strokes.map((stroke) => {
    if (!isPlainObject(stroke) || !hasExactOwnKeys(stroke, V2_STROKE_KEYS)) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    if (!Object.hasOwn(KANJI_INK_WIDTHS, stroke.tool) || stroke.width !== KANJI_INK_WIDTHS[stroke.tool]) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    if (!Array.isArray(stroke.points) || stroke.points.length < 2) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    if (stroke.points.length > KANJI_INK_LIMITS.maxPointsPerStroke) {
      throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    totalPoints += stroke.points.length;
    if (totalPoints > KANJI_INK_LIMITS.maxTotalPoints) throw codedError("KANJI_INK_ENTRY_LIMIT");

    let previousTime = -1;
    return {
      tool: stroke.tool,
      width: stroke.width,
      points: stroke.points.map((point, index) => {
        if (!isPlainObject(point) || !hasExactOwnKeys(point, V2_POINT_KEYS)
          || !Number.isFinite(point.x) || !Number.isFinite(point.y)
          || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1
          || !Number.isInteger(point.t) || point.t < 0 || point.t > KANJI_INK_LIMITS.maxStrokeDurationMs
          || (index === 0 && point.t !== 0) || point.t < previousTime) {
          throw codedError("KANJI_INK_ENTRY_INVALID");
        }
        previousTime = point.t;
        return { x: point.x, y: point.y, t: point.t };
      }),
    };
  });
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

function bytesFor(value) {
  return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
}

function encodeNode(value, ancestors = new WeakSet()) {
  if (value === null) return ["null"];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "undefined") return ["undefined"];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
  if (ancestors.has(value)) throw codedError("KANJI_INK_ENTRY_INVALID");
  ancestors.add(value);
  let node;
  if (Array.isArray(value)) node = ["array", value.map((item) => encodeNode(item, ancestors))];
  else if (isPlainObject(value)) node = ["object", Object.getPrototypeOf(value) === null, Object.keys(value).map((key) => [key, encodeNode(value[key], ancestors)])];
  else if (Object.getPrototypeOf(value) === Date.prototype) node = ["date", encodeNode(Date.prototype.getTime.call(value), ancestors)];
  else if (Object.getPrototypeOf(value) === RegExp.prototype) node = ["regexp", value.source, value.flags, value.lastIndex];
  else if (Object.getPrototypeOf(value) === ArrayBuffer.prototype) node = ["buffer", bytesFor(new Uint8Array(value))];
  else if (Object.getPrototypeOf(value) === Map.prototype) node = ["map", [...Map.prototype.entries.call(value)].map(([key, item]) => [encodeNode(key, ancestors), encodeNode(item, ancestors)])];
  else if (Object.getPrototypeOf(value) === Set.prototype) node = ["set", [...Set.prototype.values.call(value)].map((item) => encodeNode(item, ancestors))];
  else if (ArrayBuffer.isView(value)) {
    const name = Object.getPrototypeOf(value) === DataView.prototype ? "DataView" : TYPED_ARRAYS.find((item) => Object.getPrototypeOf(value) === globalThis[item].prototype);
    node = ["view", name, bytesFor(value)];
  } else throw codedError("KANJI_INK_ENTRY_INVALID");
  ancestors.delete(value);
  return node;
}

function decodeNode(node) {
  if (!Array.isArray(node) || typeof node[0] !== "string") throw codedError("KANJI_INK_ENTRY_INVALID");
  const [type, value, extra, finalValue] = node;
  if (type === "null" && node.length === 1) return null;
  if (type === "string" && node.length === 2 && typeof value === "string") return value;
  if (type === "boolean" && node.length === 2 && typeof value === "boolean") return value;
  if (type === "undefined" && node.length === 1) return undefined;
  if (type === "bigint" && node.length === 2 && typeof value === "string") return BigInt(value);
  if (type === "number" && node.length === 2 && typeof value === "string") {
    if (!["NaN", "Infinity", "-Infinity", "-0"].includes(value) && !Number.isFinite(Number(value))) throw codedError("KANJI_INK_ENTRY_INVALID");
    return Number(value);
  }
  if (type === "array" && node.length === 2 && Array.isArray(value)) return value.map(decodeNode);
  if (type === "object" && node.length === 3 && typeof value === "boolean" && Array.isArray(extra)) {
    const object = value ? Object.create(null) : {};
    for (const pair of extra) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string") throw codedError("KANJI_INK_ENTRY_INVALID");
      Object.defineProperty(object, pair[0], { value: decodeNode(pair[1]), enumerable: true, configurable: true, writable: true });
    }
    return object;
  }
  if (type === "date" && node.length === 2) return new Date(decodeNode(value));
  if (type === "regexp" && node.length === 4 && typeof value === "string" && typeof extra === "string" && Number.isInteger(finalValue) && finalValue >= 0) {
    const expression = new RegExp(value, extra); expression.lastIndex = finalValue; return expression;
  }
  if (type === "buffer" && node.length === 2 && Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return Uint8Array.from(value).buffer;
  if (type === "map" && node.length === 2 && Array.isArray(value)) return new Map(value.map((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) throw codedError("KANJI_INK_ENTRY_INVALID"); return [decodeNode(pair[0]), decodeNode(pair[1])];
  }));
  if (type === "set" && node.length === 2 && Array.isArray(value)) return new Set(value.map(decodeNode));
  if (type === "view" && node.length === 3 && typeof value === "string" && Array.isArray(extra) && extra.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    const buffer = Uint8Array.from(extra).buffer;
    if (value === "DataView") return new DataView(buffer);
    if (TYPED_ARRAYS.includes(value) && extra.length % globalThis[value].BYTES_PER_ELEMENT === 0) return new globalThis[value](buffer);
  }
  throw codedError("KANJI_INK_ENTRY_INVALID");
}

export function serializeKanjiInkJson(value) {
  assertCloneableData(value);
  return JSON.stringify(["kanji-ink-json", 1, encodeNode(value)]);
}

export function parseKanjiInkJson(serialized) {
  try {
    const envelope = JSON.parse(serialized);
    if (!Array.isArray(envelope) || envelope.length !== 3 || envelope[0] !== "kanji-ink-json" || envelope[1] !== 1) throw codedError("KANJI_INK_ENTRY_INVALID");
    const value = decodeNode(envelope[2]);
    assertCloneableData(value);
    return value;
  } catch {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

function enforceSerializedLimit(entry) {
  const serialized = entry.schemaVersion === 2
    ? JSON.stringify(entry)
    : serializeKanjiInkJson(entry);
  if (byteLength(serialized) > KANJI_INK_LIMITS.maxSerializedBytes) {
    throw codedError("KANJI_INK_ENTRY_LIMIT");
  }
  return entry;
}

export function validateKanjiInkEntryV1(input) {
  try {
    if (!isPlainObject(input) || !hasRequiredOwnKeys(input, V1_REQUIRED_KEYS)) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const entry = cloneData(input);
    if (entry.schemaVersion !== 1 || !Number.isInteger(entry.revision) || entry.revision < 1
      || typeof entry.character !== "string" || !HAN_CHARACTER.test(entry.character)) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    cloneRequiredString(entry.id);
    cloneRequiredString(entry.noteId);
    validateKanjiStrokes(entry.strokes);
    cloneRecognizer(entry.recognizer);
    cloneTimestamp(entry.createdAt);
    cloneTimestamp(entry.updatedAt);
    return enforceSerializedLimit(entry);
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") throw codedError("KANJI_INK_ENTRY_LIMIT");
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function validateKanjiInkEntryV2(input) {
  try {
    if (!isPlainObject(input) || !hasExactOwnKeys(input, V2_KEYS)) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const entry = cloneData(input);
    if (entry.schemaVersion !== 2 || entry.paperStyle !== "grid") {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const validated = {
      id: cloneRequiredString(entry.id),
      noteId: cloneRequiredString(entry.noteId),
      strokes: validateV2Strokes(entry.strokes),
      paperStyle: entry.paperStyle,
      createdAt: cloneTimestamp(entry.createdAt),
      updatedAt: cloneTimestamp(entry.updatedAt),
      schemaVersion: 2,
    };
    return enforceSerializedLimit(validated);
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") throw codedError("KANJI_INK_ENTRY_LIMIT");
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function validateKanjiInkEntry(input) {
  try {
    if (!isPlainObject(input)) throw codedError("KANJI_INK_ENTRY_INVALID");
    const descriptor = Object.getOwnPropertyDescriptor(input, "schemaVersion");
    assertDataProperty(descriptor);
    if (descriptor.value === 1) return validateKanjiInkEntryV1(input);
    if (descriptor.value === 2) return validateKanjiInkEntryV2(input);
    throw codedError("KANJI_INK_ENTRY_INVALID");
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") throw codedError("KANJI_INK_ENTRY_LIMIT");
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function createKanjiInkEntry({ id, noteId, character, strokes, recognizer, timestamp }) {
  return validateKanjiInkEntryV1({
    id, noteId, schemaVersion: 1, revision: 1, character, strokes, recognizer,
    createdAt: timestamp, updatedAt: timestamp,
  });
}

export function createKanjiInkEntryV2({ id, noteId, strokes, paperStyle = "grid", timestamp }) {
  return validateKanjiInkEntryV2({
    id, noteId, strokes, paperStyle, createdAt: timestamp, updatedAt: timestamp, schemaVersion: 2,
  });
}

export function serializeKanjiInkEntry(entry) {
  return serializeKanjiInkJson(validateKanjiInkEntry(entry));
}

export function parseKanjiInkEntry(serialized) {
  try {
    return validateKanjiInkEntry(parseKanjiInkJson(serialized));
  } catch {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function validateKanjiImportBundle(input) {
  try {
    if (!isPlainObject(input) || !hasExactOwnKeys(input, ["schemaVersion", "kanjiInkEntries"])
      || !Array.isArray(input.kanjiInkEntries) || ![3, 4].includes(input.schemaVersion)) {
      throw codedError("KANJI_IMPORT_INVALID");
    }
    const seenIds = new Set();
    const entries = input.kanjiInkEntries.map((entry) => {
      const validated = validateKanjiInkEntry(entry);
      if ((input.schemaVersion === 3 && validated.schemaVersion !== 1) || seenIds.has(validated.id)) {
        throw codedError("KANJI_IMPORT_INVALID");
      }
      seenIds.add(validated.id);
      return validated;
    });
    return { schemaVersion: input.schemaVersion, kanjiInkEntries: entries };
  } catch {
    throw codedError("KANJI_IMPORT_INVALID");
  }
}
