import assert from "node:assert/strict";
import test from "node:test";

import { openDatabase } from "../../core/storage.js";

test("openDatabase rejects a blocked upgrade and closes a late connection", async () => {
  const originalIndexedDb = globalThis.indexedDB;
  const request = {};
  let closeCalls = 0;

  globalThis.indexedDB = {
    open(name, version) {
      assert.equal(name, "myNoteDB");
      assert.equal(version, 2);

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

      return request;
    },
  };

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
    globalThis.indexedDB = originalIndexedDb;
  }
});
