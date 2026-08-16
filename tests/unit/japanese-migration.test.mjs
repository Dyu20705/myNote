import assert from "node:assert/strict";
import test from "node:test";
import { migrateV1ReviewToV2 } from "../../core/japaneseMigration.js";

const VALID_V1_NOTE = {
  id: "note-123",
  title: "食べる",
  content: "to eat",
  createdAt: "2026-08-16T12:00:00Z",
  updatedAt: "2026-08-16T12:00:00Z",
};

const VALID_V1_REVIEW = {
  noteId: "note-123",
  notebookType: "vocabulary",
  status: "learning",
  lastReviewedAt: "2026-08-16T12:00:00Z",
  nextReviewAt: "2026-08-16T12:05:00Z",
  interval: 0,
  ease: 2.5,
};

test("migrateV1ReviewToV2 ignores invalid note or review", () => {
  assert.deepEqual(migrateV1ReviewToV2(null, VALID_V1_REVIEW), { items: [], cards: [], logs: [] });
  assert.deepEqual(migrateV1ReviewToV2(VALID_V1_NOTE, null), { items: [], cards: [], logs: [] });
});

test("migrateV1ReviewToV2 ignores unsupported notebook types", () => {
  const review = { ...VALID_V1_REVIEW, notebookType: "planner" };
  assert.deepEqual(migrateV1ReviewToV2(VALID_V1_NOTE, review), { items: [], cards: [], logs: [] });
});

test("migrateV1ReviewToV2 returns deterministic item ID", () => {
  const result = migrateV1ReviewToV2(VALID_V1_NOTE, VALID_V1_REVIEW);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "item-note-123");
  assert.equal(result.items[0].noteId, "note-123");
});

test("migrateV1ReviewToV2 parses timestamps to numbers", () => {
  const result = migrateV1ReviewToV2(VALID_V1_NOTE, VALID_V1_REVIEW);
  const item = result.items[0];
  assert.equal(typeof item.createdAt, "number");
  assert.equal(typeof item.updatedAt, "number");
  assert.equal(item.createdAt, Date.parse(VALID_V1_NOTE.createdAt));
});

test("migrateV1ReviewToV2 duplicates SRS state to all cards", () => {
  const result = migrateV1ReviewToV2(VALID_V1_NOTE, VALID_V1_REVIEW);
  
  assert.equal(result.cards.length, 3);
  for (const card of result.cards) {
    assert.equal(card.status, VALID_V1_REVIEW.status);
    assert.equal(card.nextReviewAt, Date.parse(VALID_V1_REVIEW.nextReviewAt));
    assert.equal(card.interval, VALID_V1_REVIEW.interval);
    assert.equal(card.ease, VALID_V1_REVIEW.ease);
    assert.equal(card.lapses, 0);
  }
});

test("migrateV1ReviewToV2 maps kanji and vocabulary to 3 cards", () => {
  for (const type of ["kanji", "vocabulary"]) {
    const review = { ...VALID_V1_REVIEW, notebookType: type };
    const result = migrateV1ReviewToV2(VALID_V1_NOTE, review);
    
    const skills = result.cards.map((c) => c.skill).sort();
    assert.deepEqual(skills, ["meaning", "reading", "recognition"]);
  }
});

test("migrateV1ReviewToV2 maps grammar and sentence to 1 recognition card", () => {
  for (const type of ["grammar", "sentence"]) {
    const review = { ...VALID_V1_REVIEW, notebookType: type };
    const result = migrateV1ReviewToV2(VALID_V1_NOTE, review);
    
    assert.equal(result.cards.length, 1);
    assert.equal(result.cards[0].skill, "recognition");
  }
});

test("migrateV1ReviewToV2 maps output to 1 form-recall card", () => {
  const review = { ...VALID_V1_REVIEW, notebookType: "output" };
  const result = migrateV1ReviewToV2(VALID_V1_NOTE, review);
  
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].skill, "form-recall");
});

test("migrateV1ReviewToV2 validates outputs using schema validators", () => {
  const result = migrateV1ReviewToV2(VALID_V1_NOTE, VALID_V1_REVIEW);
  // If the schema validators throw, this test will fail.
  // The fact it returns successfully implies validation passed.
  assert.equal(result.items.length > 0, true);
  assert.equal(result.cards.length > 0, true);
});
