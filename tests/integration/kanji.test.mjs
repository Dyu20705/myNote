import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import "fake-indexeddb/auto";
import { openDatabase, resetDatabase } from "../../core/storage.js";
import { saveLearningItemWithCards, getDueCards } from "../../core/japaneseV2Storage.js";
import { compileLearningItem } from "../../core/cardCompiler.js";

// Mock localStorage for tests
global.localStorage = { removeItem: () => {} };

describe("Japanese V2 Kanji Workflow", () => {
  let db;

  beforeEach(async () => {
    await resetDatabase();
    db = await openDatabase();
  });

  afterEach(() => {
    if (db) db.close();
  });

  it("creates a kanji item and compiles recognition and form_recall cards", async () => {
    const kanjiItem = {
      id: randomUUID(),
      type: "kanji",
      content: {
        character: "漢",
        primaryReading: "カン",
        primaryWord: "漢字",
        meaning: "Sino-, China",
        sourceInkId: "ink-123" // simulates relation to KanjiInkEntry
      },
      skills: ["recognition", "form_recall"],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(kanjiItem);
    assert.strictEqual(cards.length, 2, "Should generate two cards for the two skills");
    
    await saveLearningItemWithCards(db, kanjiItem, cards, reviewStates);

    const dueCards = await getDueCards(db, { date: new Date().toISOString(), limit: 10 });
    assert.strictEqual(dueCards.length, 2, "Both cards should be available for review");
  });
  
  it("isolates Kanji LearningItem from KanjiInkEntry #69 dependencies (missing sourceInkId)", async () => {
    const kanjiItemWithoutInk = {
      id: randomUUID(),
      type: "kanji",
      content: {
        character: "字",
        primaryReading: "ジ",
        primaryWord: "文字",
        meaning: "Character, letter",
      },
      skills: ["form_recall"],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(kanjiItemWithoutInk);
    assert.strictEqual(cards.length, 1);
    
    await saveLearningItemWithCards(db, kanjiItemWithoutInk, cards, reviewStates);
    const dueCards = await getDueCards(db, { date: new Date().toISOString(), limit: 10 });
    assert.strictEqual(dueCards.length, 1, "Can review kanji without source ink");
  });

  it("isolates Kanji LearningItem from KanjiInkEntry #69 dependencies (dangling sourceInkId)", async () => {
    const kanjiItemWithDanglingInk = {
      id: randomUUID(),
      type: "kanji",
      content: {
        character: "字",
        primaryReading: "ジ",
        primaryWord: "文字",
        meaning: "Character, letter",
        sourceInkId: "ink-deleted-456"
      },
      skills: ["form_recall"],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(kanjiItemWithDanglingInk);
    assert.strictEqual(cards.length, 1);
    
    await saveLearningItemWithCards(db, kanjiItemWithDanglingInk, cards, reviewStates);
    const dueCards = await getDueCards(db, { date: new Date().toISOString(), limit: 10 });
    assert.strictEqual(dueCards.length, 1, "Can review kanji even if sourceInkId refers to nonexistent/deleted ink");
  });

  it("rejects malformed Kanji items", () => {
    const baseItem = {
      id: randomUUID(),
      type: "kanji",
      content: { character: "漢", primaryReading: "カン", primaryWord: "漢字", meaning: "Sino-" },
      skills: ["recognition"],
      status: "active"
    };

    // Missing character
    assert.throws(() => compileLearningItem({ ...baseItem, content: { ...baseItem.content, character: "" } }), /missing character/);
    
    // Missing primaryReading
    assert.throws(() => compileLearningItem({ ...baseItem, content: { ...baseItem.content, primaryReading: undefined } }), /missing primaryReading/);

    // Missing primaryWord
    assert.throws(() => compileLearningItem({ ...baseItem, content: { ...baseItem.content, primaryWord: "" } }), /missing primaryWord/);

    // Missing meaning
    assert.throws(() => compileLearningItem({ ...baseItem, content: { ...baseItem.content, meaning: undefined } }), /missing meaning/);
  });

  it("rejects unsupported Kanji skills", () => {
    const item = {
      id: randomUUID(),
      type: "kanji",
      content: { character: "漢", primaryReading: "カン", primaryWord: "漢字", meaning: "Sino-" },
      skills: ["banana"],
      status: "active"
    };

    assert.throws(() => compileLearningItem(item), /Unsupported skill for Kanji item: banana/);
  });

  it("preserves existing Card and ReviewState identity when recompiling", async () => {
    const kanjiItem = {
      id: randomUUID(),
      type: "kanji",
      content: { character: "漢", primaryReading: "カン", primaryWord: "漢字", meaning: "Sino-" },
      skills: ["recognition", "form_recall"],
      status: "active"
    };

    const { cards, reviewStates } = compileLearningItem(kanjiItem);
    await saveLearningItemWithCards(db, kanjiItem, cards, reviewStates);

    const originalCardId = cards.find(c => c.skill === "recognition").id;
    const originalStateId = reviewStates.find(s => s.cardId === originalCardId).cardId;

    // Recompile with existing cards and states
    const { cards: newCards, reviewStates: newStates } = compileLearningItem(kanjiItem, cards, reviewStates);
    
    const recompiledCard = newCards.find(c => c.skill === "recognition");
    const recompiledState = newStates.find(s => s.cardId === originalCardId);

    assert.strictEqual(recompiledCard.id, originalCardId, "Card ID must be preserved");
    assert.strictEqual(recompiledState.cardId, originalStateId, "ReviewState cardId must be preserved");
  });

  it("orphans a card when its skill is removed from the learning item", async () => {
    const kanjiItem = {
      id: randomUUID(),
      type: "kanji",
      content: { character: "漢", primaryReading: "カン", primaryWord: "漢字", meaning: "Sino-" },
      skills: ["recognition", "form_recall"],
      status: "active"
    };

    const { cards, reviewStates } = compileLearningItem(kanjiItem);
    await saveLearningItemWithCards(db, kanjiItem, cards, reviewStates);

    // Remove form_recall skill
    const updatedItem = { ...kanjiItem, skills: ["recognition"] };
    
    const { cards: updatedCards, reviewStates: updatedStates } = compileLearningItem(updatedItem, cards, reviewStates);
    
    assert.strictEqual(updatedCards.length, 2, "Compiler should return 2 cards (one active, one orphaned)");
    const orphanedCard = updatedCards.find(c => c.skill === "form_recall");
    assert.strictEqual(orphanedCard.status, "orphaned", "Removed skill should cause card to be orphaned");
    
    await saveLearningItemWithCards(db, updatedItem, updatedCards, updatedStates);

    // Check due queue
    const dueCards = await getDueCards(db, { date: new Date().toISOString(), limit: 10 });
    assert.strictEqual(dueCards.length, 1, "Only the recognition card should be active and due");
  });
});
