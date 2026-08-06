import {
  KANJI_INK_LIMITS,
  validateKanjiStrokes,
} from "./kanjiInkEntry.js";

export const KANJI_RECOGNIZER_INFO = Object.freeze({
  engineId: "mynote-geometric-template",
  engineVersion: "1.0.0",
  datasetVersion: "mynote-kanji-mvp-1",
});

export const SUPPORTED_KANJI = Object.freeze(["人", "入", "八", "大", "犬", "火", "木", "本"]);

const TEMPLATE_DEFINITIONS = [
  {
    character: "人",
    strokes: [
      [{ x: 0.53, y: 0.08 }, { x: 0.45, y: 0.34 }, { x: 0.32, y: 0.63 }, { x: 0.14, y: 0.92 }],
      [{ x: 0.53, y: 0.08 }, { x: 0.58, y: 0.35 }, { x: 0.72, y: 0.66 }, { x: 0.9, y: 0.93 }],
    ],
  },
  {
    character: "入",
    strokes: [
      [{ x: 0.22, y: 0.22 }, { x: 0.38, y: 0.38 }, { x: 0.51, y: 0.57 }, { x: 0.63, y: 0.82 }],
      [{ x: 0.62, y: 0.09 }, { x: 0.58, y: 0.35 }, { x: 0.45, y: 0.63 }, { x: 0.22, y: 0.91 }],
    ],
  },
  {
    character: "八",
    strokes: [
      [{ x: 0.42, y: 0.24 }, { x: 0.36, y: 0.48 }, { x: 0.25, y: 0.72 }, { x: 0.1, y: 0.91 }],
      [{ x: 0.58, y: 0.24 }, { x: 0.64, y: 0.49 }, { x: 0.75, y: 0.72 }, { x: 0.91, y: 0.91 }],
    ],
  },
  {
    character: "大",
    strokes: [
      [{ x: 0.18, y: 0.38 }, { x: 0.5, y: 0.36 }, { x: 0.82, y: 0.38 }],
      [{ x: 0.53, y: 0.12 }, { x: 0.47, y: 0.42 }, { x: 0.35, y: 0.68 }, { x: 0.14, y: 0.92 }],
      [{ x: 0.52, y: 0.43 }, { x: 0.63, y: 0.65 }, { x: 0.83, y: 0.91 }],
    ],
  },
  {
    character: "犬",
    strokes: [
      [{ x: 0.18, y: 0.38 }, { x: 0.5, y: 0.36 }, { x: 0.82, y: 0.38 }],
      [{ x: 0.53, y: 0.12 }, { x: 0.47, y: 0.42 }, { x: 0.35, y: 0.68 }, { x: 0.14, y: 0.92 }],
      [{ x: 0.52, y: 0.43 }, { x: 0.63, y: 0.65 }, { x: 0.83, y: 0.91 }],
      [{ x: 0.68, y: 0.13 }, { x: 0.75, y: 0.22 }],
    ],
  },
  {
    character: "火",
    strokes: [
      [{ x: 0.3, y: 0.28 }, { x: 0.24, y: 0.5 }],
      [{ x: 0.72, y: 0.27 }, { x: 0.78, y: 0.48 }],
      [{ x: 0.51, y: 0.1 }, { x: 0.48, y: 0.42 }, { x: 0.38, y: 0.69 }, { x: 0.18, y: 0.92 }],
      [{ x: 0.51, y: 0.45 }, { x: 0.62, y: 0.67 }, { x: 0.84, y: 0.92 }],
    ],
  },
  {
    character: "木",
    strokes: [
      [{ x: 0.17, y: 0.38 }, { x: 0.5, y: 0.36 }, { x: 0.84, y: 0.38 }],
      [{ x: 0.51, y: 0.1 }, { x: 0.5, y: 0.45 }, { x: 0.5, y: 0.91 }],
      [{ x: 0.49, y: 0.46 }, { x: 0.35, y: 0.67 }, { x: 0.13, y: 0.89 }],
      [{ x: 0.52, y: 0.47 }, { x: 0.66, y: 0.67 }, { x: 0.88, y: 0.89 }],
    ],
  },
  {
    character: "本",
    strokes: [
      [{ x: 0.17, y: 0.32 }, { x: 0.5, y: 0.31 }, { x: 0.84, y: 0.32 }],
      [{ x: 0.51, y: 0.08 }, { x: 0.5, y: 0.44 }, { x: 0.5, y: 0.93 }],
      [{ x: 0.49, y: 0.43 }, { x: 0.35, y: 0.64 }, { x: 0.13, y: 0.86 }],
      [{ x: 0.52, y: 0.44 }, { x: 0.66, y: 0.64 }, { x: 0.88, y: 0.86 }],
      [{ x: 0.32, y: 0.68 }, { x: 0.5, y: 0.67 }, { x: 0.69, y: 0.68 }],
    ],
  },
];

