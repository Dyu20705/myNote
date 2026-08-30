import { validateKanjiLearningItem, validateVocabularyLearningItem, validateGrammarLearningItem } from "./japaneseLearningItem.js";
import {
  STORE_LEARNING_ITEMS,
  STORE_CARDS,
  STORE_REVIEW_STATES,
  STORE_REVIEW_LOGS,
  STORE_STUDY_REVIEWS,
  STORE_STUDY_ARTIFACTS,
  STORE_SETTINGS
} from "./storage.js";
import { updateGamificationState } from "./gamificationEngine.js";
import { updateDailyGoalsState } from "./dailyGoals.js";

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


export function validateLearningItem(item) {
  if (!item || !item.id) {
    throw new Error("Invalid learning item: missing id");
  }
  
  if (item.type === "kanji") {
    return validateKanjiLearningItem(item);
  } else if (item.type === "vocabulary") {
    return validateVocabularyLearningItem(item);
  } else if (item.type === "grammar") {
    return validateGrammarLearningItem(item);
  }
  
  // Generic/legacy items bypass type-specific validation
  return item;
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

  tx.objectStore(STORE_LEARNING_ITEMS).put(validateLearningItem(learningItem));
  
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

export async function commitReviewTransaction(db, nextState, reviewLog, isNewItem = false) {
  if (nextState.cardId !== reviewLog.cardId) {
    throw new Error(`Referential integrity failed: ReviewLog cardId ${reviewLog.cardId} mismatch with state cardId ${nextState.cardId}`);
  }

  const tx = db.transaction([STORE_REVIEW_STATES, STORE_REVIEW_LOGS, STORE_SETTINGS], "readwrite");
  const done = transactionDone(tx);

  tx.objectStore(STORE_REVIEW_STATES).put(nextState);
  
  // Enforce append-only invariant. Duplicate log ID will fail the transaction.
  tx.objectStore(STORE_REVIEW_LOGS).add(reviewLog);

  const settingsStore = tx.objectStore(STORE_SETTINGS);
  
  // Need to use requestResult inside the async function but we can just use the callbacks or promise
  const gamificationReq = settingsStore.get("gamificationState");
  const dailyGoalsReq = settingsStore.get("dailyGoalsState");

  gamificationReq.onsuccess = () => {
    const currentState = gamificationReq.result ? gamificationReq.result.value : null;
    const nextGamiState = updateGamificationState(currentState, reviewLog);
    settingsStore.put({ key: "gamificationState", value: nextGamiState });
  };

  dailyGoalsReq.onsuccess = () => {
    const currentState = dailyGoalsReq.result ? dailyGoalsReq.result.value : null;
    const nextGoalsState = updateDailyGoalsState(currentState, reviewLog, isNewItem);
    settingsStore.put({ key: "dailyGoalsState", value: nextGoalsState });
  };

  await done;
}

export async function migrateV1ReviewsToV2(db) {
  if (globalThis.localStorage?.getItem("myNote-japanese-v2-migrated") === "true") {
    return { migrated: 0, skipped: 0 };
  }

  const tx = db.transaction([
    STORE_STUDY_REVIEWS,
    STORE_STUDY_ARTIFACTS,
  ], "readwrite");

  const [reviews, existingArtifacts] = await Promise.all([
    requestResult(tx.objectStore(STORE_STUDY_REVIEWS).getAll()),
    requestResult(tx.objectStore(STORE_STUDY_ARTIFACTS).getAll()),
  ]);

  if (reviews.length === 0) {
    if (globalThis.localStorage) {
      globalThis.localStorage.setItem("myNote-japanese-v2-migrated", "true");
    }
    return { migrated: 0, skipped: 0 };
  }

  const existingKeys = new Set(
    existingArtifacts.map((artifact) => `${artifact.noteId}:${artifact.type}`)
  );

  let migrated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const review of reviews) {
    if (review.notebookType === "output" || review.notebookType === "planner") {
      const key = `${review.noteId}:${review.notebookType}`;
      if (!existingKeys.has(key)) {
        const artifact = {
          id: crypto.randomUUID(),
          noteId: review.noteId,
          type: review.notebookType,
          createdAt: now,
          updatedAt: now
        };
        tx.objectStore(STORE_STUDY_ARTIFACTS).put(artifact);
        existingKeys.add(key);
        migrated++;
      }
    } else {
      skipped++;
    }
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      if (globalThis.localStorage) {
        globalThis.localStorage.setItem("myNote-japanese-v2-migrated", "true");
      }
      resolve({ migrated, skipped });
    };
    tx.onerror = () => reject(tx.error);
  });
}
