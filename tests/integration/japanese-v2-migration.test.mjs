import "fake-indexeddb/auto";
import test, { describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  openDatabase,
  exportDatabase,
  importDatabase,
  STORE_STUDY_REVIEWS,
  STORE_STUDY_ARTIFACTS,
  STORE_LEARNING_ITEMS,
  STORE_CARDS,
  STORE_REVIEW_STATES,
  STORE_REVIEW_LOGS,
  STORE_KANJI_INK_ENTRIES
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

async function putV1Review(db, review) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_STUDY_REVIEWS, "readwrite");
    tx.objectStore(STORE_STUDY_REVIEWS).put(review);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromStore(db, storeName) {
  const tx = db.transaction(storeName, "readonly");
  return requestResult(tx.objectStore(storeName).getAll());
}

// ============================================================
// V1 Migration Tests
// ============================================================

describe("Japanese V2 Migration", () => {
  let db;

  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    if (globalThis.localStorage) {
      globalThis.localStorage.removeItem("myNote-japanese-v2-migrated");
    }
    db = await openTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    if (globalThis.localStorage) {
      globalThis.localStorage.removeItem("myNote-japanese-v2-migrated");
    }
  });

  test("migrates output records into study artifacts", async () => {
    await putV1Review(db, {
      noteId: "note-output-1",
      notebookType: "output",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: "2024-01-01T00:00:00.000Z",
      interval: 0,
      ease: 2.5
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migrated, 1);
    assert.equal(outcome.skipped, 0);

    const reviews = await getAllFromStore(db, STORE_STUDY_REVIEWS);
    const artifacts = await getAllFromStore(db, STORE_STUDY_ARTIFACTS);

    // V1 record preserved
    assert.equal(reviews.length, 1);
    // Artifact created
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].noteId, "note-output-1");
    assert.equal(artifacts[0].type, "output");
  });

  test("migrates planner records into study artifacts", async () => {
    await putV1Review(db, {
      noteId: "note-planner-1",
      notebookType: "planner",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: "2024-01-01T00:00:00.000Z",
      interval: 0,
      ease: 2.5
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migrated, 1);
    assert.equal(outcome.skipped, 0);

    const artifacts = await getAllFromStore(db, STORE_STUDY_ARTIFACTS);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].type, "planner");
  });

  test("vocabulary V1 review is skipped — no V2 items created", async () => {
    await putV1Review(db, {
      noteId: "note-vocab-1",
      notebookType: "vocabulary",
      status: "review",
      lastReviewedAt: "2024-01-01T00:00:00.000Z",
      nextReviewAt: "2024-01-02T00:00:00.000Z",
      interval: 1,
      ease: 2.5
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migrated, 0);
    assert.equal(outcome.skipped, 1);

    // V1 record preserved
    const reviews = await getAllFromStore(db, STORE_STUDY_REVIEWS);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].noteId, "note-vocab-1");
    assert.equal(reviews[0].notebookType, "vocabulary");

    // No V2 entities created
    const items = await getAllFromStore(db, STORE_LEARNING_ITEMS);
    const cards = await getAllFromStore(db, STORE_CARDS);
    const states = await getAllFromStore(db, STORE_REVIEW_STATES);
    const logs = await getAllFromStore(db, STORE_REVIEW_LOGS);

    assert.equal(items.length, 0);
    assert.equal(cards.length, 0);
    assert.equal(states.length, 0);
    assert.equal(logs.length, 0);
  });

  test("kanji V1 review is skipped — no V2 items created", async () => {
    await putV1Review(db, {
      noteId: "note-kanji-1",
      notebookType: "kanji",
      status: "learning",
      lastReviewedAt: "2024-06-15T10:00:00.000Z",
      nextReviewAt: "2024-06-16T10:00:00.000Z",
      interval: 1,
      ease: 2.3
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migrated, 0);
    assert.equal(outcome.skipped, 1);

    const items = await getAllFromStore(db, STORE_LEARNING_ITEMS);
    assert.equal(items.length, 0);
  });

  test("mixed V1 reviews: output migrated, vocabulary skipped", async () => {
    await putV1Review(db, {
      noteId: "note-output-mix",
      notebookType: "output",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: "2024-01-01T00:00:00.000Z",
      interval: 0,
      ease: 2.5
    });
    await putV1Review(db, {
      noteId: "note-vocab-mix",
      notebookType: "vocabulary",
      status: "review",
      lastReviewedAt: "2024-01-01T00:00:00.000Z",
      nextReviewAt: "2024-01-02T00:00:00.000Z",
      interval: 1,
      ease: 2.5
    });

    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migrated, 1);
    assert.equal(outcome.skipped, 1);

    const artifacts = await getAllFromStore(db, STORE_STUDY_ARTIFACTS);
    assert.equal(artifacts.length, 1);
    assert.equal(artifacts[0].type, "output");

    // V1 records all preserved
    const reviews = await getAllFromStore(db, STORE_STUDY_REVIEWS);
    assert.equal(reviews.length, 2);
  });

  test("migration is idempotent — second run returns zero", async () => {
    await putV1Review(db, {
      noteId: "note-output-idem",
      notebookType: "output",
      status: "new",
      lastReviewedAt: null,
      nextReviewAt: "2024-01-01T00:00:00.000Z",
      interval: 0,
      ease: 2.5
    });

    const first = await migrateV1ReviewsToV2(db);
    assert.equal(first.migrated, 1);

    const second = await migrateV1ReviewsToV2(db);
    assert.equal(second.migrated, 0);
    assert.equal(second.skipped, 0);

    // Only one artifact exists
    const artifacts = await getAllFromStore(db, STORE_STUDY_ARTIFACTS);
    assert.equal(artifacts.length, 1);
  });

  test("empty database migration returns zero counts", async () => {
    const outcome = await migrateV1ReviewsToV2(db);
    assert.equal(outcome.migrated, 0);
    assert.equal(outcome.skipped, 0);
  });
});

