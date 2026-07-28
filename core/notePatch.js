function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const PATCH_KEYS = [
  "title",
  "content",
  "tags",
  "links",
  "blocks",
  "ast",
  "pinned",
  "archived",
  "updatedAt",
  "version",
  "checksum",
  "searchBlob",
];
const PATCH_KEY_SET = new Set(PATCH_KEYS);

export function createNotePatch(previous, next) {
  const ops = [];
  for (const key of PATCH_KEYS) {
    if (!sameValue(previous[key], next[key])) {
      ops.push({ key, before: deepClone(previous[key]), after: deepClone(next[key]) });
    }
  }
  return ops;
}

export function invertNotePatch(patch) {
  return patch
    .filter((op) => PATCH_KEY_SET.has(op.key))
    .map((op) => ({ key: op.key, before: deepClone(op.after), after: deepClone(op.before) }));
}

export function applyNotePatch(note, patch) {
  const next = { ...note };
  for (const op of patch) {
    if (!PATCH_KEY_SET.has(op.key)) {
      continue;
    }
    next[op.key] = deepClone(op.after);
  }
  return next;
}
