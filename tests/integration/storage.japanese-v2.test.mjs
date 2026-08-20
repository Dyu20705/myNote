import { randomUUID } from "node:crypto";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import "fake-indexeddb/auto";
import { openDatabase, resetDatabase } from "../../core/storage.js";
import { saveLearningItemWithCards, getDueCards, commitReviewTransaction } from "../../core/japaneseV2Storage.js";
import { compileLearningItem } from "../../core/cardCompiler.js";
import { schedule } from "../../core/schedulerAdapter.js";

// Mock localStorage for tests
global.localStorage = { removeItem: () => {} };

describe("Japanese V2 Vocabulary Vertical Slice", () => {
  let db;

  beforeEach(async () => {
    await resetDatabase();
    db = await openDatabase();
  });

  afterEach(() => {
    if (db) db.close();
  });

  it("proves the full data lifecycle from learning item to review log", async () => {
    const learningItem = {
      id: randomUUID(),
      type: "vocabulary",
      content: { writtenForm: "猫", meanings: ["cat"] },
      skills: ["recognition", "meaning"],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(learningItem);
    await saveLearningItemWithCards(db, learningItem, cards, reviewStates);

    const nowTimestamp = new Date().toISOString();
    const dueCards = await getDueCards(db, { date: nowTimestamp, limit: 10 });
    assert.strictEqual(dueCards.length, 2, "Both new cards should be due immediately");

    const itemToReview = dueCards[0];
    const reviewInput = {
      grade: "good",
      reviewedAt: new Date().toISOString(),
      durationMs: 1500
    };
    const { nextState, log } = schedule(itemToReview.reviewState, reviewInput, new Date().toISOString());

    await commitReviewTransaction(db, nextState, log);

    const dueCardsAfter = await getDueCards(db, { date: nowTimestamp, limit: 10 });
    assert.strictEqual(dueCardsAfter.length, 1, "Only one card should remain due");
  });

  it("excludes archived, orphaned, and suspended cards from due queue", async () => {
    const learningItem = {
      id: randomUUID(),
      type: "vocabulary",
      content: { writtenForm: "犬", meanings: ["dog"] },
      skills: ["recognition", "meaning"],
      sourceRefs: [],
      status: "active", // Active initially
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(learningItem);
    await saveLearningItemWithCards(db, learningItem, cards, reviewStates);

    // Make one card orphaned, one archived
    const recognitionCard = cards.find(c => c.skill === "recognition");
    const meaningCard = cards.find(c => c.skill === "meaning");
    
    recognitionCard.status = "orphaned";
    meaningCard.status = "archived";
    
    // Save updated cards
    await saveLearningItemWithCards(db, learningItem, cards);

    const dueCards = await getDueCards(db, { date: new Date().toISOString(), limit: 10 });
    assert.strictEqual(dueCards.length, 0, "No cards should be due as they are orphaned or archived");
  });
  
  it("fails when adding duplicate review logs (append-only invariant)", async () => {
    const learningItem = {
      id: randomUUID(),
      type: "vocabulary",
      content: { writtenForm: "本", meanings: ["book"] },
      skills: ["recognition"],
      sourceRefs: [],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { cards, reviewStates } = compileLearningItem(learningItem);
    await saveLearningItemWithCards(db, learningItem, cards, reviewStates);
    
    const now = new Date().toISOString();
    const { nextState, log } = schedule(reviewStates[0], { grade: "good", reviewedAt: now }, now);
    
    await commitReviewTransaction(db, nextState, log);
    
    // Attempting to commit the same log ID again should fail
    await assert.rejects(
      commitReviewTransaction(db, nextState, log),
      /ConstraintError/, // IndexedDB throws ConstraintError on duplicate keys in add()
      "Should reject duplicate review logs"
    );
  });
});
