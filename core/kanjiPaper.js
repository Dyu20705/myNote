const RULE_DIVISIONS = 8;
const MAX_PAPER_DIMENSION = 4096;

export const KANJI_PAPER_PATTERN = Object.freeze({
  persistedStyle: "grid",
  semanticName: "ruled-horizontal",
  orientation: "horizontal",
  backgroundColor: "#0a0b0d",
  ruleColor: "#313743",
  inkColor: "#f4f6f8",
  ruleWidth: 1,
  ruleCount: RULE_DIVISIONS - 1,
  spacingRatio: 1 / RULE_DIVISIONS,
});

export const KANJI_LEGACY_PAPER_PATTERN = Object.freeze({
  backgroundColor: "#ffffff",
  inkColor: "#111827",
});

function boundedDimension(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(MAX_PAPER_DIMENSION, value);
}

function coordinate(value) {
  return Number(value.toFixed(2));
}

export function createKanjiPaperGeometry(width, height) {
  const safeWidth = boundedDimension(width);
  const safeHeight = boundedDimension(height);
  const rules = Array.from({ length: KANJI_PAPER_PATTERN.ruleCount }, (_, index) => {
    const y = coordinate(safeHeight * (index + 1) * KANJI_PAPER_PATTERN.spacingRatio);
    return Object.freeze({ x1: 0, y1: y, x2: safeWidth, y2: y });
  });
  return Object.freeze({
    width: safeWidth,
    height: safeHeight,
    rules: Object.freeze(rules),
  });
}
