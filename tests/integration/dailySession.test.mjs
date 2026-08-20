import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { openDatabase, resetDatabase } from "../../core/storage.js";
import { saveLearningItemWithCards } from "../../core/japaneseV2Storage.js";
import { buildSessionQueue, DailySession } from "../../core/dailySession.js";

// Mock localStorage for tests
global.localStorage = { removeItem: () => {} };

function makeCard(itemId, skill) {
  return {
    id: randomUUID(),
    itemId,
    skill,
    status: "active",
    format: "recognition",
    front: "Front",
    back: "Back",
    createdAt: new Date().toISOString()
  };
}

function makeState(cardId, state, due) {
  return {
    cardId,
    state,
    due,
    reps: 0,
    lapses: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    difficulty: 5,
    stability: 2,
    lastReviewAt: null,
    scheduler: "legacy-sm2",
    schedulerVersion: "1.0",
    updatedAt: new Date().toISOString()
  };
}

test("Daily Session and Scheduler Integration", async (t) => {

  await t.test("builds queue prioritizing learning -> review -> new, respecting limits and sibling burying", async () => {
    await resetDatabase();
    const db = await openDatabase();
    const now = new Date("2026-08-20T00:00:00Z").toISOString();
    
    // Item 1: Two cards (siblings). One learning, one new.
    const item1 = { id: randomUUID(), type: "vocabulary", data: { term: "A" } };
    const card1a = makeCard(item1.id, "recognition");
    const card1b = makeCard(item1.id, "production");
    const state1a = makeState(card1a.id, "learning", "2026-08-19T00:00:00Z");
    const state1b = makeState(card1b.id, "new", "2026-08-19T00:00:00Z");
    await saveLearningItemWithCards(db, item1, [card1a, card1b], [state1a, state1b]);

    // Item 2: Three cards. All reviews, all due.
    const item2 = { id: randomUUID(), type: "vocabulary", data: { term: "B" } };
    const card2a = makeCard(item2.id, "recognition");
    const card2b = makeCard(item2.id, "production");
    const card2c = makeCard(item2.id, "listening");
    const state2a = makeState(card2a.id, "review", "2026-08-19T00:00:00Z");
    const state2b = makeState(card2b.id, "review", "2026-08-19T00:00:00Z");
    const state2c = makeState(card2c.id, "review", "2026-08-19T00:00:00Z");
    await saveLearningItemWithCards(db, item2, [card2a, card2b, card2c], [state2a, state2b, state2c]);

    // Item 3: New cards.
    const item3 = { id: randomUUID(), type: "vocabulary", data: { term: "C" } };
    const card3a = makeCard(item3.id, "recognition");
    const state3a = makeState(card3a.id, "new", "2026-08-19T00:00:00Z");
    await saveLearningItemWithCards(db, item3, [card3a], [state3a]);

    const queue = await buildSessionQueue(db, { now, maxNewCards: 1, maxReviews: 100 });
    
    // Expectations:
    // 1. learning card1a is picked. card1b is buried.
    // 2. review card2a is picked. card2b, card2c are buried.
    // 3. new card3a is picked. (budget is 1)
    
    assert.equal(queue.length, 3);
    assert.equal(queue[0].reviewState.state, "learning");
    assert.equal(queue[0].card.id, card1a.id);
    
    assert.equal(queue[1].reviewState.state, "review");
    assert.equal(queue[1].card.itemId, item2.id); // Exactly one card from item2
    
    assert.equal(queue[2].reviewState.state, "new");
    assert.equal(queue[2].card.id, card3a.id);

    db.close();
  });

  await t.test("DailySession API progresses through queue and appends relearning cards", async () => {
    await resetDatabase();
    const db2 = await openDatabase();

    const now = new Date("2026-08-20T00:00:00Z").toISOString();
    const item = { id: randomUUID(), type: "vocabulary", data: { term: "A" } };
    const card = makeCard(item.id, "recognition");
    const state = makeState(card.id, "new", "2026-08-19T00:00:00Z");
    await saveLearningItemWithCards(db2, item, [card], [state]);

    const queue = await buildSessionQueue(db2, { now, maxNewCards: 10, maxReviews: 10 });
    assert.equal(queue.length, 1);

    const session = new DailySession(db2, queue);
    assert.ok(session.hasMore());

    const currentCard = session.getNextCard();
    assert.equal(currentCard.card.id, card.id);

    // Fail the card -> should transition to relearning and re-append to queue
    await session.submitGrade("again", now);
    
    // Now there should be one more card in the session
    assert.ok(session.hasMore());
    assert.equal(session.queue.length, 2);
    
    const nextItem = session.getNextCard();
    assert.equal(nextItem.reviewState.state, "relearning");

    // Pass it this time
    await session.submitGrade("good", now);
    assert.equal(session.hasMore(), false);

    db2.close();
  });
});
