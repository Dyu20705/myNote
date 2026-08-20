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

export async function getDueReviewStates(db, nowTimestamp, limit) {
  const tx = db.transaction(STORE_REVIEW_STATES, "readonly");
  const index = tx.objectStore(STORE_REVIEW_STATES).index("due");
  const range = IDBKeyRange.upperBound(nowTimestamp);
  
  // We can't use getAll(range, limit) directly in older browsers, but modern ones support it.
  const states = await requestResult(index.getAll(range, limit));
  return states || [];
}

export async function commitReviewTransaction(db, nextState, reviewLog) {
  const tx = db.transaction([STORE_REVIEW_STATES, STORE_REVIEW_LOGS], "readwrite");
  const done = transactionDone(tx);

  tx.objectStore(STORE_REVIEW_STATES).put(nextState);
  tx.objectStore(STORE_REVIEW_LOGS).put(reviewLog);

  await done;
}
