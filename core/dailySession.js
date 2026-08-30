import { getDueCards, commitReviewTransaction } from "./japaneseV2Storage.js";
import { schedule } from "./schedulerAdapter.js";

/**
 * Builds a curated daily session queue from due cards, respecting budgets and sibling burying rules.
 */
export async function buildSessionQueue(db, { date = new Date().toISOString(), maxNewCards = 20, maxReviews = 100 } = {}) {
  const poolLimit = (maxNewCards + maxReviews) * 5;
  const eligibleItems = await getDueCards(db, { date, limit: poolLimit });

  const getRank = (reviewState) => {
    if (reviewState.state === 'learning' || reviewState.state === 'relearning') return 1;
    if (reviewState.state === 'review') {
      return reviewState.due < date ? 2 : 3;
    }
    if (reviewState.state === 'new') return 4;
    return 5;
  };

  eligibleItems.sort((a, b) => {
    const rankA = getRank(a.reviewState);
    const rankB = getRank(b.reviewState);
    if (rankA !== rankB) return rankA - rankB;

    if (a.reviewState.due < b.reviewState.due) return -1;
    if (a.reviewState.due > b.reviewState.due) return 1;

    if (a.card.id < b.card.id) return -1;
    if (a.card.id > b.card.id) return 1;
    return 0;
  });

  const activeQueue = [];
  const buriedCards = [];
  
  let reviewCount = 0;
  let newCount = 0;
  const seenItems = new Set();

  for (const item of eligibleItems) {
    const { card, reviewState } = item;
    
    if (seenItems.has(card.itemId)) {
      buriedCards.push(item);
      continue;
    }

    const isNew = reviewState.state === 'new';
    if (isNew) {
      if (newCount >= maxNewCards) continue;
    } else {
      if (reviewCount >= maxReviews) continue;
    }

    seenItems.add(card.itemId);
    activeQueue.push(item);

    if (isNew) {
      newCount++;
    } else {
      reviewCount++;
    }
  }

  return { activeQueue, buriedCards };
}

export class DailySession {
  constructor(db, config, queueResult) {
    this.db = db;
    this.config = config;
    this.pendingCards = queueResult.activeQueue;
    this.buriedCards = queueResult.buriedCards;
    this.completedCards = [];
  }

  get currentCard() {
    return this.pendingCards.length > 0 ? this.pendingCards[0] : null;
  }

  get remaining() {
    return this.pendingCards.length;
  }

  get isComplete() {
    return this.pendingCards.length === 0;
  }

  async submitGrade(cardId, grade, now = new Date().toISOString(), durationMs = 1000) {
    if (!this.currentCard || this.currentCard.card.id !== cardId) {
      throw new Error(`Invalid submission: cardId ${cardId} is not the current pending card`);
    }

    const item = this.pendingCards[0];
    const { card, reviewState } = item;

    const input = { grade, reviewedAt: now, durationMs };
    const { nextState, log } = schedule(reviewState, input, now);
    
    const isNewItem = reviewState.state === 'new';
    await commitReviewTransaction(this.db, nextState, log, isNewItem);

    this.pendingCards.shift();
    this.completedCards.push({ card, reviewState: nextState, log });

    const isRelearning = nextState.state === 'learning' || nextState.state === 'relearning';
    if (isRelearning && nextState.due <= now) {
      this.pendingCards.push({ card, reviewState: nextState });
    }

    return { nextState, reviewLog: log };
  }
}
