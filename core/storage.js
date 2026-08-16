import { validateKanjiInkEntry } from "./kanjiInkEntry.js";
import { validateStudyReview } from "./studyReview.js";

const LEGACY_STORAGE_KEY = "my-note-v2";
const DB_NAME = "myNoteDB";
const DB_VERSION = 4;
const STORE_NOTES = "notes";
const STORE_STUDY_REVIEWS = "studyReviews";
const STORE_KANJI_INK_ENTRIES = "kanjiInkEntries";
const STORE_JAPANESE_ITEMS = "japaneseItems";
const STORE_JAPANESE_CARDS = "japaneseCards";
const STORE_JAPANESE_REVIEW_LOGS = "japaneseReviewLogs";
const pendingDependentRestores = new WeakMap();

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

function createDatabaseUpgradeBlockedError() {
  const error = new Error("Database upgrade is blocked by another open tab.");
  error.code = "DATABASE_UPGRADE_BLOCKED";
  return error;
}

function createInvalidNoteError() {
  const error = new TypeError("Invalid note");
  error.code = "INVALID_NOTE";
  return error;
}

function createStudyReviewNotFoundError() {
  const error = new Error("Study review not found");
  error.code = "STUDY_REVIEW_NOT_FOUND";
  return error;
}

function createKanjiNoteNotFoundError() {
  const error = new Error("KANJI_NOTE_NOT_FOUND");
  error.code = "KANJI_NOTE_NOT_FOUND";
  return error;
}

function createKanjiInkEntryNotFoundError() {
  const error = new Error("KANJI_INK_ENTRY_NOT_FOUND");
  error.code = "KANJI_INK_ENTRY_NOT_FOUND";
  return error;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validatePairedNote(note, review) {
  try {
    if (!isPlainObject(note)) {
      throw createInvalidNoteError();
    }
    const clonedNote = structuredClone(note);
    const noteId = clonedNote.id;
    if (typeof noteId !== "string" || noteId.length === 0 || noteId !== review.noteId) {
      throw createInvalidNoteError();
    }
    return clonedNote;
  } catch {
    throw createInvalidNoteError();
  }
}

function validateStandaloneNote(note) {
  try {
    if (!isPlainObject(note)) throw createInvalidNoteError();
    const clonedNote = structuredClone(note);
    if (typeof clonedNote.id !== "string" || clonedNote.id.length === 0) {
      throw createInvalidNoteError();
    }
    return clonedNote;
  } catch {
    throw createInvalidNoteError();
  }
}

function abortTransaction(transaction) {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have aborted because an asynchronous request failed.
  }
}

