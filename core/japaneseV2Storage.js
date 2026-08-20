import {
  STORE_LEARNING_ITEMS,
  STORE_CARDS,
  STORE_REVIEW_STATES,
  STORE_REVIEW_LOGS
} from "./storage.js";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    let firstRequestError;
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => {
      const requestError = event.target?.error || transaction.error;
      if (requestError?.name !== "AbortError") firstRequestError ||= requestError;
    };
    transaction.onabort = () => {
      reject(firstRequestError || new DOMException("Transaction aborted", "AbortError"));
    };
  });
}

export async function saveLearningItemWithCards(db, learningItem, cards, reviewStates) {
  // Enforce referential integrity
  for (const card of cards) {
    if (card.itemId !== learningItem.id) {
      throw new Error(`Referential integrity failed: Card ${card.id} does not belong to item ${learningItem.id}`);
    }
  }
  if (reviewStates) {
    const cardIds = new Set(cards.map(c => c.id));
    for (const state of reviewStates) {
      if (!cardIds.has(state.cardId)) {
        throw new Error(`Referential integrity failed: ReviewState cardId ${state.cardId} not found in provided cards`);
      }
    }
  }

  const tx = db.transaction([STORE_LEARNING_ITEMS, STORE_CARDS, STORE_REVIEW_STATES], "readwrite");
  const done = transactionDone(tx);

  tx.objectStore(STORE_LEARNING_ITEMS).put(learningItem);
  
  const cardStore = tx.objectStore(STORE_CARDS);
  for (const card of cards) {
    cardStore.put(card);
  }

  if (reviewStates) {
    const stateStore = tx.objectStore(STORE_REVIEW_STATES);
    for (const state of reviewStates) {
      stateStore.put(state);
    }
  }

  await done;
}

export async function getLearningItem(db, id) {
  const tx = db.transaction(STORE_LEARNING_ITEMS, "readonly");
  return await requestResult(tx.objectStore(STORE_LEARNING_ITEMS).get(id));
}

export async function getCardsForItem(db, itemId) {
  const tx = db.transaction(STORE_CARDS, "readonly");
  const index = tx.objectStore(STORE_CARDS).index("itemId");
  return await requestResult(index.getAll(itemId));
}

export async function getCardById(db, cardId) {
  const tx = db.transaction(STORE_CARDS, "readonly");
  return await requestResult(tx.objectStore(STORE_CARDS).get(cardId));
}

/**
 * Returns due cards wrapped with their review states.
 * Enforces workload semantics by filtering strictly for active cards
 * before applying the workload limit.
 */
export async function getDueCards(db, { date, limit = 50 }) {
  const tx = db.transaction([STORE_REVIEW_STATES, STORE_CARDS], "readonly");
  const stateStore = tx.objectStore(STORE_REVIEW_STATES);
  const cardStore = tx.objectStore(STORE_CARDS);
  
  const dueIndex = stateStore.index("due");
  const range = globalThis.IDBKeyRange.upperBound(date || new Date().toISOString());
  
  const dueCards = [];
  
  // We use a cursor to lazily fetch states, join the Card, and check status
  // so we only count against `limit` when the card is genuinely active.
  return new Promise((resolve, reject) => {
    const request = dueIndex.openCursor(range);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(dueCards);
        return;
      }
      
      const reviewState = cursor.value;
      const cardReq = cardStore.get(reviewState.cardId);
      
      cardReq.onsuccess = () => {
        const card = cardReq.result;
        // Strict boundary: Only active cards may enter review queue
        if (card && card.status === "active") {
          dueCards.push({ card, reviewState });
        }
        
        if (dueCards.length >= limit) {
          resolve(dueCards);
        } else {
          cursor.continue();
        }
      };
      cardReq.onerror = () => reject(cardReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function commitReviewTransaction(db, nextState, reviewLog) {
  if (nextState.cardId !== reviewLog.cardId) {
    throw new Error(`Referential integrity failed: ReviewLog cardId ${reviewLog.cardId} mismatch with state cardId ${nextState.cardId}`);
  }

  const tx = db.transaction([STORE_REVIEW_STATES, STORE_REVIEW_LOGS], "readwrite");
  const done = transactionDone(tx);

  tx.objectStore(STORE_REVIEW_STATES).put(nextState);
  
  // Enforce append-only invariant. Duplicate log ID will fail the transaction.
  tx.objectStore(STORE_REVIEW_LOGS).add(reviewLog);

  await done;
}
