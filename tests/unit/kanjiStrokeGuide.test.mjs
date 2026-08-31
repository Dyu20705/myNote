import assert from "node:assert/strict";
import test from "node:test";
import {
  getKanjiStrokeDictionary,
  getKanjiStrokeMetadata,
  renderStrokeGuidance,
} from "../../core/kanjiStrokeGuide.js";

test("getKanjiStrokeMetadata returns metadata for known kanji and null for unknown", () => {
  const ichi = getKanjiStrokeMetadata("一");
  assert.deepEqual(ichi, { strokes: 1, radical: "一", grade: 1 });

  const gaku = getKanjiStrokeMetadata("学");
  assert.deepEqual(gaku, { strokes: 8, radical: "子", grade: 1 });

  assert.equal(getKanjiStrokeMetadata("unknown"), null);
  assert.equal(getKanjiStrokeMetadata(""), null);
  assert.equal(getKanjiStrokeMetadata(null), null);
});

test("getKanjiStrokeDictionary returns a defensive copy", () => {
  const dict1 = getKanjiStrokeDictionary();
  const dict2 = getKanjiStrokeDictionary();
  assert.deepEqual(dict1, dict2);
  assert.notEqual(dict1, dict2);

  dict1["一"].strokes = 999;
  assert.equal(getKanjiStrokeDictionary()["一"].strokes, 1);
});

test("renderStrokeGuidance draws guidance elements on canvas context", () => {
  const operations = [];
  const mockContext = {
    fillStyle: "",
    font: "",
    strokeStyle: "",
    lineWidth: 0,
    fillText(text, x, y) {
      operations.push({ op: "fillText", text, x, y });
    },
    beginPath() {
      operations.push({ op: "beginPath" });
    },
    arc(x, y, radius) {
      operations.push({ op: "arc", x, y, radius });
    },
    fill() {
      operations.push({ op: "fill" });
    },
    save() {
      operations.push({ op: "save" });
    },
    translate(x, y) {
      operations.push({ op: "translate", x, y });
    },
    rotate(angle) {
      operations.push({ op: "rotate", angle });
    },
    moveTo(x, y) {
      operations.push({ op: "moveTo", x, y });
    },
    lineTo(x, y) {
      operations.push({ op: "lineTo", x, y });
    },
    setLineDash(dash) {
      operations.push({ op: "setLineDash", dash });
    },
    stroke() {
      operations.push({ op: "stroke" });
    },
    restore() {
      operations.push({ op: "restore" });
    },
  };

  const strokes = [
    {
      tool: "pen",
      width: 0.01,
      points: [
        { x: 0.1, y: 0.1, t: 0 },
        { x: 0.2, y: 0.2, t: 10 },
        { x: 0.3, y: 0.3, t: 20 },
        { x: 0.4, y: 0.4, t: 30 },
      ],
    },
    {
      tool: "pen",
      width: 0.01,
      points: [
        { x: 0.5, y: 0.5, t: 0 },
        { x: 0.6, y: 0.6, t: 10 },
      ],
    },
  ];

  renderStrokeGuidance(mockContext, strokes, 0, strokes[0], { width: 500, height: 500 });

  const fillTextOps = operations.filter((op) => op.op === "fillText");
  assert.equal(fillTextOps.length, 1);
  assert.equal(fillTextOps[0].text, "1");

  const arcOps = operations.filter((op) => op.op === "arc");
  assert.equal(arcOps.length, 1);

  // Checks that eraser strokes are ignored
  const eraserOpCountBefore = operations.length;
  renderStrokeGuidance(mockContext, strokes, 0, { tool: "eraser", points: [{ x: 0, y: 0 }] }, { width: 500, height: 500 });
  assert.equal(operations.length, eraserOpCountBefore);
});
