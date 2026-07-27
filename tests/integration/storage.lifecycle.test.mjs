import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

await import("fake-indexeddb/auto");

const { deleteNoteFromDb, listNotesFromDb, openDatabase, putNoteToDb } = await import("../../core/storage.js");

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();

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

describe("storage lifecycle", { concurrency: false }, () => {
  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  test("storage writes, lists, deletes, and removes a synthetic note", async () => {
    const syntheticNote = {
      id: "integration-lifecycle-note",
      title: "Synthetic lifecycle note",
      content: "Synthetic storage lifecycle content",
      updatedAt: "2026-07-27T00:00:00.000Z",
    };
    const database = await openTestDatabase();

    await putNoteToDb(database, syntheticNote);
    assert.deepEqual(await listNotesFromDb(database), [syntheticNote]);

    await deleteNoteFromDb(database, syntheticNote.id);
    assert.deepEqual(await listNotesFromDb(database), []);
  });

  test("closed connection rejects without changing committed data", async () => {
    const syntheticNote = {
      id: "integration-committed-note",
      title: "Synthetic committed note",
      content: "Committed before close",
      updatedAt: "2026-07-27T00:00:00.000Z",
    };
    const replacementNote = {
      ...syntheticNote,
      id: "integration-replacement-note",
      content: "This write must not commit",
    };
    const database = await openTestDatabase();

    await putNoteToDb(database, syntheticNote);
    database.close();

    await assert.rejects(() => putNoteToDb(database, replacementNote), { name: "InvalidStateError" });

    const reopenedDatabase = await openTestDatabase();
    assert.deepEqual(await listNotesFromDb(reopenedDatabase), [syntheticNote]);
  });
});
