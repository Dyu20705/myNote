import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { openDatabase, resetDatabase } from "../../core/storage.js";
import { saveLearningItemWithCards } from "../../core/japaneseV2Storage.js";
import { buildSessionQueue, DailySession } from "../../core/dailySession.js";

global.localStorage = { removeItem: () => {} };

function makeCard(itemId, id = randomUUID()) {
  return { id, itemId, skill: "recognition", status: "active", format: "recognition", front: "F", back: "B", createdAt: new Date().toISOString() };
}

function makeState(cardId, state, due) {
  return { cardId, state, due, reps: 0, lapses: 0, elapsedDays: 0, scheduledDays: 0, difficulty: 5, stability: 2, lastReviewAt: null, scheduler: "legacy-sm2", schedulerVersion: "1.0", updatedAt: new Date().toISOString() };
}

test("Daily Session API Contract", async (t) => {
  await t.test("Queue Construction & Priority (learning > overdue > due > new, tie-break by dueAt/cardId)", async () => {
    await resetDatabase();
    const db = await openDatabase();
    const date = new Date("2026-08-20T12:00:00.000Z").toISOString();
    
    // Create items to prove ordering
    const cOverdue = makeCard(randomUUID(), "C_OVERDUE");
    const sOverdue = makeState(cOverdue.id, "review", new Date("2026-08-19T00:00:00.000Z").toISOString());
    
    const cDue1 = makeCard(randomUUID(), "C_DUE_1");
    const sDue1 = makeState(cDue1.id, "review", new Date("2026-08-20T12:00:00.000Z").toISOString());
    
    const cDue2 = makeCard(randomUUID(), "C_DUE_2");
    const sDue2 = makeState(cDue2.id, "review", new Date("2026-08-20T12:00:00.000Z").toISOString());

    const cLearning = makeCard(randomUUID(), "C_LEARNING");
    const sLearning = makeState(cLearning.id, "learning", new Date("2026-08-20T11:00:00.000Z").toISOString());

    const cNew = makeCard(randomUUID(), "C_NEW");
    const sNew = makeState(cNew.id, "new", new Date("2026-08-20T00:00:00.000Z").toISOString());

    await saveLearningItemWithCards(db, { id: cOverdue.itemId }, [cOverdue], [sOverdue]);
    await saveLearningItemWithCards(db, { id: cDue1.itemId }, [cDue1], [sDue1]);
    await saveLearningItemWithCards(db, { id: cDue2.itemId }, [cDue2], [sDue2]);
    await saveLearningItemWithCards(db, { id: cLearning.itemId }, [cLearning], [sLearning]);
    await saveLearningItemWithCards(db, { id: cNew.itemId }, [cNew], [sNew]);

    const result = await buildSessionQueue(db, { date, maxNewCards: 10, maxReviews: 10 });
    const queue = result.activeQueue;
    
    assert.equal(queue.length, 5);
    
    assert.equal(queue[0].card.id, cLearning.id);
    assert.equal(queue[1].card.id, cOverdue.id);
    
    const sortedDue = [cDue1.id, cDue2.id].sort();
    assert.equal(queue[2].card.id, sortedDue[0]);
    assert.equal(queue[3].card.id, sortedDue[1]);
    
    assert.equal(queue[4].card.id, cNew.id);

    db.close();
  });

  await t.test("Limits and Budgeting", async () => {
    await resetDatabase();
    const db = await openDatabase();
    const date = new Date("2026-08-20T12:00:00.000Z").toISOString();

    const cNew1 = makeCard(randomUUID());
    const cNew2 = makeCard(randomUUID());
    const cRev1 = makeCard(randomUUID());
    const cRev2 = makeCard(randomUUID());

    await saveLearningItemWithCards(db, { id: cNew1.itemId }, [cNew1], [makeState(cNew1.id, "new", date)]);
    await saveLearningItemWithCards(db, { id: cNew2.itemId }, [cNew2], [makeState(cNew2.id, "new", date)]);
    await saveLearningItemWithCards(db, { id: cRev1.itemId }, [cRev1], [makeState(cRev1.id, "review", date)]);
    await saveLearningItemWithCards(db, { id: cRev2.itemId }, [cRev2], [makeState(cRev2.id, "review", date)]);

    // 0 limits
    const res0 = await buildSessionQueue(db, { date, maxNewCards: 0, maxReviews: 0 });
    assert.equal(res0.activeQueue.length, 0);

    // new cards don't consume review budget
    const res1 = await buildSessionQueue(db, { date, maxNewCards: 2, maxReviews: 1 });
    assert.equal(res1.activeQueue.length, 3);
    assert.equal(res1.activeQueue.filter(x => x.reviewState.state === 'new').length, 2);
    assert.equal(res1.activeQueue.filter(x => x.reviewState.state === 'review').length, 1);
    
    db.close();
  });

  await t.test("Sibling Burying", async () => {
    await resetDatabase();
    const db = await openDatabase();
    const date = new Date("2026-08-20T12:00:00.000Z").toISOString();

    const itemId = randomUUID();
    const c1 = makeCard(itemId); c1.skill = "reading";
    const c2 = makeCard(itemId); c2.skill = "writing";
    const c3 = makeCard(itemId); c3.skill = "listening";

    await saveLearningItemWithCards(db, { id: itemId }, [c1, c2, c3], [
      makeState(c1.id, "new", date),
      makeState(c2.id, "learning", date),
      makeState(c3.id, "review", new Date("2026-08-10T00:00:00.000Z").toISOString())
    ]);

    const res = await buildSessionQueue(db, { date, maxNewCards: 10, maxReviews: 1 });
    assert.equal(res.activeQueue.length, 1);
    assert.equal(res.activeQueue[0].card.id, c2.id);
    
    assert.equal(res.buriedCards.length, 2);
    
    db.close();
  });

  await t.test("Grade Submission API & Edge Cases", async () => {
    await resetDatabase();
    const db = await openDatabase();
    const date = new Date("2026-08-20T12:00:00.000Z").toISOString();

    const c1 = makeCard(randomUUID());
    const c2 = makeCard(randomUUID());
    await saveLearningItemWithCards(db, { id: c1.itemId }, [c1], [makeState(c1.id, "new", date)]);
    await saveLearningItemWithCards(db, { id: c2.itemId }, [c2], [makeState(c2.id, "review", date)]);

    const queueResult = await buildSessionQueue(db, { date, maxNewCards: 10, maxReviews: 10 });
    const session = new DailySession(db, {}, queueResult);

    assert.equal(session.remaining, 2);
    assert.equal(session.isComplete, false);
    
    await assert.rejects(
      async () => await session.submitGrade(randomUUID(), "good", date),
      { message: /Invalid submission/ }
    );

    const firstCardId = session.currentCard.card.id;
    
    await session.submitGrade(firstCardId, "again", date);
    
    assert.equal(session.completedCards.length, 1);
    assert.equal(session.remaining, 2);
    
    const secondCardId = session.currentCard.card.id;
    assert.notEqual(secondCardId, firstCardId);
    
    await session.submitGrade(secondCardId, "good", date);
    assert.equal(session.completedCards.length, 2);
    assert.equal(session.remaining, 1);
    
    const reappendedCardId = session.currentCard.card.id;
    assert.equal(reappendedCardId, firstCardId);
    
    await session.submitGrade(reappendedCardId, "good", date);
    assert.equal(session.remaining, 0);
    assert.equal(session.isComplete, true);
    assert.equal(session.currentCard, null);

    db.close();
  });
});
