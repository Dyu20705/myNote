import assert from "node:assert/strict";
import { test } from "node:test";

await import("fake-indexeddb/auto");

const { listNotesFromDb, migrateLegacyStorageIfNeeded, openDatabase } = await import(
  "../../core/storage.js"
);
const { normalizeNote } = await import("../../core/model.js");

const DATABASE_NAME = "myNoteDB";
const LEGACY_STORAGE_KEY = "my-note-v2";
const previousLocalStorage = globalThis.localStorage;

function createLocalStorageStub() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked."));
  });
}

test("a source changed during normalization is rejected before any legacy write", async () => {
  globalThis.localStorage = createLocalStorageStub();
  await deleteTestDatabase();

  const raw = JSON.stringify([
    { id: "legacy-before-normalization-change", title: "Before", content: "Old source" },
  ]);
  const replacementRaw = JSON.stringify([
    { id: "legacy-after-normalization-change", title: "After", content: "New source" },
  ]);
  globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
  let database;

  try {
    database = await openDatabase();
    let normalizeCalls = 0;

    await assert.rejects(
      () =>
        migrateLegacyStorageIfNeeded(database, (candidate) => {
          normalizeCalls += 1;
          const normalized = normalizeNote(candidate);
          globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, replacementRaw);
          return normalized;
        }),
      (error) => {
        assert.equal(error.code, "LEGACY_SOURCE_CHANGED");
        return true;
      }
    );

    assert.equal(normalizeCalls, 1);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), replacementRaw);
  } finally {
    database?.close();
    await deleteTestDatabase();
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
  }
});

test("a source changed during invalid normalization rejects as a source conflict", async () => {
  globalThis.localStorage = createLocalStorageStub();
  await deleteTestDatabase();

  const raw = JSON.stringify([
    { id: "legacy-before-invalid-normalization", title: "Before", content: "Old source" },
  ]);
  const replacementRaw = JSON.stringify([
    { id: "legacy-after-invalid-normalization", title: "After", content: "New source" },
  ]);
  globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
  let database;

  try {
    database = await openDatabase();
    let normalizeCalls = 0;

    await assert.rejects(
      () =>
        migrateLegacyStorageIfNeeded(database, () => {
          normalizeCalls += 1;
          globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, replacementRaw);
          return null;
        }),
      (error) => {
        assert.equal(error.code, "LEGACY_SOURCE_CHANGED");
        return true;
      }
    );

    assert.equal(normalizeCalls, 1);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), replacementRaw);
  } finally {
    database?.close();
    await deleteTestDatabase();
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
  }
});
