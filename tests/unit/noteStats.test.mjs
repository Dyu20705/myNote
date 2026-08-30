import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateWordCount,
  calculateCharacterCount,
  calculateReadingTimeMinutes,
  calculateParagraphCount,
  computeNoteStats,
} from "../../core/noteStats.js";

test("calculateWordCount returns correct word counts for various inputs", () => {
  assert.equal(calculateWordCount(""), 0);
  assert.equal(calculateWordCount("   "), 0);
  assert.equal(calculateWordCount("Hello world"), 2);
  assert.equal(calculateWordCount("Hello   world\n\nwith multiple   spaces"), 5);
  assert.equal(calculateWordCount(null), 0);
  assert.equal(calculateWordCount(undefined), 0);
});

test("calculateCharacterCount returns length of input string", () => {
  assert.equal(calculateCharacterCount(""), 0);
  assert.equal(calculateCharacterCount("abc"), 3);
  assert.equal(calculateCharacterCount("日本語テスト"), 6);
  assert.equal(calculateCharacterCount(null), 0);
});

test("calculateReadingTimeMinutes estimates standard reading speed (200 wpm)", () => {
  assert.equal(calculateReadingTimeMinutes(""), 0);
  assert.equal(calculateReadingTimeMinutes("One short sentence."), 1);
  const words250 = Array.from({ length: 250 }, () => "word").join(" ");
  assert.equal(calculateReadingTimeMinutes(words250), 2);
});

test("calculateParagraphCount counts blank-line separated blocks", () => {
  assert.equal(calculateParagraphCount(""), 0);
  assert.equal(calculateParagraphCount("Single paragraph"), 1);
  assert.equal(calculateParagraphCount("Para 1\n\nPara 2\n\nPara 3"), 3);
});

test("computeNoteStats bundles all stats deterministically", () => {
  const stats = computeNoteStats("Hello world.\n\nSecond paragraph with more words.");
  assert.equal(stats.words, 7);
  assert.equal(stats.paragraphs, 2);
  assert.equal(stats.readingTimeMinutes, 1);
  assert.equal(typeof stats.characters, "number");
});
