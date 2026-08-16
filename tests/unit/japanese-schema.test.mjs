import assert from "node:assert/strict";
import test from "node:test";
import {
  JAPANESE_ITEM_TYPES,
  JAPANESE_CARD_SKILLS,
  JAPANESE_CARD_STATUSES,
  JAPANESE_REVIEW_RATINGS,
  validateJapaneseItem,
  validateJapaneseCard,
  validateJapaneseReviewLog,
} from "../../core/japaneseSchema.js";

const VALID_ITEM = Object.freeze({
  id: "item-1",
  noteId: "note-1",
  type: "kanji",
  target: "食べる",
  reading: "たべる",
  meaning: "to eat",
  createdAt: 1723813200000,
  updatedAt: 1723813200000,
});

const VALID_CARD = Object.freeze({
  id: "card-1",
  itemId: "item-1",
  skill: "recognition",
  status: "new",
  nextReviewAt: 1723813200000,
  interval: 0,
  ease: 2.5,
  lapses: 0,
});

const VALID_REVIEW_LOG = Object.freeze({
  id: "log-1",
  cardId: "card-1",
  rating: "good",
  reviewedAt: 1723813200000,
  responseTimeMs: 1500,
  previousStatus: "new",
  previousInterval: 0,
  previousEase: 2.5,
  previousNextReviewAt: 1723813200000,
});

test("japanese schema enums expose the persistence contract", () => {
  assert.deepEqual(JAPANESE_ITEM_TYPES, ["kanji", "vocabulary", "grammar", "output", "sentence"]);
  assert.deepEqual(JAPANESE_CARD_SKILLS, ["recognition", "meaning", "reading", "form-recall"]);
  assert.deepEqual(JAPANESE_CARD_STATUSES, ["new", "learning", "review", "suspended"]);
  assert.deepEqual(JAPANESE_REVIEW_RATINGS, ["again", "hard", "good", "easy"]);
  assert.equal(Object.isFrozen(JAPANESE_ITEM_TYPES), true);
  assert.equal(Object.isFrozen(JAPANESE_CARD_SKILLS), true);
  assert.equal(Object.isFrozen(JAPANESE_CARD_STATUSES), true);
  assert.equal(Object.isFrozen(JAPANESE_REVIEW_RATINGS), true);
});

test("validateJapaneseItem returns an exact defensive copy", () => {
  const input = { ...VALID_ITEM, ignored: "not persisted" };
  const result = validateJapaneseItem(input);

  assert.deepEqual(result, VALID_ITEM);
  assert.notEqual(result, input);
});

test("validateJapaneseItem allows optional reading and meaning", () => {
  const input = { ...VALID_ITEM };
  delete input.reading;
  delete input.meaning;
  
  const result = validateJapaneseItem(input);
  assert.equal(result.reading, undefined);
  assert.equal(result.meaning, undefined);
});

test("validateJapaneseCard returns an exact defensive copy", () => {
  const input = { ...VALID_CARD, ignored: "not persisted" };
  const result = validateJapaneseCard(input);

  assert.deepEqual(result, VALID_CARD);
  assert.notEqual(result, input);
});

test("validateJapaneseReviewLog returns an exact defensive copy", () => {
  const input = { ...VALID_REVIEW_LOG, ignored: "not persisted" };
  const result = validateJapaneseReviewLog(input);

  assert.deepEqual(result, VALID_REVIEW_LOG);
  assert.notEqual(result, input);
});

test("validateJapaneseItem rejects invalid records", () => {
  const cases = [
    ["null", null],
    ["non-object", "item"],
    ["missing id", { ...VALID_ITEM, id: undefined }],
    ["missing noteId", { ...VALID_ITEM, noteId: undefined }],
    ["invalid type", { ...VALID_ITEM, type: "reading" }],
    ["missing target", { ...VALID_ITEM, target: undefined }],
    ["non-string target", { ...VALID_ITEM, target: 42 }],
    ["non-number createdAt", { ...VALID_ITEM, createdAt: "2026-08-16" }],
  ];

  for (const [label, item] of cases) {
    assert.throws(
      () => validateJapaneseItem(item),
      (error) => {
        assert.equal(error.name, "TypeError", label);
        assert.equal(error.code, "INVALID_JAPANESE_SCHEMA", label);
        return true;
      },
      label
    );
  }
});

test("validateJapaneseCard rejects invalid records", () => {
  const cases = [
    ["invalid skill", { ...VALID_CARD, skill: "writing" }],
    ["invalid status", { ...VALID_CARD, status: "graduated" }],
    ["non-number interval", { ...VALID_CARD, interval: "1" }],
    ["negative interval", { ...VALID_CARD, interval: -1 }],
    ["ease below minimum", { ...VALID_CARD, ease: 1.29 }],
  ];

  for (const [label, card] of cases) {
    assert.throws(
      () => validateJapaneseCard(card),
      (error) => {
        assert.equal(error.name, "TypeError", label);
        assert.equal(error.code, "INVALID_JAPANESE_SCHEMA", label);
        return true;
      },
      label
    );
  }
});

test("validateJapaneseReviewLog rejects invalid records", () => {
  const cases = [
    ["invalid rating", { ...VALID_REVIEW_LOG, rating: "ok" }],
    ["non-number reviewedAt", { ...VALID_REVIEW_LOG, reviewedAt: "2026-08-16" }],
    ["negative responseTimeMs", { ...VALID_REVIEW_LOG, responseTimeMs: -100 }],
    ["invalid previousStatus", { ...VALID_REVIEW_LOG, previousStatus: "graduated" }],
  ];

  for (const [label, log] of cases) {
    assert.throws(
      () => validateJapaneseReviewLog(log),
      (error) => {
        assert.equal(error.name, "TypeError", label);
        assert.equal(error.code, "INVALID_JAPANESE_SCHEMA", label);
        return true;
      },
      label
    );
  }
});
