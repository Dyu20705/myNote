import assert from "node:assert/strict";
import test from "node:test";

import { openDatabase } from "../../core/storage.js";

function installIndexedDbStub(schedule) {
  const originalIndexedDb = globalThis.indexedDB;
  const request = {};

  globalThis.indexedDB = {
    open(name, version) {
      assert.equal(name, "myNoteDB");
      assert.equal(version, 4);
      schedule(request);
      return request;
    },
  };

  return () => {
    globalThis.indexedDB = originalIndexedDb;
  };
}

test("openDatabase rejects a blocked upgrade and closes a late connection", async () => {
  let closeCalls = 0;
  const restoreIndexedDb = installIndexedDbStub((request) => {
    queueMicrotask(() => {
      request.onblocked?.();
      queueMicrotask(() => {
        request.result = {
          close() {
            closeCalls += 1;
          },
        };
        request.onsuccess?.();
      });
    });
  });

  try {
    await assert.rejects(
      () => openDatabase(),
      (error) => {
        assert.equal(error.name, "Error");
        assert.equal(error.code, "DATABASE_UPGRADE_BLOCKED");
        assert.equal(error.message, "Database upgrade is blocked by another open tab.");
        return true;
      },
    );
    await Promise.resolve();
    assert.equal(closeCalls, 1);
  } finally {
    restoreIndexedDb();
  }
});

test("openDatabase closes an accepted connection when a newer version is requested", async () => {
  let closeCalls = 0;
  const database = {
    close() {
      closeCalls += 1;
    },
  };
  const restoreIndexedDb = installIndexedDbStub((request) => {
    queueMicrotask(() => {
      request.result = database;
      request.onsuccess?.();
    });
  });

  try {
    assert.equal(await openDatabase(), database);
    assert.equal(typeof database.onversionchange, "function");
    database.onversionchange();
    assert.equal(closeCalls, 1);
  } finally {
    restoreIndexedDb();
  }
});