async function abortAndSettleTransaction(transaction, done) {
  abortTransaction(transaction);
  await done.catch(() => {});
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
    let blocked = false;

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1 && !db.objectStoreNames.contains(STORE_NOTES)) {
        const store = db.createObjectStore(STORE_NOTES, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("pinned", "pinned");
        store.createIndex("archived", "archived");
      }
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(STORE_STUDY_REVIEWS)) {
        const store = db.createObjectStore(STORE_STUDY_REVIEWS, { keyPath: "noteId" });
        store.createIndex("nextReviewAt", "nextReviewAt");
        store.createIndex("notebookType", "notebookType");
        store.createIndex("status", "status");
      }
      if (event.oldVersion < 3 && !db.objectStoreNames.contains(STORE_KANJI_INK_ENTRIES)) {
        const store = db.createObjectStore(STORE_KANJI_INK_ENTRIES, { keyPath: "id" });
        store.createIndex("noteId", "noteId");
        store.createIndex("updatedAt", "updatedAt");
      }
      if (event.oldVersion < 4) {
        if (!db.objectStoreNames.contains(STORE_JAPANESE_ITEMS)) {
          const store = db.createObjectStore(STORE_JAPANESE_ITEMS, { keyPath: "id" });
          store.createIndex("noteId", "noteId");
        }
        if (!db.objectStoreNames.contains(STORE_JAPANESE_CARDS)) {
          const store = db.createObjectStore(STORE_JAPANESE_CARDS, { keyPath: "id" });
          store.createIndex("nextReviewAt", "nextReviewAt");
        }
        if (!db.objectStoreNames.contains(STORE_JAPANESE_REVIEW_LOGS)) {
          const store = db.createObjectStore(STORE_JAPANESE_REVIEW_LOGS, { keyPath: "id" });
          store.createIndex("cardId", "cardId");
        }
      }
    };

    request.onblocked = () => {
      blocked = true;
      reject(createDatabaseUpgradeBlockedError());
    };
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    let firstRequestError;
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => {
      const requestError = event.target?.error || transaction.error;
      if (requestError?.name !== "AbortError") firstRequestError ||= requestError;
    };
    transaction.onabort = () => {
      reject(firstRequestError || createTransactionAbortError());
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

export async function listStudyReviewsFromDb(db) {
  const tx = db.transaction(STORE_STUDY_REVIEWS, "readonly");
  const reviews = await requestResult(tx.objectStore(STORE_STUDY_REVIEWS).getAll());
  return (reviews || []).map(validateStudyReview);
}

export async function getStudyReviewFromDb(db, noteId) {
  const tx = db.transaction(STORE_STUDY_REVIEWS, "readonly");
  const review = await requestResult(tx.objectStore(STORE_STUDY_REVIEWS).get(noteId));
  return review === undefined ? undefined : validateStudyReview(review);
}

export async function putStudyReviewToDb(db, review) {
  const validatedReview = validateStudyReview(review);
  const tx = db.transaction(STORE_STUDY_REVIEWS, "readwrite");
  const done = transactionDone(tx);

  try {
    const store = tx.objectStore(STORE_STUDY_REVIEWS);
    const existingReview = await requestResult(store.get(validatedReview.noteId));
    if (existingReview === undefined) {
      throw createStudyReviewNotFoundError();
    }
    store.put(validatedReview);
    await done;
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function putJapaneseNoteWithReviewToDb(db, note, review) {
  const validatedReview = validateStudyReview(review);
  const validatedNote = validatePairedNote(note, validatedReview);
  const tx = db.transaction([STORE_NOTES, STORE_STUDY_REVIEWS], "readwrite");
  const done = transactionDone(tx);

  try {
    tx.objectStore(STORE_NOTES).add(validatedNote);
    tx.objectStore(STORE_STUDY_REVIEWS).add(validatedReview);
    await done;
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function deleteNoteWithReviewFromDb(db, noteId) {
  if (typeof noteId !== "string" || noteId.length === 0) {
    throw createInvalidNoteError();
  }
  const tx = db.transaction([STORE_NOTES, STORE_STUDY_REVIEWS], "readwrite");
  const done = transactionDone(tx);

  try {
    const noteStore = tx.objectStore(STORE_NOTES);
    const reviewStore = tx.objectStore(STORE_STUDY_REVIEWS);
    const [note, review] = await Promise.all([
      requestResult(noteStore.get(noteId)),
      requestResult(reviewStore.get(noteId)),
    ]);
    if (note === undefined) {
      await done;
      return undefined;
    }
    const capturedReview = review === undefined ? undefined : validateStudyReview(review);
    noteStore.delete(noteId);
    if (capturedReview !== undefined) reviewStore.delete(noteId);
    await done;
    return capturedReview;
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function restoreNoteWithReviewToDb(db, note, review) {
  const validatedReview = validateStudyReview(review);
  const validatedNote = validatePairedNote(note, validatedReview);
  const tx = db.transaction([STORE_NOTES, STORE_STUDY_REVIEWS], "readwrite");
  const done = transactionDone(tx);

  try {
    tx.objectStore(STORE_NOTES).add(validatedNote);
    tx.objectStore(STORE_STUDY_REVIEWS).add(validatedReview);
    await done;
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

function pendingRestoresFor(db) {
  let pending = pendingDependentRestores.get(db);
  if (!pending) {
    pending = new Map();
    pendingDependentRestores.set(db, pending);
  }
  return pending;
}

export async function putNoteToDb(db, note) {
  const pending = pendingDependentRestores.get(db)?.get(note?.id);
  if (!pending) {
    const tx = db.transaction(STORE_NOTES, "readwrite");
    tx.objectStore(STORE_NOTES).put(note);
    await transactionDone(tx);
    return;
  }

  const validatedNote = validateStandaloneNote(note);
  const tx = db.transaction(
    [STORE_NOTES, STORE_STUDY_REVIEWS, STORE_KANJI_INK_ENTRIES],
    "readwrite",
  );
  const done = transactionDone(tx);
  try {
    tx.objectStore(STORE_NOTES).put(validatedNote);
    if (pending.review !== undefined) {
      tx.objectStore(STORE_STUDY_REVIEWS).add(pending.review);
    }
    const inkStore = tx.objectStore(STORE_KANJI_INK_ENTRIES);
    for (const entry of pending.kanjiInkEntries) {
      inkStore.add(entry);
    }
    await done;
    pendingDependentRestores.get(db)?.delete(validatedNote.id);
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function deleteNoteFromDb(db, id) {
  const capture = await deleteNoteWithDependentsFromDb(db, id);
  if (capture !== undefined) {
    pendingRestoresFor(db).set(id, capture);
  }
  return capture;
}

export async function getKanjiInkEntryFromDb(db, id) {
  const tx = db.transaction(STORE_KANJI_INK_ENTRIES, "readonly");
  const entry = await requestResult(tx.objectStore(STORE_KANJI_INK_ENTRIES).get(id));
  return entry === undefined ? undefined : validateKanjiInkEntry(entry);
}

export async function listKanjiInkEntriesFromDb(db, noteId) {
  if (typeof noteId !== "string" || noteId.length === 0) {
    throw createKanjiNoteNotFoundError();
  }
  const tx = db.transaction(STORE_KANJI_INK_ENTRIES, "readonly");
  const store = tx.objectStore(STORE_KANJI_INK_ENTRIES);
  const records = await requestResult(store.index("noteId").getAll(noteId));
  const entries = [];
  let invalidCount = 0;
  for (const record of records || []) {
    try {
      entries.push(validateKanjiInkEntry(record));
    } catch {
      invalidCount += 1;
    }
  }
  entries.sort((left, right) => (
    left.updatedAt.localeCompare(right.updatedAt) || left.id.localeCompare(right.id)
  ));
  return { entries, invalidCount };
}

export async function addKanjiInkEntryToDb(db, entry) {
  const validatedEntry = validateKanjiInkEntry(entry);
  const tx = db.transaction([STORE_NOTES, STORE_KANJI_INK_ENTRIES], "readwrite");
  const done = transactionDone(tx);
  try {
    const note = await requestResult(tx.objectStore(STORE_NOTES).get(validatedEntry.noteId));
    if (note === undefined) throw createKanjiNoteNotFoundError();
    tx.objectStore(STORE_KANJI_INK_ENTRIES).add(validatedEntry);
    await done;
    return structuredClone(validatedEntry);
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function putKanjiInkEntryToDb(db, entry) {
  const validatedEntry = validateKanjiInkEntry(entry);
  const tx = db.transaction([STORE_NOTES, STORE_KANJI_INK_ENTRIES], "readwrite");
  const done = transactionDone(tx);
  try {
    const noteStore = tx.objectStore(STORE_NOTES);
    const inkStore = tx.objectStore(STORE_KANJI_INK_ENTRIES);
    const [note, existingEntry] = await Promise.all([
      requestResult(noteStore.get(validatedEntry.noteId)),
      requestResult(inkStore.get(validatedEntry.id)),
    ]);
    if (note === undefined) throw createKanjiNoteNotFoundError();
    if (existingEntry === undefined) throw createKanjiInkEntryNotFoundError();
    inkStore.put(validatedEntry);
    await done;
    return structuredClone(validatedEntry);
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function deleteKanjiInkEntryFromDb(db, id) {
  const tx = db.transaction(STORE_KANJI_INK_ENTRIES, "readwrite");
  const done = transactionDone(tx);
  try {
    const store = tx.objectStore(STORE_KANJI_INK_ENTRIES);
    const entry = await requestResult(store.get(id));
    if (entry === undefined) {
      await done;
      return undefined;
    }
    const validatedEntry = validateKanjiInkEntry(entry);
    store.delete(id);
    await done;
    return validatedEntry;
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function deleteNoteWithDependentsFromDb(db, noteId) {
  if (typeof noteId !== "string" || noteId.length === 0) throw createInvalidNoteError();
  const storeNames = [STORE_NOTES, STORE_STUDY_REVIEWS, STORE_KANJI_INK_ENTRIES];
  const tx = db.transaction(storeNames, "readwrite");
  const done = transactionDone(tx);
  try {
    const noteStore = tx.objectStore(STORE_NOTES);
    const reviewStore = tx.objectStore(STORE_STUDY_REVIEWS);
    const inkStore = tx.objectStore(STORE_KANJI_INK_ENTRIES);
    const inkEntriesByNoteId = inkStore.index("noteId");
    const [note, review, rawEntries, rawEntryKeys] = await Promise.all([
      requestResult(noteStore.get(noteId)),
      requestResult(reviewStore.get(noteId)),
      requestResult(inkEntriesByNoteId.getAll(noteId)),
      requestResult(inkEntriesByNoteId.getAllKeys(noteId)),
    ]);
    if (note === undefined) {
      await done;
      return undefined;
    }
    const capturedNote = validateStandaloneNote(note);
    const capturedReview = review === undefined ? undefined : validateStudyReview(review);
    const kanjiInkEntries = [];
    for (const rawEntry of rawEntries || []) {
      try {
        kanjiInkEntries.push(validateKanjiInkEntry(rawEntry));
      } catch {
        // Corrupt dependents are removed with their owner but cannot be restored by undo.
      }
    }
    kanjiInkEntries.sort((left, right) => left.id.localeCompare(right.id));
    noteStore.delete(noteId);
    if (capturedReview !== undefined) reviewStore.delete(noteId);
    for (const key of rawEntryKeys || []) inkStore.delete(key);
    await done;
    return {
      note: capturedNote,
      review: capturedReview,
      kanjiInkEntries,
    };
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
}

export async function restoreNoteWithDependentsToDb(db, capture) {
  if (!isPlainObject(capture)) throw createInvalidNoteError();
  const note = validateStandaloneNote(capture.note);
  const review = capture.review === undefined ? undefined : validateStudyReview(capture.review);
  if (review !== undefined && review.noteId !== note.id) throw createInvalidNoteError();
  if (!Array.isArray(capture.kanjiInkEntries)) throw createInvalidNoteError();
  const entries = capture.kanjiInkEntries.map(validateKanjiInkEntry);
  if (entries.some((entry) => entry.noteId !== note.id)) throw createInvalidNoteError();

  const tx = db.transaction(
    [STORE_NOTES, STORE_STUDY_REVIEWS, STORE_KANJI_INK_ENTRIES],
    "readwrite",
  );
  const done = transactionDone(tx);
  try {
    tx.objectStore(STORE_NOTES).add(note);
    if (review !== undefined) tx.objectStore(STORE_STUDY_REVIEWS).add(review);
    const inkStore = tx.objectStore(STORE_KANJI_INK_ENTRIES);
    for (const entry of entries) inkStore.add(entry);
    await done;
  } catch (error) {
    await abortAndSettleTransaction(tx, done);
    throw error;
  }
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
