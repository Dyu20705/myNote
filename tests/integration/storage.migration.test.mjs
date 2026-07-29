import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const { listNotesFromDb, migrateLegacyStorageIfNeeded, openDatabase } = await import("../../core/storage.js");
const { normalizeNote } = await import("../../core/model.js");

const DATABASE_NAME = "myNoteDB";
const previousLocalStorage = globalThis.localStorage;
const openHandles = new Set();

function createLocalStorageStub() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function closeAllDatabaseHandles() {
  for (const database of openHandles) {
    database.close();
  }
  openHandles.clear();
}

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked by an open handle."));
  });
}

async function openTestDatabase() {
  const database = await openDatabase();
  openHandles.add(database);
  return database;
}

describe("legacy storage migration", { concurrency: false }, () => {
  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    globalThis.localStorage = createLocalStorageStub();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
  });

  test("missing legacy source returns an explicit absent outcome", async () => {
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, { status: "absent", count: 0 });
    assert.deepEqual(Object.keys(outcome), ["status", "count"]);
    assert.deepEqual(await listNotesFromDb(database), []);
  });
});
