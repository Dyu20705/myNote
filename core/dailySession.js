import { getDueCards, commitReviewTransaction } from "./japaneseV2Storage.js";
import { schedule } from "./schedulerAdapter.js";

/**
 * Builds a curated daily session queue from due cards, respecting budgets and sibling burying rules.
 */
export async function buildSessionQueue(db, { now = new Date().toISOString(), maxNewCards = 20, maxReviews = 100 } = {}) {
  // Fetch up to 3x limit to allow for sibling exclusion.
  const poolLimit = (maxNewCards + maxReviews) * 3;
  const dueCards = await getDueCards(db, { now, limit: poolLimit });

  const learning = [];
  const reviews = [];
  const newCards = [];

  const seenItems = new Set();

  for (const item of dueCards) {
    const { card, reviewState } = item;
    
    if (seenItems.has(card.itemId)) {
      continue;
    }

    if (reviewState.state === 'learning' || reviewState.state === 'relearning') {
      learning.push(item);
      seenItems.add(card.itemId);
    } else if (reviewState.state === 'review') {
      if (reviews.length < maxReviews) {
        reviews.push(item);
        seenItems.add(card.itemId);
      }
    } else if (reviewState.state === 'new') {
      if (newCards.length < maxNewCards) {
        newCards.push(item);
        seenItems.add(card.itemId);
      }
    }
  }

  // Priority: learning -> reviews -> new
  return [...learning, ...reviews, ...newCards];
}

export class DailySession {
  constructor(db, queue) {
    this.db = db;
    this.queue = queue;
    this.currentIndex = 0;
    this.completedCount = 0;
  }

  hasMore() {
    return this.currentIndex < this.queue.length;
  }

  getNextCard() {
    if (!this.hasMore()) return null;
    return this.queue[this.currentIndex];
  }

  async submitGrade(grade, now = new Date().toISOString(), durationMs = 1000) {
    if (!this.hasMore()) {
      throw new Error("No more cards in session");
    }

    const item = this.queue[this.currentIndex];
    const { card, reviewState } = item;

    const input = { grade, reviewedAt: now, durationMs };
    const { nextState, log } = schedule(reviewState, input, now);
    
    await commitReviewTransaction(this.db, nextState, log);

    // If 'again' (grade is relearning) or state is still learning, and due is within today.
    // Wait, the scheduler adapter uses 0 days for 'again' making due = now.
    const dueMs = new Date(nextState.due).getTime();
    const nowMs = new Date(now).getTime();
    
    if (dueMs <= nowMs + 24 * 60 * 60 * 1000 && (nextState.state === 'learning' || nextState.state === 'relearning')) {
      this.queue.push({ card, reviewState: nextState });
    }

    this.currentIndex++;
    this.completedCount++;
    return { nextState, reviewLog: log };
  }
}