function cloneStrokes(strokes) {
  return strokes.map((stroke) => stroke.map(({ x, y }) => ({ x, y })));
}

const TEMPLATES = TEMPLATE_DEFINITIONS.map(({ character, strokes }) => Object.freeze({
  character,
  strokes: cloneStrokes(strokes),
}));

function recognitionError() {
  const error = new Error("KANJI_RECOGNITION_INPUT_INVALID");
  error.code = "KANJI_RECOGNITION_INPUT_INVALID";
  return error;
}

function resampleStroke(stroke, count = 12) {
  const distances = [0];
  let total = 0;
  for (let index = 1; index < stroke.length; index += 1) {
    total += Math.hypot(
      stroke[index].x - stroke[index - 1].x,
      stroke[index].y - stroke[index - 1].y,
    );
    distances.push(total);
  }
  if (total === 0) return Array.from({ length: count }, () => ({ ...stroke[0] }));

  const result = [];
  for (let sample = 0; sample < count; sample += 1) {
    const target = (total * sample) / (count - 1);
    let segment = 1;
    while (segment < distances.length && distances[segment] < target) segment += 1;
    if (segment >= distances.length) {
      result.push({ ...stroke.at(-1) });
      continue;
    }
    const leftDistance = distances[segment - 1];
    const rightDistance = distances[segment];
    const ratio = rightDistance === leftDistance
      ? 0
      : (target - leftDistance) / (rightDistance - leftDistance);
    const left = stroke[segment - 1];
    const right = stroke[segment];
    result.push({
      x: left.x + ((right.x - left.x) * ratio),
      y: left.y + ((right.y - left.y) * ratio),
    });
  }
  return result;
}

function normalizeDrawing(strokes) {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const stroke of strokes) {
    for (const point of stroke) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  const width = Math.max(maxX - minX, 0.001);
  const height = Math.max(maxY - minY, 0.001);
  return strokes.map((stroke) => resampleStroke(stroke).map((point) => ({
    x: (point.x - minX) / width,
    y: (point.y - minY) / height,
  })));
}

function drawingDistance(left, right) {
  const matchedCount = Math.min(left.length, right.length);
  let sum = Math.abs(left.length - right.length) * 0.32;
  let samples = 0;
  for (let strokeIndex = 0; strokeIndex < matchedCount; strokeIndex += 1) {
    const leftStroke = left[strokeIndex];
    const rightStroke = right[strokeIndex];
    for (let pointIndex = 0; pointIndex < leftStroke.length; pointIndex += 1) {
      sum += Math.hypot(
        leftStroke[pointIndex].x - rightStroke[pointIndex].x,
        leftStroke[pointIndex].y - rightStroke[pointIndex].y,
      );
      samples += 1;
    }
  }
  return (sum / Math.max(samples, 1)) + (Math.abs(left.length - right.length) * 0.12);
}

const NORMALIZED_TEMPLATES = TEMPLATES.map((template) => ({
  character: template.character,
  strokes: normalizeDrawing(template.strokes),
}));

export function getKanjiRecognizerFixtures() {
  return TEMPLATES.map(({ character, strokes }) => ({
    character,
    strokes: cloneStrokes(strokes),
  }));
}

export function recognizeKanji(input) {
  let strokes;
  try {
    strokes = validateKanjiStrokes(input);
  } catch {
    throw recognitionError();
  }
  if (strokes.length > KANJI_INK_LIMITS.maxStrokes) throw recognitionError();
  if (strokes.length === 1) return [];

  const normalized = normalizeDrawing(strokes);
  const candidates = NORMALIZED_TEMPLATES.map((template) => {
    const distance = drawingDistance(normalized, template.strokes);
    return {
      character: template.character,
      score: Math.max(0, Math.min(1, Number((1 - distance).toFixed(6)))),
    };
  }).sort((left, right) => (
    right.score - left.score || left.character.localeCompare(right.character, "ja")
  ));

  if (candidates[0].score < 0.58) return [];
  return candidates.slice(0, 8);
}

export function getKanjiRecognizerMetrics() {
  return {
    templateBytes: new TextEncoder().encode(JSON.stringify(TEMPLATE_DEFINITIONS)).byteLength,
    templateCount: TEMPLATES.length,
    networkRequests: 0,
  };
}
