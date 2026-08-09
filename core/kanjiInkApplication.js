import { createKanjiInkController } from "./kanjiInkController.js";
import { restoreKanjiExportBundleToDb } from "./kanjiInkImport.js";
import {
  createKanjiExportBundle,
  createKanjiHumanReadableExport,
  projectNoteForKanjiSearch,
  serializeKanjiExportBundle,
} from "./kanjiInkProjection.js";
import { getActiveSearchClient } from "./searchClient.js";
import {
  addKanjiInkEntryToDb,
  deleteKanjiInkEntryFromDb,
  listKanjiInkEntriesFromDb,
  listNotesFromDb,
  openDatabase,
  putKanjiInkEntryToDb,
} from "./storage.js";

function requiredFunction(value, name) {
  if (typeof value !== "function") {
    const error = new TypeError(`KANJI_APPLICATION_DEPENDENCY_INVALID:${name}`);
    error.code = "KANJI_APPLICATION_DEPENDENCY_INVALID";
    throw error;
  }
  return value;
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function createKanjiInkApplication(dependencies) {
  const openDb = requiredFunction(dependencies?.openDatabase, "openDatabase");
  const listNotes = requiredFunction(dependencies?.listNotes, "listNotes");
  const listEntries = requiredFunction(dependencies?.listEntries, "listEntries");
  const addEntry = requiredFunction(dependencies?.addEntry, "addEntry");
  const updateEntry = requiredFunction(dependencies?.updateEntry, "updateEntry");
  const deleteEntry = requiredFunction(dependencies?.deleteEntry, "deleteEntry");
  const restoreImport = requiredFunction(dependencies?.restoreImport, "restoreImport");
  const createController = requiredFunction(dependencies?.createController, "createController");
  const projectNote = requiredFunction(dependencies?.projectNote, "projectNote");
  const getSearchClient = requiredFunction(dependencies?.getSearchClient, "getSearchClient");
  const createJsonBundle = requiredFunction(dependencies?.createJsonBundle, "createJsonBundle");
  const serializeJsonBundle = requiredFunction(
    dependencies?.serializeJsonBundle,
    "serializeJsonBundle",
  );
  const createMarkdown = requiredFunction(dependencies?.createMarkdown, "createMarkdown");

  async function withDatabase(operation) {
    const database = await openDb();
    try {
      return await operation(database);
    } finally {
      database.close();
    }
  }

  async function updateSearchProjection(note, entries) {
    if (!note) return;
    const searchClient = getSearchClient();
    if (!searchClient) return;
    await searchClient.upsert(projectNote(note, entries));
  }

  async function loadNoteContext(noteId) {
    const result = await withDatabase(async (database) => {
      const notes = await listNotes(database);
      const note = notes.find((candidate) => candidate.id === noteId) ?? null;
      const listing = await listEntries(database, noteId);
      return { note, ...listing };
    });
    await updateSearchProjection(result.note, result.entries);
    return result;
  }

  function createEntryController(existingEntry = null) {
    const schemaVersion = existingEntry && typeof existingEntry === "object"
      ? Object.getOwnPropertyDescriptor(existingEntry, "schemaVersion")?.value
      : undefined;
    if (schemaVersion === 1) throw codedError("KANJI_LEGACY_ENTRY_READ_ONLY");

    return createController({
      initialEntry: existingEntry,
      persist: async (entry) => withDatabase((database) => {
        if (!existingEntry) return addEntry(database, entry);
        return updateEntry(database, {
          ...entry,
          id: existingEntry.id,
          noteId: existingEntry.noteId,
          createdAt: existingEntry.createdAt,
        });
      }),
    });
  }

  async function collectExportData() {
    return withDatabase(async (database) => {
      const notes = await listNotes(database);
      const entries = [];
      for (const note of notes) {
        const listing = await listEntries(database, note.id);
        if (listing.invalidCount > 0) {
          const error = new Error("KANJI_EXPORT_INVALID_PERSISTED_ENTRY");
          error.code = "KANJI_EXPORT_INVALID_PERSISTED_ENTRY";
          throw error;
        }
        entries.push(...listing.entries);
      }
      return { notes, entries };
    });
  }

  return Object.freeze({
    loadNoteContext,
    createEntryController,
    deleteEntry: (id) => withDatabase((database) => deleteEntry(database, id)),
    restoreEntry: (entry) => withDatabase((database) => addEntry(database, entry)),
    async exportJson() {
      const { notes, entries } = await collectExportData();
      return {
        filename: "myNote-kanji-export.json",
        type: "application/json",
        content: serializeJsonBundle(createJsonBundle(notes, entries)),
      };
    },
    async exportMarkdown() {
      const { notes, entries } = await collectExportData();
      return {
        filename: "myNote-kanji-export.md",
        type: "text/markdown",
        content: createMarkdown(notes, entries),
      };
    },
    restoreBundle: (bundle) => withDatabase((database) => restoreImport(database, bundle)),
  });
}

export const kanjiInkApplication = createKanjiInkApplication({
  openDatabase,
  listNotes: listNotesFromDb,
  listEntries: listKanjiInkEntriesFromDb,
  addEntry: addKanjiInkEntryToDb,
  updateEntry: putKanjiInkEntryToDb,
  deleteEntry: deleteKanjiInkEntryFromDb,
  restoreImport: restoreKanjiExportBundleToDb,
  createController: createKanjiInkController,
  projectNote: projectNoteForKanjiSearch,
  getSearchClient: getActiveSearchClient,
  createJsonBundle: createKanjiExportBundle,
  serializeJsonBundle: serializeKanjiExportBundle,
  createMarkdown: createKanjiHumanReadableExport,
});
