import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const { listNotesFromDb, migrateLegacyStorageIfNeeded, openDatabase } = await import("../../core/storage.js");
const { normalizeNote } = await import("../../core/model.js");

const DATABASE_NAME = "myNoteDB";
const LEGACY_STORAGE_KEY = "my-note-v2";
const previousLocalStorage = globalThis.localStorage;
const openHandles = new Set();

function loadFixture(name) {
  return readFile(new URL(`../fixtures/storage/${name}`, import.meta.url), "utf8");
}

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

  test("valid legacy fixture commits canonical notes and returns a bounded outcome", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, { status: "migrated", count: 2 });
    assert.deepEqual(await listNotesFromDb(database), [
      {
        id: "legacy-alpha",
        title: "Alpha",
        content: "Alpha body #one [[Beta]]",
        blocks: [
          {
            id: "block-alpha",
            type: "paragraph",
            content: "Alpha body #one [[Beta]]",
            meta: {},
          },
        ],
        tags: ["manual", "one"],
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        pinned: false,
        archived: false,
        links: ["Beta"],
        ast: [
          { type: "paragraph", text: "Alpha body #one [[Beta]]" },
          { type: "wikilink", target: "Beta" },
        ],
        checksum: "3b1af02c",
        version: 1,
        searchBlob: "alpha alpha body #one [[beta]] manual one beta",
      },
      {
        id: "legacy-beta",
        title: "Beta",
        content: "Beta body",
        blocks: [
          {
            id: "block-beta",
            type: "paragraph",
            content: "Beta body",
            meta: {},
          },
        ],
        tags: [],
        createdAt: "2024-02-01T00:00:00.000Z",
        updatedAt: "2024-02-02T00:00:00.000Z",
        pinned: true,
        archived: false,
        links: [],
        ast: [{ type: "paragraph", text: "Beta body" }],
        checksum: "d41a402f",
        version: 1,
        searchBlob: "beta beta body  ",
      },
    ]);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), null);
    assert.deepEqual(Object.keys(outcome), ["status", "count"]);
    const serializedOutcome = JSON.stringify(outcome);
    for (const forbidden of ["Alpha", "Beta", "legacy-alpha", "legacy-beta", "body"]) {
      assert.equal(serializedOutcome.includes(forbidden), false);
    }
  });

  test("malformed JSON is classified without changing either store", async () => {
    const raw = await loadFixture("legacy-v2-malformed.txt");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, {
      status: "invalid-json",
      count: 0,
      errorCode: "LEGACY_INVALID_JSON",
    });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("non-array JSON is classified without changing either store", async () => {
    const raw = await loadFixture("legacy-v2-non-array.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, {
      status: "invalid-shape",
      count: 0,
      errorCode: "LEGACY_INVALID_SHAPE",
    });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("mixed valid and invalid records are rejected atomically on every retry", async () => {
    const raw = await loadFixture("legacy-v2-mixed-invalid.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    const expectedOutcome = {
      status: "invalid-record",
      count: 2,
      errorCode: "LEGACY_INVALID_RECORD",
    };

    const firstOutcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);
    const secondOutcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(firstOutcome, expectedOutcome);
    assert.deepEqual(secondOutcome, expectedOutcome);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("valid empty array completes a zero-record migration", async () => {
    const raw = await loadFixture("legacy-v2-empty.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, { status: "migrated", count: 0 });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), null);
  });
});
