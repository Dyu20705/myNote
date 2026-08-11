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
const GRAPH_LIMITS = Object.freeze({
  maxDepth: 128,
  maxEntryNodes: 65_536,
  maxCodecNodes: 1_000_000,
  maxCodecSerializedBytes: 8 * 1024 * 1024,
});
const PENDING_REFERENCE = Symbol("pending-reference");

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

function traversalContext(maxNodes = GRAPH_LIMITS.maxEntryNodes) {
  return { seen: new WeakSet(), nodes: 0, maxNodes };
}

function countGraphNode(context, depth) {
  context.nodes += 1;
  if (depth > GRAPH_LIMITS.maxDepth || context.nodes > context.maxNodes) {
    throw codedError("KANJI_INK_ENTRY_LIMIT");
  }
}

function assertCloneableData(value, context = traversalContext(), depth = 0) {
  countGraphNode(context, depth);
  if (value === null || ["string", "number", "boolean", "undefined", "bigint"].includes(typeof value)) {
    return;
  }
  if (typeof value !== "object") throw codedError("KANJI_INK_ENTRY_INVALID");
  if (context.seen.has(value)) return;

  context.seen.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype
      || Object.getOwnPropertySymbols(value).length > 0) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter((key) => key !== "length");
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    for (const key of keys) {
      assertDataProperty(descriptors[key]);
      if (!descriptors[key].enumerable) throw codedError("KANJI_INK_ENTRY_INVALID");
      assertCloneableData(descriptors[key].value, context, depth + 1);
    }
  } else if (isPlainObject(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0) throw codedError("KANJI_INK_ENTRY_INVALID");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Object.keys(descriptors)) {
      const descriptor = descriptors[key];
      assertDataProperty(descriptor);
      if (!descriptor.enumerable) throw codedError("KANJI_INK_ENTRY_INVALID");
      assertCloneableData(descriptor.value, context, depth + 1);
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
      assertCloneableData(key, context, depth + 1);
      assertCloneableData(mappedValue, context, depth + 1);
    }
  } else if (Object.getPrototypeOf(value) === Set.prototype) {
    assertNoOwnProperties(value);
    for (const item of Set.prototype.values.call(value)) {
      assertCloneableData(item, context, depth + 1);
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
}

function cloneData(value) {
  try {
    assertCloneableData(value, traversalContext(GRAPH_LIMITS.maxEntryNodes));
    return decodeGraphNode(
      encodeGraphNode(value),
      decodeContext(GRAPH_LIMITS.maxEntryNodes),
    );
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") throw codedError("KANJI_INK_ENTRY_LIMIT");
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

function encodeContext(maxBytes = GRAPH_LIMITS.maxCodecSerializedBytes) {
  return { references: new WeakMap(), nextId: 1, payloadBytes: 0, maxBytes };
}

function chargePayload(context, value) {
  const bytes = typeof value === "string" ? byteLength(value) : value;
  context.payloadBytes += bytes;
  if (context.payloadBytes > context.maxBytes) throw codedError("KANJI_INK_ENTRY_LIMIT");
}

function encodeGraphNode(value, context = encodeContext()) {
  if (value === null) return ["null"];
  if (typeof value === "string") {
    chargePayload(context, value);
    return ["string", value];
  }
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "undefined") return ["undefined"];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];

  const knownId = context.references.get(value);
  if (knownId !== undefined) return ["ref", knownId];
  const id = context.nextId;
  context.nextId += 1;
  context.references.set(value, id);

  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return ["array", id, Array.from({ length: value.length }, (_, index) => (
      encodeGraphNode(descriptors[index].value, context)
    ))];
  }
  if (isPlainObject(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return [
      "object",
      id,
      Object.getPrototypeOf(value) === null,
      Object.keys(descriptors).map((key) => {
        chargePayload(context, key);
        return [key, encodeGraphNode(descriptors[key].value, context)];
      }),
    ];
  }
  if (Object.getPrototypeOf(value) === Date.prototype) {
    return ["date", id, encodeGraphNode(Date.prototype.getTime.call(value), context)];
  }
  if (Object.getPrototypeOf(value) === RegExp.prototype) {
    chargePayload(context, value.source);
    chargePayload(context, value.flags);
    return ["regexp", id, value.source, value.flags, value.lastIndex];
  }
  if (Object.getPrototypeOf(value) === ArrayBuffer.prototype) {
    chargePayload(context, value.byteLength * 4);
    return ["buffer", id, bytesFor(new Uint8Array(value))];
  }
  if (Object.getPrototypeOf(value) === Map.prototype) {
    return ["map", id, [...Map.prototype.entries.call(value)].map(([key, item]) => [
      encodeGraphNode(key, context),
      encodeGraphNode(item, context),
    ])];
  }
  if (Object.getPrototypeOf(value) === Set.prototype) {
    return ["set", id, [...Set.prototype.values.call(value)].map((item) => (
      encodeGraphNode(item, context)
    ))];
  }
  if (ArrayBuffer.isView(value)) {
    const name = Object.getPrototypeOf(value) === DataView.prototype
      ? "DataView"
      : TYPED_ARRAYS.find((item) => Object.getPrototypeOf(value) === globalThis[item].prototype);
    return [
      "view",
      id,
      name,
      encodeGraphNode(value.buffer, context),
      value.byteOffset,
      Object.getPrototypeOf(value) === DataView.prototype ? value.byteLength : value.length,
    ];
  }
  throw codedError("KANJI_INK_ENTRY_INVALID");
}

function decodeContext(maxNodes = GRAPH_LIMITS.maxCodecNodes) {
  return { references: new Map(), nodes: 0, maxNodes };
}

function countDecodedNode(context, depth) {
  context.nodes += 1;
  if (depth > GRAPH_LIMITS.maxDepth || context.nodes > context.maxNodes) {
    throw codedError("KANJI_INK_ENTRY_LIMIT");
  }
}

function decodeNumber(value) {
  if (typeof value !== "string" || value.length === 0) throw codedError("KANJI_INK_ENTRY_INVALID");
  if (!["NaN", "Infinity", "-Infinity", "-0"].includes(value) && !Number.isFinite(Number(value))) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  return Number(value);
}

function validBytes(value) {
  return Array.isArray(value)
    && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255);
}

