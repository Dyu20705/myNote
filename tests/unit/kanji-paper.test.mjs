import assert from "node:assert/strict";
import test from "node:test";

import {
  KANJI_PAPER_PATTERN,
  createKanjiPaperGeometry,
} from "../../core/kanjiPaper.js";

test("ruled paper derives seven horizontal rules for square previews", () => {
  const geometry = createKanjiPaperGeometry(160, 160);

  assert.deepEqual(geometry.rules.map((rule) => rule.y1), [20, 40, 60, 80, 100, 120, 140]);
  assert.equal(geometry.rules.every((rule) => rule.x1 === 0 && rule.x2 === 160), true);
  assert.equal(KANJI_PAPER_PATTERN.orientation, "horizontal");
  assert.equal(Object.isFrozen(KANJI_PAPER_PATTERN), true);
});

test("ruled paper spacing is derived from height for the accepted canvas", () => {
  const geometry = createKanjiPaperGeometry(860, 430);

  assert.deepEqual(
    geometry.rules.map((rule) => rule.y1),
    [53.75, 107.5, 161.25, 215, 268.75, 322.5, 376.25],
  );
  assert.equal(geometry.rules.every((rule) => rule.x1 === 0 && rule.x2 === 860), true);
});
