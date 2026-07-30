const LEGACY_STORAGE_KEY = "my-note-v2";
const DB_NAME = "myNoteDB";
const DB_VERSION = 1;
const STORE_NOTES = "notes";

function createMigrationOutcome(status, count, errorCode) {
  return errorCode === undefined ? { status, count } : { status, count, errorCode };
}

function createLegacySourceChangedError() {
  const error = new Error("Legacy source changed during migration.");
  error.code = "LEGACY_SOURCE_CHANGED";
  return error;
}

function createTransactionAbortError() {
  return new DOMException("IndexedDB transaction aborted.", "AbortError");
}

export function resetDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      resolve(true);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database reset is blocked by another open tab."));
  });
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE_NOTES, { keyPath: "id" });
      store.createIndex("updatedAt", "updatedAt");
      store.createIndex("pinned", "pinned");
      store.createIndex("archived", "archived");
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    let firstRequestError;
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => {
      firstRequestError ||= event.target?.error || transaction.error;
    };
    transaction.onabort = () => {
      reject(firstRequestError || transaction.error || createTransactionAbortError());
    };
  });
}

export async function listNotesFromDb(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NOTES, "readonly");
    const store = tx.objectStore(STORE_NOTES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putNoteToDb(db, note) {
  const tx = db.transaction(STORE_NOTES, "readwrite");
  tx.objectStore(STORE_NOTES).put(note);
  await transactionDone(tx);
}

export async function deleteNoteFromDb(db, id) {
  const tx = db.transaction(STORE_NOTES, "readwrite");
  tx.objectStore(STORE_NOTES).delete(id);
  await transactionDone(tx);
}

async function runLegacyMigrationTransaction(db, raw, normalizeNote) {
  const tx = db.transaction(STORE_NOTES, "readwrite");
  const done = transactionDone(tx);
  const store = tx.objectStore(STORE_NOTES);

  try {
    const existingCount = (await requestResult(store.count())) || 0;
    if (existingCount > 0) {
      await done;
      return {
        outcome: createMigrationOutcome(
          "blocked-existing-data",
          existingCount,
          "LEGACY_EXISTING_DATA"
        ),
      };
    }

    if (localStorage.getItem(LEGACY_STORAGE_KEY) !== raw) {
      await done;
      return { sourceChanged: true };
    }

    const preflight = preflightLegacyNotes(raw, normalizeNote);
    if (localStorage.getItem(LEGACY_STORAGE_KEY) !== raw) {
      await done;
      return { sourceChanged: true };
    }
    if (preflight.outcome) {
      await done;
      return preflight;
    }

    for (const note of preflight.notes) {
      store.put(note);
    }

    await done;
    return { migratedCount: preflight.notes.length };
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // The transaction may already have aborted because an asynchronous request failed.
    }
    await done.catch(() => {});
    throw error;
  }
}

function preflightLegacyNotes(raw, normalizeNote) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      outcome: createMigrationOutcome("invalid-json", 0, "LEGACY_INVALID_JSON"),
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      outcome: createMigrationOutcome("invalid-shape", 0, "LEGACY_INVALID_SHAPE"),
    };
  }

  const candidates = parsed;
  const notes = [];
  const ids = new Set();
  for (const candidate of candidates) {
    let note;
    try {
      note = normalizeNote(candidate);
    } catch {
      return {
        outcome: createMigrationOutcome("invalid-record", candidates.length, "LEGACY_INVALID_RECORD"),
      };
    }
    if (!note || typeof note !== "object" || typeof note.id !== "string") {
      return {
        outcome: createMigrationOutcome("invalid-record", candidates.length, "LEGACY_INVALID_RECORD"),
      };
    }
    if (ids.has(note.id)) {
      return {
        outcome: createMigrationOutcome("duplicate-id", candidates.length, "LEGACY_DUPLICATE_ID"),
      };
    }
    ids.add(note.id);
    notes.push(note);
  }
  return { notes };
}

export async function migrateLegacyStorageIfNeeded(db, normalizeNote) {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null) {
    return createMigrationOutcome("absent", 0);
  }

  const result = await runLegacyMigrationTransaction(db, raw, normalizeNote);
  if (result.outcome) {
    return result.outcome;
  }
  if (result.sourceChanged || localStorage.getItem(LEGACY_STORAGE_KEY) !== raw) {
    throw createLegacySourceChangedError();
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return createMigrationOutcome("migrated", result.migratedCount);
}