// ============================================================
// Export/Import Round-Trip Tests
// ============================================================

describe("Export/Import round-trip", () => {
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

  function makeValidSnapshot() {
    const now = "2024-06-01T00:00:00.000Z";
    return {
      schemaVersion: 6,
      notes: [
        { id: "note-1", title: "Test", content: "", tags: [], createdAt: now, updatedAt: now, pinned: false, archived: false, version: 1 }
      ],
      learningItems: [
        { id: "item-1", type: "vocabulary", content: { word: "食べる" }, skills: ["recognition"], sourceRefs: [{ type: "note", id: "note-1" }], status: "active", createdAt: now, updatedAt: now }
      ],
      cards: [
        { id: "card-1", itemId: "item-1", skill: "recognition", status: "active", createdAt: now, updatedAt: now }
      ],
      reviewStates: [
        { cardId: "card-1", state: "new", due: now, reps: 0, lapses: 0, elapsedDays: 0, scheduledDays: 0, scheduler: "legacy-sm2", schedulerVersion: "1.0", updatedAt: now }
      ],
      reviewLogs: [
        { id: "log-1", cardId: "card-1", grade: "good", reviewedAt: now, stateBefore: "new", stateAfter: "learning", elapsedDays: 0, scheduledDays: 1, scheduler: "legacy-sm2", schedulerVersion: "1.0" }
      ],
      studyArtifacts: [
        { id: "art-1", noteId: "note-1", type: "output", createdAt: now, updatedAt: now }
      ],
      kanjiInkEntries: [],
      userThemes: [],
      settings: []
    };
  }

  test("import validates schema version", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.schemaVersion = 99;
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /Unsupported schema version/ }
    );
  });

  test("import rejects null snapshot", async () => {
    await assert.rejects(
      () => importDatabase(db, null),
      { message: /Invalid snapshot/ }
    );
  });

  test("import rejects duplicate note IDs", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.notes.push({ ...snapshot.notes[0] });
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /duplicate id/ }
    );
  });

  test("import rejects broken Card → LearningItem reference", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.cards[0].itemId = "nonexistent-item";
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /Referential integrity.*Card.*missing LearningItem/ }
    );
  });

  test("import rejects broken ReviewState → Card reference", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.reviewStates[0].cardId = "nonexistent-card";
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /Referential integrity.*ReviewState.*missing Card/ }
    );
  });

  test("import rejects broken ReviewLog → Card reference", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.reviewLogs[0].cardId = "nonexistent-card";
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /Referential integrity.*ReviewLog.*missing Card/ }
    );
  });

  test("import rejects broken StudyArtifact → Note reference", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.studyArtifacts[0].noteId = "nonexistent-note";
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /Referential integrity.*StudyArtifact.*missing Note/ }
    );
  });

  test("import rejects duplicate (itemId, skill) card mapping", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.cards.push({
      id: "card-2", itemId: "item-1", skill: "recognition",
      status: "active", createdAt: "2024-06-01T00:00:00.000Z", updatedAt: "2024-06-01T00:00:00.000Z"
    });
    await assert.rejects(
      () => importDatabase(db, snapshot),
      { message: /Duplicate card skill mapping/ }
    );
  });

  test("export → reset → import → export produces equivalent snapshot", async () => {
    // Populate DB with test data
    const snapshot = makeValidSnapshot();
    await importDatabase(db, snapshot);

    // Export the populated DB
    const exported1 = await exportDatabase(db);

    // Reset
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    db = await openTestDatabase();

    // Verify clean state
    const emptyExport = await exportDatabase(db);
    assert.equal(emptyExport.notes.length, 0);

    // Import the first export
    await importDatabase(db, exported1);

    // Export again
    const exported2 = await exportDatabase(db);

    // Compare — must be equivalent
    assert.equal(exported2.schemaVersion, exported1.schemaVersion);
    assert.equal(exported2.notes.length, exported1.notes.length);
    assert.equal(exported2.learningItems.length, exported1.learningItems.length);
    assert.equal(exported2.cards.length, exported1.cards.length);
    assert.equal(exported2.reviewStates.length, exported1.reviewStates.length);
    assert.equal(exported2.reviewLogs.length, exported1.reviewLogs.length);
    assert.equal(exported2.studyArtifacts.length, exported1.studyArtifacts.length);
    assert.equal(exported2.kanjiInkEntries.length, exported1.kanjiInkEntries.length);
    assert.equal(exported2.userThemes.length, exported1.userThemes.length);
    assert.equal(exported2.settings.length, exported1.settings.length);

    // Verify entity IDs preserved
    assert.equal(exported2.notes[0].id, "note-1");
    assert.equal(exported2.learningItems[0].id, "item-1");
    assert.equal(exported2.cards[0].id, "card-1");
    assert.equal(exported2.cards[0].itemId, "item-1");
    assert.equal(exported2.reviewStates[0].cardId, "card-1");
    assert.equal(exported2.reviewLogs[0].cardId, "card-1");
    assert.equal(exported2.studyArtifacts[0].noteId, "note-1");
  });

  test("import allows dangling KanjiInkEntry.noteId", async () => {
    const snapshot = makeValidSnapshot();
    snapshot.kanjiInkEntries = [{
      id: "ink-1", noteId: "nonexistent-note",
      schemaVersion: 1, revision: 1, character: "木",
      strokes: [[{ x: 0.1, y: 0.1 }]],
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-01T00:00:00.000Z"
    }];
    // Should NOT throw — dangling source refs are permitted
    await importDatabase(db, snapshot);
    const entries = await getAllFromStore(db, STORE_KANJI_INK_ENTRIES);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].noteId, "nonexistent-note");
  });

  test("import with empty arrays succeeds", async () => {
    const snapshot = {
      schemaVersion: 6,
      notes: [],
      learningItems: [],
      cards: [],
      reviewStates: [],
      reviewLogs: [],
      studyArtifacts: [],
      kanjiInkEntries: [],
      userThemes: [],
      settings: []
    };
    await importDatabase(db, snapshot);
    const exported = await exportDatabase(db);
    assert.equal(exported.notes.length, 0);
  });
});
