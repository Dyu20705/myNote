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
    
    const recognitionCard = cards.find(c => c.skill === "recognition");
    const formRecallCard = cards.find(c => c.skill === "form_recall");
    
    assert.ok(recognitionCard, "Must generate recognition card");
    assert.ok(formRecallCard, "Must generate form_recall card");
    
    await saveLearningItemWithCards(db, kanjiItem, cards, reviewStates);

    const dueCards = await getDueCards(db, { date: new Date().toISOString(), limit: 10 });
    assert.strictEqual(dueCards.length, 2, "Both cards should be available for review");
    
    // Check that we can identify the cards correctly from DB
    const dueRecognition = dueCards.find(d => d.card.skill === "recognition");
    assert.ok(dueRecognition, "DB returns recognition card");
    
    const dueFormRecall = dueCards.find(d => d.card.skill === "form_recall");
    assert.ok(dueFormRecall, "DB returns form_recall card");
  });
  
  it("isolates Kanji LearningItem from KanjiInkEntry #69 dependencies", async () => {
    // Tests that we don't strictly require an ink entry to compile or review kanji cards.
    // The ink entry remains just an authoring artifact.
    const kanjiItemWithoutInk = {
      id: randomUUID(),
      type: "kanji",
      content: {
        character: "字",
        primaryReading: "ジ",
        primaryWord: "文字",
        meaning: "Character, letter",
        // sourceInkId intentionally omitted
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
});
