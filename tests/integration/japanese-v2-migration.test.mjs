import "fake-indexeddb/auto";
import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  openDatabase,
  resetDatabase,
  putStudyReviewToDb,
  STORE_STUDY_REVIEWS,
  STORE_STUDY_ARTIFACTS,
  STORE_LEARNING_ITEMS,
  STORE_CARDS,
  STORE_REVIEW_STATES,
  STORE_REVIEW_LOGS
} from "../../core/storage.js";
import { migrateV1ReviewsToV2 } from "../../core/japaneseV2Storage.js";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked by an open handle."));
  });
}

function closeAllDatabaseHandles() {
  for (const database of openHandles) {
    database.close();
  }
  openHandles.clear();
}

async function openTestDatabase() {
  const database = await openDatabase();
  openHandles.add(database);
  return database;
}

describe("Japanese V2 Migration", () => {
  let db;

  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    db = await openTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  test("migrates output records into study artifacts", async () => {
    const review = {
      noteId: "note-output-1",
      notebookType: "output",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: "2024-01-01T00:00:00.000Z",
      interval: 0,
      ease: 2.5
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STUDY_REVIEWS, "readwrite");
      tx.objectStore(STORE_STUDY_REVIEWS).put(review);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migratedCount, 1);

    const tx = db.transaction([STORE_STUDY_REVIEWS, STORE_STUDY_ARTIFACTS], "readonly");
    const reviews = await requestResult(tx.objectStore(STORE_STUDY_REVIEWS).getAll());
    const artifacts = await requestResult(tx.objectStore(STORE_STUDY_ARTIFACTS).getAll());

    assert.equal(reviews.length, 1);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].noteId, "note-output-1");
    assert.equal(artifacts[0].type, "output");
  });

  test("migrates vocabulary records into legacy learning items and review state", async () => {
    const review = {
      noteId: "note-vocab-1",
      notebookType: "vocabulary",
      status: "review",
      lastReviewedAt: "2024-01-01T00:00:00.000Z",
      nextReviewAt: "2024-01-02T00:00:00.000Z",
      interval: 1,
      ease: 2.5
    };
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_STUDY_REVIEWS, "readwrite");
      tx.objectStore(STORE_STUDY_REVIEWS).put(review);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migratedCount, 1);

    const tx = db.transaction([
      STORE_STUDY_REVIEWS, 
      STORE_LEARNING_ITEMS, 
      STORE_CARDS, 
      STORE_REVIEW_STATES, 
      STORE_REVIEW_LOGS
    ], "readonly");

    const reviews = await requestResult(tx.objectStore(STORE_STUDY_REVIEWS).getAll());
    const items = await requestResult(tx.objectStore(STORE_LEARNING_ITEMS).getAll());
    const cards = await requestResult(tx.objectStore(STORE_CARDS).getAll());
    const states = await requestResult(tx.objectStore(STORE_REVIEW_STATES).getAll());
    const logs = await requestResult(tx.objectStore(STORE_REVIEW_LOGS).getAll());

    assert.equal(reviews.length, 1);
    
    assert.equal(items.length, 1);
    assert.equal(items[0].type, "legacy");
    assert.equal(items[0].content.originalType, "vocabulary");

    assert.equal(cards.length, 1);
    assert.equal(cards[0].itemId, items[0].id);
    assert.equal(cards[0].skill, "legacy");
    assert.equal(cards[0].status, "active");

    assert.equal(states.length, 1);
    assert.equal(states[0].cardId, cards[0].id);
    assert.equal(states[0].state, "review");
    assert.equal(states[0].due, "2024-01-02T00:00:00.000Z");

    assert.equal(logs.length, 1);
    assert.equal(logs[0].cardId, cards[0].id);
    assert.equal(logs[0].source, "migration");
    assert.equal(logs[0].migrationQuality, "heuristic");
  });
});
