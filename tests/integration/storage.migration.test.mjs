import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const { listNotesFromDb, migrateLegacyStorageIfNeeded, openDatabase, putNoteToDb } = await import(
  "../../core/storage.js"
);
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

function replaceLegacySourceOnNextReadwriteCommit(database, replacementRaw) {
  return new Proxy(database, {
    get(target, property) {
      if (property !== "transaction") {
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }

      return (...args) => {
        const transaction = target.transaction(...args);
        if (args[1] === "readwrite") {
          transaction.addEventListener(
            "complete",
            () => globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, replacementRaw),
            { once: true }
          );
        }
        return transaction;
      };
    },
  });
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
    database.close();
    openHandles.delete(database);

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, { status: "absent", count: 0 });
    assert.deepEqual(Object.keys(outcome), ["status", "count"]);
    const reopenedDatabase = await openTestDatabase();
    assert.deepEqual(await listNotesFromDb(reopenedDatabase), []);
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

  test("duplicate normalized IDs reject the complete migration", async () => {
    const raw = await loadFixture("legacy-v2-duplicate-ids.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, {
      status: "duplicate-id",
      count: 2,
      errorCode: "LEGACY_DUPLICATE_ID",
    });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("distinct raw IDs that normalize to one identity reject the complete migration", async () => {
    const raw = JSON.stringify([
      { id: "raw-identity-one", title: "One", content: "First" },
      { id: "raw-identity-two", title: "Two", content: "Second" },
    ]);
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    const normalizedCandidates = [];

    const outcome = await migrateLegacyStorageIfNeeded(database, (candidate) => {
      normalizedCandidates.push(candidate.id);
      return { ...normalizeNote(candidate), id: "shared-normalized-identity" };
    });

    assert.deepEqual(outcome, {
      status: "duplicate-id",
      count: 2,
      errorCode: "LEGACY_DUPLICATE_ID",
    });
    assert.deepEqual(normalizedCandidates, ["raw-identity-one", "raw-identity-two"]);
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("missing and non-string normalized IDs reject the complete migration", async () => {
    const raw = JSON.stringify([{ id: "raw-candidate", title: "Candidate", content: "Body" }]);
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    for (const invalidId of [undefined, 42]) {
      let normalizeCalls = 0;
      const outcome = await migrateLegacyStorageIfNeeded(database, () => {
        normalizeCalls += 1;
        return { id: invalidId };
      });

      assert.deepEqual(outcome, {
        status: "invalid-record",
        count: 1,
        errorCode: "LEGACY_INVALID_RECORD",
      });
      assert.equal(normalizeCalls, 1);
      assert.deepEqual(await listNotesFromDb(database), []);
      assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
    }
  });

  test("concurrent migrations serialize the empty check and import exactly once", async () => {
    const raw = JSON.stringify([{ title: "Concurrent synthetic note", content: "One source" }]);
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const firstDatabase = await openTestDatabase();
    const secondDatabase = await openTestDatabase();

    const outcomes = await Promise.all([
      migrateLegacyStorageIfNeeded(firstDatabase, normalizeNote),
      migrateLegacyStorageIfNeeded(secondDatabase, normalizeNote),
    ]);

    assert.deepEqual(
      outcomes.map(({ status }) => status).sort(),
      ["blocked-existing-data", "migrated"]
    );
    assert.deepEqual(
      outcomes.find(({ status }) => status === "migrated"),
      { status: "migrated", count: 1 }
    );
    assert.deepEqual(
      outcomes.find(({ status }) => status === "blocked-existing-data"),
      {
        status: "blocked-existing-data",
        count: 1,
        errorCode: "LEGACY_EXISTING_DATA",
      }
    );

    closeAllDatabaseHandles();
    const reopenedDatabase = await openTestDatabase();
    assert.equal((await listNotesFromDb(reopenedDatabase)).length, 1);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), null);
  });

  test("a source replaced at database commit is preserved as a cleanup conflict", async () => {
    const raw = JSON.stringify([
      { id: "legacy-before-replacement", title: "Before", content: "Committed source" },
    ]);
    const replacementRaw = JSON.stringify([
      { id: "legacy-after-replacement", title: "After", content: "Preserved source" },
    ]);
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    const databaseWithCommitReplacement = replaceLegacySourceOnNextReadwriteCommit(
      database,
      replacementRaw
    );

    await assert.rejects(
      () => migrateLegacyStorageIfNeeded(databaseWithCommitReplacement, normalizeNote),
      (error) => {
        assert.equal(error.code, "LEGACY_SOURCE_CHANGED");
        assert.equal(error.message.includes("Before"), false);
        assert.equal(error.message.includes("After"), false);
        assert.equal(error.message.includes("legacy-before-replacement"), false);
        assert.equal(error.message.includes("legacy-after-replacement"), false);
        return true;
      }
    );

    closeAllDatabaseHandles();
    const reopenedDatabase = await openTestDatabase();
    assert.deepEqual(
      (await listNotesFromDb(reopenedDatabase)).map(({ id }) => id),
      ["legacy-before-replacement"]
    );
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), replacementRaw);
  });

  test("a synchronous queue error is preserved and aborts every pending legacy write", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    const queueError = new Error("Synthetic queue failure without note content.");
    const originalPut = globalThis.IDBObjectStore.prototype.put;
    let putCalls = 0;
    globalThis.IDBObjectStore.prototype.put = function (...args) {
      putCalls += 1;
      if (putCalls === 2) {
        throw queueError;
      }
      return Reflect.apply(originalPut, this, args);
    };

    try {
      await assert.rejects(
        () => migrateLegacyStorageIfNeeded(database, normalizeNote),
        (error) => error === queueError
      );
    } finally {
      globalThis.IDBObjectStore.prototype.put = originalPut;
    }

    closeAllDatabaseHandles();
    const reopenedDatabase = await openTestDatabase();
    assert.deepEqual(await listNotesFromDb(reopenedDatabase), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("an asynchronous transaction abort settles before rejection and rolls back", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    const originalPut = globalThis.IDBObjectStore.prototype.put;
    let abortScheduled = false;
    globalThis.IDBObjectStore.prototype.put = function (...args) {
      const request = Reflect.apply(originalPut, this, args);
      if (!abortScheduled) {
        abortScheduled = true;
        queueMicrotask(() => this.transaction.abort());
      }
      return request;
    };

    try {
      await assert.rejects(() => migrateLegacyStorageIfNeeded(database, normalizeNote));
    } finally {
      globalThis.IDBObjectStore.prototype.put = originalPut;
    }

    closeAllDatabaseHandles();
    const reopenedDatabase = await openTestDatabase();
    assert.deepEqual(await listNotesFromDb(reopenedDatabase), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("existing canonical data blocks automatic migration before normalization", async () => {
    const existingNote = {
      id: "existing-canonical-note",
      title: "Existing synthetic note",
      content: "Existing canonical content",
      createdAt: "2024-06-01T00:00:00.000Z",
      updatedAt: "2024-06-02T00:00:00.000Z",
      version: 1,
    };
    const raw = await loadFixture("legacy-v2-malformed.txt");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    await putNoteToDb(database, existingNote);
    const originalCount = globalThis.IDBObjectStore.prototype.count;
    const originalGetAll = globalThis.IDBObjectStore.prototype.getAll;
    let countCalls = 0;
    let getAllCalls = 0;
    globalThis.IDBObjectStore.prototype.count = function (...args) {
      countCalls += 1;
      return Reflect.apply(originalCount, this, args);
    };
    globalThis.IDBObjectStore.prototype.getAll = function () {
      getAllCalls += 1;
      throw new Error("existing-data readiness must not load note bodies");
    };
    let normalizeCalls = 0;
    const unexpectedNormalizer = () => {
      normalizeCalls += 1;
      throw new Error("existing-data branch must not normalize legacy records");
    };

    let outcome;
    try {
      outcome = await migrateLegacyStorageIfNeeded(database, unexpectedNormalizer);
    } finally {
      globalThis.IDBObjectStore.prototype.count = originalCount;
      globalThis.IDBObjectStore.prototype.getAll = originalGetAll;
    }

    assert.deepEqual(outcome, {
      status: "blocked-existing-data",
      count: 1,
      errorCode: "LEGACY_EXISTING_DATA",
    });
    assert.equal(countCalls, 1);
    assert.equal(getAllCalls, 0);
    assert.equal(normalizeCalls, 0);
    assert.deepEqual(await listNotesFromDb(database), [existingNote]);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("non-string canonical fields migrate with stale projections rebuilt", async () => {
    const raw = await loadFixture("legacy-v2-non-string-fields.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, { status: "migrated", count: 1 });
    assert.deepEqual(await listNotesFromDb(database), [
      {
        id: "legacy-non-string-fields",
        title: "Untitled",
        content: "",
        blocks: [
          {
            id: "block-non-string",
            type: "paragraph",
            content: "Caller block survives",
            meta: {},
          },
        ],
        tags: [],
        createdAt: "2024-05-01T00:00:00.000Z",
        updatedAt: "2024-05-02T00:00:00.000Z",
        pinned: false,
        archived: false,
        links: [],
        ast: [],
        checksum: "30750576",
        version: 1,
        searchBlob: "untitled   ",
      },
    ]);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), null);
  });

  test("normalization exceptions classify the complete source as invalid", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, () => {
      throw new Error("synthetic normalization rejection");
    });

    assert.deepEqual(outcome, {
      status: "invalid-record",
      count: 2,
      errorCode: "LEGACY_INVALID_RECORD",
    });
    assert.deepEqual(await listNotesFromDb(database), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("a present empty string is invalid JSON rather than an absent source", async () => {
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, "");
    const database = await openTestDatabase();

    const outcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(outcome, {
      status: "invalid-json",
      count: 0,
      errorCode: "LEGACY_INVALID_JSON",
    });
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), "");
    assert.deepEqual(await listNotesFromDb(database), []);
  });

  test("retry after successful migration is an absent no-op", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();

    const firstOutcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);
    const notesAfterFirstRun = await listNotesFromDb(database);
    const secondOutcome = await migrateLegacyStorageIfNeeded(database, normalizeNote);

    assert.deepEqual(firstOutcome, { status: "migrated", count: 2 });
    assert.deepEqual(secondOutcome, { status: "absent", count: 0 });
    assert.deepEqual(await listNotesFromDb(database), notesAfterFirstRun);
    assert.equal(notesAfterFirstRun.length, 2);
  });

  test("database transaction creation failure preserves the exact source", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const database = await openTestDatabase();
    database.close();

    await assert.rejects(() => migrateLegacyStorageIfNeeded(database, normalizeNote), {
      name: "InvalidStateError",
    });

    const reopenedDatabase = await openTestDatabase();
    assert.deepEqual(await listNotesFromDb(reopenedDatabase), []);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });

  test("cleanup failure leaves a recoverable blocked pair without duplicate import", async () => {
    const raw = await loadFixture("legacy-v2-valid-multi.json");
    globalThis.localStorage.setItem(LEGACY_STORAGE_KEY, raw);
    const cleanupError = new Error("synthetic cleanup rejection");
    globalThis.localStorage.removeItem = () => {
      throw cleanupError;
    };
    const database = await openTestDatabase();

    await assert.rejects(() => migrateLegacyStorageIfNeeded(database, normalizeNote), (error) => {
      assert.equal(error, cleanupError);
      return true;
    });

    assert.equal((await listNotesFromDb(database)).length, 2);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
    assert.deepEqual(await migrateLegacyStorageIfNeeded(database, normalizeNote), {
      status: "blocked-existing-data",
      count: 2,
      errorCode: "LEGACY_EXISTING_DATA",
    });
    assert.equal((await listNotesFromDb(database)).length, 2);
    assert.equal(globalThis.localStorage.getItem(LEGACY_STORAGE_KEY), raw);
  });
});