function decodeLegacyNode(node, context = decodeContext(), depth = 0) {
  countDecodedNode(context, depth);
  if (!Array.isArray(node) || typeof node[0] !== "string") throw codedError("KANJI_INK_ENTRY_INVALID");
  const [type, value, extra, finalValue] = node;
  if (type === "null" && node.length === 1) return null;
  if (type === "string" && node.length === 2 && typeof value === "string") return value;
  if (type === "boolean" && node.length === 2 && typeof value === "boolean") return value;
  if (type === "undefined" && node.length === 1) return undefined;
  if (type === "bigint" && node.length === 2 && typeof value === "string") return BigInt(value);
  if (type === "number" && node.length === 2) return decodeNumber(value);
  if (type === "array" && node.length === 2 && Array.isArray(value)) {
    return value.map((item) => decodeLegacyNode(item, context, depth + 1));
  }
  if (type === "object" && node.length === 3 && typeof value === "boolean" && Array.isArray(extra)) {
    const object = value ? Object.create(null) : {};
    const keys = new Set();
    for (const pair of extra) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || keys.has(pair[0])) {
        throw codedError("KANJI_INK_ENTRY_INVALID");
      }
      keys.add(pair[0]);
      Object.defineProperty(object, pair[0], {
        value: decodeLegacyNode(pair[1], context, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return object;
  }
  if (type === "date" && node.length === 2) {
    return new Date(decodeLegacyNode(value, context, depth + 1));
  }
  if (type === "regexp" && node.length === 4 && typeof value === "string"
    && typeof extra === "string" && Number.isInteger(finalValue) && finalValue >= 0) {
    const expression = new RegExp(value, extra);
    expression.lastIndex = finalValue;
    return expression;
  }
  if (type === "buffer" && node.length === 2 && validBytes(value)) {
    return Uint8Array.from(value).buffer;
  }
  if (type === "map" && node.length === 2 && Array.isArray(value)) {
    const map = new Map();
    for (const pair of value) {
      if (!Array.isArray(pair) || pair.length !== 2) throw codedError("KANJI_INK_ENTRY_INVALID");
      const key = decodeLegacyNode(pair[0], context, depth + 1);
      if (map.has(key)) throw codedError("KANJI_INK_ENTRY_INVALID");
      map.set(key, decodeLegacyNode(pair[1], context, depth + 1));
    }
    return map;
  }
  if (type === "set" && node.length === 2 && Array.isArray(value)) {
    const set = new Set();
    for (const encoded of value) {
      const item = decodeLegacyNode(encoded, context, depth + 1);
      if (set.has(item)) throw codedError("KANJI_INK_ENTRY_INVALID");
      set.add(item);
    }
    return set;
  }
  if (type === "view" && node.length === 3 && typeof value === "string" && validBytes(extra)) {
    const buffer = Uint8Array.from(extra).buffer;
    if (value === "DataView") return new DataView(buffer);
    if (TYPED_ARRAYS.includes(value) && extra.length % globalThis[value].BYTES_PER_ELEMENT === 0) {
      return new globalThis[value](buffer);
    }
  }
  throw codedError("KANJI_INK_ENTRY_INVALID");
}

function registerReference(context, id, value) {
  if (!Number.isInteger(id) || id < 1 || id > context.maxNodes || context.references.has(id)) {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
  context.references.set(id, value);
}

function decodeGraphNode(node, context = decodeContext(), depth = 0) {
  countDecodedNode(context, depth);
  if (!Array.isArray(node) || typeof node[0] !== "string") throw codedError("KANJI_INK_ENTRY_INVALID");
  const type = node[0];
  if (type === "null" && node.length === 1) return null;
  if (type === "string" && node.length === 2 && typeof node[1] === "string") return node[1];
  if (type === "boolean" && node.length === 2 && typeof node[1] === "boolean") return node[1];
  if (type === "undefined" && node.length === 1) return undefined;
  if (type === "bigint" && node.length === 2 && typeof node[1] === "string") return BigInt(node[1]);
  if (type === "number" && node.length === 2) return decodeNumber(node[1]);
  if (type === "ref" && node.length === 2 && Number.isInteger(node[1])) {
    const reference = context.references.get(node[1]);
    if (reference === undefined || reference === PENDING_REFERENCE) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    return reference;
  }

  const id = node[1];
  if (type === "array" && node.length === 3 && Array.isArray(node[2])) {
    const array = [];
    registerReference(context, id, array);
    for (const encoded of node[2]) array.push(decodeGraphNode(encoded, context, depth + 1));
    return array;
  }
  if (type === "object" && node.length === 4 && typeof node[2] === "boolean" && Array.isArray(node[3])) {
    const object = node[2] ? Object.create(null) : {};
    registerReference(context, id, object);
    const keys = new Set();
    for (const pair of node[3]) {
      if (!Array.isArray(pair) || pair.length !== 2 || typeof pair[0] !== "string" || keys.has(pair[0])) {
        throw codedError("KANJI_INK_ENTRY_INVALID");
      }
      keys.add(pair[0]);
      Object.defineProperty(object, pair[0], {
        value: decodeGraphNode(pair[1], context, depth + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return object;
  }
  if (type === "date" && node.length === 3) {
    const date = new Date(decodeGraphNode(node[2], context, depth + 1));
    registerReference(context, id, date);
    return date;
  }
  if (type === "regexp" && node.length === 5 && typeof node[2] === "string"
    && typeof node[3] === "string" && Number.isInteger(node[4]) && node[4] >= 0) {
    const expression = new RegExp(node[2], node[3]);
    expression.lastIndex = node[4];
    registerReference(context, id, expression);
    return expression;
  }
  if (type === "buffer" && node.length === 3 && validBytes(node[2])) {
    const buffer = Uint8Array.from(node[2]).buffer;
    registerReference(context, id, buffer);
    return buffer;
  }
  if (type === "map" && node.length === 3 && Array.isArray(node[2])) {
    const map = new Map();
    registerReference(context, id, map);
    for (const pair of node[2]) {
      if (!Array.isArray(pair) || pair.length !== 2) throw codedError("KANJI_INK_ENTRY_INVALID");
      const key = decodeGraphNode(pair[0], context, depth + 1);
      if (map.has(key)) throw codedError("KANJI_INK_ENTRY_INVALID");
      map.set(key, decodeGraphNode(pair[1], context, depth + 1));
    }
    return map;
  }
  if (type === "set" && node.length === 3 && Array.isArray(node[2])) {
    const set = new Set();
    registerReference(context, id, set);
    for (const encoded of node[2]) {
      const item = decodeGraphNode(encoded, context, depth + 1);
      if (set.has(item)) throw codedError("KANJI_INK_ENTRY_INVALID");
      set.add(item);
    }
    return set;
  }
  if (type === "view" && node.length === 6 && typeof node[2] === "string"
    && Number.isInteger(node[4]) && node[4] >= 0 && Number.isInteger(node[5]) && node[5] >= 0) {
    registerReference(context, id, PENDING_REFERENCE);
    const buffer = decodeGraphNode(node[3], context, depth + 1);
    if (Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    let view;
    if (node[2] === "DataView") view = new DataView(buffer, node[4], node[5]);
    else if (TYPED_ARRAYS.includes(node[2])) view = new globalThis[node[2]](buffer, node[4], node[5]);
    else throw codedError("KANJI_INK_ENTRY_INVALID");
    context.references.set(id, view);
    return view;
  }
  throw codedError("KANJI_INK_ENTRY_INVALID");
}

function jsonStringBytes(value) {
  let bytes = 2;
  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    if (codePoint === 0x22 || codePoint === 0x5c
      || codePoint === 0x08 || codePoint === 0x09 || codePoint === 0x0a
      || codePoint === 0x0c || codePoint === 0x0d) bytes += 2;
    else if (codePoint < 0x20 || (codePoint >= 0xd800 && codePoint <= 0xdfff)) bytes += 6;
    else if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
    if (bytes > GRAPH_LIMITS.maxCodecSerializedBytes) throw codedError("KANJI_INK_ENTRY_LIMIT");
    index += codePoint > 0xffff ? 2 : 1;
  }
  return bytes;
}

function measureJsonEnvelope(value, context = {
  ancestors: new WeakSet(),
  nodes: 0,
  maxNodes: GRAPH_LIMITS.maxCodecNodes,
}, depth = 0) {
  countDecodedNode(context, depth);
  let bytes;
  if (value === null) bytes = 4;
  else if (typeof value === "string") bytes = jsonStringBytes(value);
  else if (typeof value === "boolean") bytes = value ? 4 : 5;
  else if (typeof value === "number" && Number.isFinite(value)) bytes = String(value).length;
  else if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype
      || Object.getOwnPropertySymbols(value).length > 0 || context.ancestors.has(value)) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).filter((key) => key !== "length");
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    context.ancestors.add(value);
    bytes = 2 + Math.max(0, value.length - 1);
    for (const key of keys) {
      assertDataProperty(descriptors[key]);
      if (!descriptors[key].enumerable) throw codedError("KANJI_INK_ENTRY_INVALID");
      bytes += measureJsonEnvelope(descriptors[key].value, context, depth + 1);
      if (bytes > GRAPH_LIMITS.maxCodecSerializedBytes) throw codedError("KANJI_INK_ENTRY_LIMIT");
    }
    context.ancestors.delete(value);
  } else throw codedError("KANJI_INK_ENTRY_INVALID");
  if (bytes > GRAPH_LIMITS.maxCodecSerializedBytes) throw codedError("KANJI_INK_ENTRY_LIMIT");
  return bytes;
}

export function serializeKanjiInkJson(value) {
  try {
    assertCloneableData(value, traversalContext(GRAPH_LIMITS.maxCodecNodes));
    const envelope = ["kanji-ink-json", 2, encodeGraphNode(value)];
    measureJsonEnvelope(envelope);
    return JSON.stringify(envelope);
  } catch (error) {
    if (error?.code === "KANJI_INK_ENTRY_LIMIT") throw codedError("KANJI_INK_ENTRY_LIMIT");
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function parseKanjiInkJsonEnvelope(envelope) {
  try {
    measureJsonEnvelope(envelope);
    if (!Array.isArray(envelope) || envelope.length !== 3
      || envelope[0] !== "kanji-ink-json" || ![1, 2].includes(envelope[1])) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    const value = envelope[1] === 1
      ? decodeLegacyNode(envelope[2])
      : decodeGraphNode(envelope[2]);
    assertCloneableData(value, traversalContext(GRAPH_LIMITS.maxCodecNodes));
    return value;
  } catch {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

export function parseKanjiInkJson(serialized) {
  try {
    if (typeof serialized !== "string"
      || byteLength(serialized) > GRAPH_LIMITS.maxCodecSerializedBytes) {
      throw codedError("KANJI_INK_ENTRY_INVALID");
    }
    return parseKanjiInkJsonEnvelope(JSON.parse(serialized));
  } catch {
    throw codedError("KANJI_INK_ENTRY_INVALID");
  }
}

function legacyEncodeContext() {
  return {
    ancestors: new WeakSet(),
    nodes: 0,
    maxNodes: GRAPH_LIMITS.maxEntryNodes,
    payloadBytes: 0,
    maxBytes: KANJI_INK_LIMITS.maxSerializedBytes,
  };
}

function cycleTraversalContext() {
  return {
    active: new WeakSet(),
    visited: new WeakSet(),
    nodes: 0,
    maxNodes: GRAPH_LIMITS.maxEntryNodes,
  };
}

function hasGraphCycle(value, context = cycleTraversalContext(), depth = 0) {
  countGraphNode(context, depth);
  if (value === null || ["string", "number", "boolean", "undefined", "bigint"].includes(typeof value)) {
    return false;
  }
  if (context.active.has(value)) return true;
  if (context.visited.has(value)) return false;

  context.active.add(value);
  let children;
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    children = Array.from({ length: value.length }, (_, index) => descriptors[index].value);
  } else if (isPlainObject(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    children = Object.keys(descriptors).map((key) => descriptors[key].value);
  } else if (Object.getPrototypeOf(value) === Map.prototype) {
    children = [...Map.prototype.entries.call(value)].flatMap(([key, item]) => [key, item]);
  } else if (Object.getPrototypeOf(value) === Set.prototype) {
    children = [...Set.prototype.values.call(value)];
  } else if (ArrayBuffer.isView(value)) {
    children = [value.buffer];
  } else children = [];

  const cyclic = children.some((child) => hasGraphCycle(child, context, depth + 1));
  context.active.delete(value);
  context.visited.add(value);
  return cyclic;
}

function encodeLegacyMetricNode(value, context = legacyEncodeContext(), depth = 0) {
  countGraphNode(context, depth);
  if (value === null) return ["null"];
  if (typeof value === "string") {
    chargePayload(context, value);
    return ["string", value];
  }
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "undefined") return ["undefined"];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
  if (context.ancestors.has(value)) throw codedError("KANJI_INK_ENTRY_INVALID");

  context.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      return ["array", Array.from({ length: value.length }, (_, index) => (
        encodeLegacyMetricNode(descriptors[index].value, context, depth + 1)
      ))];
    }
    if (isPlainObject(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      return ["object", Object.getPrototypeOf(value) === null, Object.keys(descriptors).map((key) => {
        chargePayload(context, key);
        return [key, encodeLegacyMetricNode(descriptors[key].value, context, depth + 1)];
      })];
    }
    if (Object.getPrototypeOf(value) === Date.prototype) {
      return ["date", encodeLegacyMetricNode(Date.prototype.getTime.call(value), context, depth + 1)];
    }
    if (Object.getPrototypeOf(value) === RegExp.prototype) {
      chargePayload(context, value.source);
      chargePayload(context, value.flags);
      return ["regexp", value.source, value.flags, value.lastIndex];
    }
    if (Object.getPrototypeOf(value) === ArrayBuffer.prototype) {
      chargePayload(context, value.byteLength * 4);
      return ["buffer", bytesFor(new Uint8Array(value))];
    }
    if (Object.getPrototypeOf(value) === Map.prototype) {
      return ["map", [...Map.prototype.entries.call(value)].map(([key, item]) => [
        encodeLegacyMetricNode(key, context, depth + 1),
        encodeLegacyMetricNode(item, context, depth + 1),
      ])];
    }
    if (Object.getPrototypeOf(value) === Set.prototype) {
      return ["set", [...Set.prototype.values.call(value)].map((item) => (
        encodeLegacyMetricNode(item, context, depth + 1)
      ))];
    }
    if (ArrayBuffer.isView(value)) {
      const name = Object.getPrototypeOf(value) === DataView.prototype
        ? "DataView"
        : TYPED_ARRAYS.find((item) => Object.getPrototypeOf(value) === globalThis[item].prototype);
      chargePayload(context, value.byteLength * 4);
      return ["view", name, bytesFor(value)];
    }
    throw codedError("KANJI_INK_ENTRY_INVALID");
  } finally {
    context.ancestors.delete(value);
  }
}

function legacySerializedMetric(entry) {
  return JSON.stringify(["kanji-ink-json", 1, encodeLegacyMetricNode(entry)]);
}

function enforceSerializedLimit(entry) {
  const serialized = entry.schemaVersion === 2
    ? JSON.stringify(entry)
    : hasGraphCycle(entry) ? serializeKanjiInkJson(entry) : legacySerializedMetric(entry);
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
