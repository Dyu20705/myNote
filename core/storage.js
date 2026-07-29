const LEGACY_STORAGE_KEY = "my-note-v2";
const DB_NAME = "myNoteDB";
const DB_VERSION = 1;
const STORE_NOTES = "notes";

function createMigrationOutcome(status, count, errorCode) {
  return errorCode === undefined ? { status, count } : { status, count, errorCode };
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
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
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

async function putNotesToDb(db, notes) {
  const tx = db.transaction(STORE_NOTES, "readwrite");
  const store = tx.objectStore(STORE_NOTES);
  for (const note of notes) {
    store.put(note);
  }
  await transactionDone(tx);
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
    notes.push(note);
  }
  return { notes };
}

export async function migrateLegacyStorageIfNeeded(db, normalizeNote) {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null) {
    return createMigrationOutcome("absent", 0);
  }

  const existing = await listNotesFromDb(db);
  if (existing.length > 0) {
    return;
  }

  const preflight = preflightLegacyNotes(raw, normalizeNote);
  if (preflight.outcome) {
    return preflight.outcome;
  }

  const legacy = preflight.notes;
  await putNotesToDb(db, legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return createMigrationOutcome("migrated", legacy.length);
}
