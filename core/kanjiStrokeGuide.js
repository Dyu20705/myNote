/**
 * @fileoverview Kanji Stroke Guidance and Dictionary Module.
 * Lazily loaded on demand when stroke guidance is enabled in the drawing canvas.
 */

/**
 * Static dictionary of stroke count and radical metadata for common Kanji.
 */
const KANJI_STROKE_DICTIONARY = Object.freeze({
  "一": { strokes: 1, radical: "一", grade: 1 },
  "二": { strokes: 2, radical: "一", grade: 1 },
  "三": { strokes: 3, radical: "一", grade: 1 },
  "日": { strokes: 4, radical: "日", grade: 1 },
  "月": { strokes: 4, radical: "月", grade: 1 },
  "木": { strokes: 4, radical: "木", grade: 1 },
  "水": { strokes: 4, radical: "水", grade: 1 },
  "火": { strokes: 4, radical: "火", grade: 1 },
  "土": { strokes: 3, radical: "土", grade: 1 },
  "金": { strokes: 8, radical: "金", grade: 1 },
  "本": { strokes: 5, radical: "木", grade: 1 },
  "語": { strokes: 14, radical: "言", grade: 2 },
  "学": { strokes: 8, radical: "子", grade: 1 },
  "生": { strokes: 5, radical: "生", grade: 1 },
  "先": { strokes: 6, radical: "儿", grade: 1 },
});

/**
 * Retrieves stroke metadata for a given character if available.
 * @param {string} character
 * @returns {object|null}
 */
export function getKanjiStrokeMetadata(character) {
  if (typeof character !== "string" || !character) return null;
  const entry = KANJI_STROKE_DICTIONARY[character];
  return entry ? structuredClone(entry) : null;
}

/**
 * Returns a defensive copy of the built-in Kanji stroke dictionary.
 * @returns {object}
 */
export function getKanjiStrokeDictionary() {
  return structuredClone(KANJI_STROKE_DICTIONARY);
}

/**
 * Renders stroke guidance overlays (numbering badge, start circle, direction arrow, air path).
 *
 * @param {CanvasRenderingContext2D} context
 * @param {Array<object>} strokes - All strokes in current drawing
 * @param {number} strokeIndex - Index of the current stroke
 * @param {object} stroke - Current stroke object with tool and points
 * @param {object} dimensions - Canvas dimensions { width, height }
 */
export function renderStrokeGuidance(context, strokes, strokeIndex, stroke, { width, height }) {
  if (!stroke || stroke.tool === "eraser" || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return;
  }

  const startPt = stroke.points[0];

  // 1. Draw stroke numbering badge
  context.fillStyle = "rgba(0, 100, 255, 0.8)";
  context.font = "bold 16px sans-serif";
  context.fillText((strokeIndex + 1).toString(), startPt.x * width + 8, startPt.y * height - 8);

  // 2. Draw a circle at the stroke start point
  context.beginPath();
  context.arc(startPt.x * width, startPt.y * height, 4, 0, 2 * Math.PI);
  context.fill();

  // 3. Draw an arrowhead at the midpoint to indicate stroke direction
  if (stroke.points.length > 3) {
    const midIdx = Math.floor(stroke.points.length / 2);
    const pt1 = stroke.points[midIdx - 1];
    const pt2 = stroke.points[midIdx];
    const angle = Math.atan2(pt2.y * height - pt1.y * height, pt2.x * width - pt1.x * width);
    context.save();
    context.translate(pt2.x * width, pt2.y * height);
    context.rotate(angle);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(-8, -5);
    context.lineTo(-8, 5);
    context.fill();
    context.restore();
  }

  // 4. Draw dashed connecting line to the next stroke (air path)
  if (strokeIndex < strokes.length - 1) {
    const nextStroke = strokes[strokeIndex + 1];
    if (nextStroke && nextStroke.tool !== "eraser" && Array.isArray(nextStroke.points) && nextStroke.points.length > 0) {
      const endPt = stroke.points[stroke.points.length - 1];
      const nextStartPt = nextStroke.points[0];
      context.save();
      context.beginPath();
      context.setLineDash([4, 4]);
      context.strokeStyle = "rgba(0, 100, 255, 0.4)";
      context.lineWidth = 1;
      context.moveTo(endPt.x * width, endPt.y * height);
      context.lineTo(nextStartPt.x * width, nextStartPt.y * height);
      context.stroke();
      context.restore();
    }
  }
}
