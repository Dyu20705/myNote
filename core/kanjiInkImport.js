import { validateKanjiExportBundle } from "./kanjiInkProjection.js";

const STORE_NOTES = "notes";
const STORE_KANJI_INK_ENTRIES = "kanjiInkEntries";

function createTransactionAbortError() {
  return new DOMException("IndexedDB transaction aborted.", "AbortError");
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

async function abortAndSettle(transaction, done) {
  try {
    transaction.abort();
  } catch {
    // IndexedDB can auto-abort before this catch path runs.
  }
  await done.catch(() => {});
}

export async function restoreKanjiExportBundleToDb(database, input) {
  const bundle = validateKanjiExportBundle(input);
  const transaction = database.transaction(
    [STORE_NOTES, STORE_KANJI_INK_ENTRIES],
    "readwrite",
  );
  const done = transactionDone(transaction);

  try {
    const noteStore = transaction.objectStore(STORE_NOTES);
    const inkStore = transaction.objectStore(STORE_KANJI_INK_ENTRIES);
    for (const note of bundle.notes) noteStore.add(note);
    for (const entry of bundle.kanjiInkEntries) inkStore.add(entry);
    await done;
    return {
      importedNotes: bundle.notes.length,
      importedKanjiInkEntries: bundle.kanjiInkEntries.length,
    };
  } catch (error) {
    await abortAndSettle(transaction, done);
    throw error;
  }
}
