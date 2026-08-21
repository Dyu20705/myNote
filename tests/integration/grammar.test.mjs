import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import "fake-indexeddb/auto";
import { openDatabase, resetDatabase } from "../../core/storage.js";
import { saveLearningItemWithCards } from "../../core/japaneseV2Storage.js";
import { compileLearningItem } from "../../core/cardCompiler.js";

// Mock localStorage for tests
global.localStorage = { removeItem: () => {} };

describe("Japanese V2 Grammar Workflow", () => {
  let db;

  beforeEach(async () => {
    resetDatabase();
    db = await openDatabase();
  });

  afterEach(() => {
    if (db) db.close();
  });

  it("creates a grammar item and compiles recognition and meaning cards", async () => {
    const grammarItem = {
      id: randomUUID(),
      type: "grammar",
      content: {
        pattern: "〜ている",
        meaning: ["is doing", "has done and state continues"],
        contexts: ["Used for continuous action or resultant state"]
      },
      skills: ["recognition", "meaning"],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(grammarItem);

    assert.strictEqual(cards.length, 2, "Should compile exactly two cards");
    const skills = cards.map(c => c.skill).sort();
    assert.deepEqual(skills, ["meaning", "recognition"], "Should contain recognition and meaning skills");
    
    assert.strictEqual(reviewStates.length, 2, "Should compile two review states");
    for (const card of cards) {
      assert.strictEqual(card.itemId, grammarItem.id);
      assert.strictEqual(card.status, "active");
      const state = reviewStates.find(s => s.cardId === card.id);
      assert.ok(state, "Card should have a review state");
      assert.strictEqual(state.state, "new");
    }

    await saveLearningItemWithCards(db, grammarItem, cards, reviewStates);
  });

  it("allows a zero-skill Grammar item and compiles zero cards", async () => {
    const grammarItem = {
      id: randomUUID(),
      type: "grammar",
      content: {
        pattern: "〜てもいい",
        meaning: ["may I...", "it is okay to..."],
        contexts: []
      },
      skills: [],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(grammarItem);
    assert.strictEqual(cards.length, 0, "Zero skills should yield zero cards");
    assert.strictEqual(reviewStates.length, 0, "Zero skills should yield zero review states");
    
    await saveLearningItemWithCards(db, grammarItem, cards, reviewStates);
  });

  it("rejects malformed Grammar items", () => {
    const valid = {
      id: randomUUID(),
      type: "grammar",
      content: {
        pattern: "〜",
        meaning: ["..."],
        contexts: []
      },
      skills: ["recognition"]
    };

    const missingPattern = JSON.parse(JSON.stringify(valid));
    delete missingPattern.content.pattern;
    assert.throws(() => compileLearningItem(missingPattern), /missing pattern/);

    const missingMeaning = JSON.parse(JSON.stringify(valid));
    delete missingMeaning.content.meaning;
    assert.throws(() => compileLearningItem(missingMeaning), /missing meaning/);

    const invalidMeaning = JSON.parse(JSON.stringify(valid));
    invalidMeaning.content.meaning = "not an array";
    assert.throws(() => compileLearningItem(invalidMeaning), /missing meaning/);

    const missingContexts = JSON.parse(JSON.stringify(valid));
    delete missingContexts.content.contexts;
    assert.throws(() => compileLearningItem(missingContexts), /missing contexts/);

    const invalidContexts = JSON.parse(JSON.stringify(valid));
    invalidContexts.content.contexts = "not an array";
    assert.throws(() => compileLearningItem(invalidContexts), /missing contexts/);
  });

  it("rejects unsupported Grammar skills", () => {
    const item = {
      id: randomUUID(),
      type: "grammar",
      content: {
        pattern: "〜",
        meaning: ["..."],
        contexts: []
      },
      skills: ["recognition", "form_recall"] // form_recall is not supported for grammar
    };
    
    assert.throws(() => compileLearningItem(item), /Unsupported skill/);
  });

  it("preserves existing Card and ReviewState identity when recompiling", async () => {
    const grammarItem = {
      id: randomUUID(),
      type: "grammar",
      content: {
        pattern: "〜",
        meaning: ["..."],
        contexts: []
      },
      skills: ["recognition"],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const firstCompile = compileLearningItem(grammarItem);
    const existingCards = firstCompile.cards;
    const existingStates = firstCompile.reviewStates;

    const secondCompile = compileLearningItem(grammarItem, existingCards, existingStates);
    
    assert.strictEqual(secondCompile.cards.length, 1);
    assert.strictEqual(secondCompile.reviewStates.length, 1);
    assert.strictEqual(secondCompile.cards[0].id, existingCards[0].id);
    assert.strictEqual(secondCompile.reviewStates[0].cardId, existingStates[0].cardId);
  });

  it("orphans a card when its skill is removed from the learning item", async () => {
    const grammarItem = {
      id: randomUUID(),
      type: "grammar",
      content: {
        pattern: "〜",
        meaning: ["..."],
        contexts: []
      },
      skills: ["recognition", "meaning"],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const firstCompile = compileLearningItem(grammarItem);
    
    // Now remove meaning skill
    const updatedItem = {
      ...grammarItem,
      skills: ["recognition"]
    };

    const secondCompile = compileLearningItem(updatedItem, firstCompile.cards, firstCompile.reviewStates);
    
    assert.strictEqual(secondCompile.cards.length, 2, "Should preserve the orphaned card");
    
    const recCard = secondCompile.cards.find(c => c.skill === "recognition");
    const meaningCard = secondCompile.cards.find(c => c.skill === "meaning");
    
    assert.strictEqual(recCard.status, "active");
    assert.strictEqual(meaningCard.status, "orphaned");
  });
});
