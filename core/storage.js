const LEGACY_STORAGE_KEY = "my-note-v2";
const DB_NAME = "myNoteDB";
const DB_VERSION = 1;
const STORE_NOTES = "notes";

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

function loadLegacyNotes() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function migrateLegacyStorageIfNeeded(db, normalizeNote) {
  const existing = await listNotesFromDb(db);
  if (existing.length > 0) {
    return;
  }

  const legacy = loadLegacyNotes().map(normalizeNote).filter(Boolean);
  if (legacy.length === 0) {
    return;
  }

  await putNotesToDb(db, legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
