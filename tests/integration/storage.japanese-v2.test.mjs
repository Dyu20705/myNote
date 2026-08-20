import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import "fake-indexeddb/auto";
import { openDatabase, resetDatabase } from "../../core/storage.js";
import { saveLearningItemWithCards, getDueReviewStates, commitReviewTransaction, getCardsForItem } from "../../core/japaneseV2Storage.js";
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
    // 1. Create a Vocabulary LearningItem
    const learningItem = {
      id: crypto.randomUUID(),
      type: "vocabulary",
      content: { writtenForm: "猫", meanings: ["cat"] },
      skills: ["recognition", "meaning"],
      sourceRefs: [{ type: "note", id: crypto.randomUUID() }],
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 2. Compile into Cards and ReviewStates
    const { cards, reviewStates } = compileLearningItem(learningItem);
    assert.strictEqual(cards.length, 2, "Compiler should generate 2 cards");
    assert.strictEqual(reviewStates.length, 2, "Compiler should generate 2 initial states");

    // 3. Persist to IndexedDB
    await saveLearningItemWithCards(db, learningItem, cards, reviewStates);

    const savedCards = await getCardsForItem(db, learningItem.id);
    assert.strictEqual(savedCards.length, 2, "Cards were successfully saved to DB");

    // 4. Query due cards
    const nowTimestamp = new Date().toISOString();
    const dueStates = await getDueReviewStates(db, nowTimestamp, 10);
    assert.strictEqual(dueStates.length, 2, "Both new cards should be due immediately");

    // 5. Review a card
    const stateToReview = dueStates[0];
    const reviewInput = {
      grade: "good",
      reviewedAt: new Date().toISOString(),
      durationMs: 1500
    };
    const { nextState, log } = schedule(stateToReview, reviewInput, new Date().toISOString());

    // 6. Commit the review transaction
    await commitReviewTransaction(db, nextState, log);

    // 7. Verify the card is no longer due right now
    const dueStatesAfter = await getDueReviewStates(db, nowTimestamp, 10);
    assert.strictEqual(dueStatesAfter.length, 1, "Only one card should remain due");

    // Verify ReviewLog integrity
    assert.strictEqual(log.stateBefore, "new");
    assert.strictEqual(log.stateAfter, "review");
    assert.ok(log.nextStateSnapshot, "Should have nextStateSnapshot");
    assert.strictEqual(log.nextStateSnapshot.state, "review");
  });
});
