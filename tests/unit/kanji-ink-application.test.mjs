import assert from "node:assert/strict";
import test from "node:test";

import { createKanjiInkApplication } from "../../core/kanjiInkApplication.js";

function makeEntry(overrides = {}) {
  return {
    id: "ink-1",
    noteId: "note-1",
    schemaVersion: 1,
    revision: 1,
    character: "人",
    strokes: [[{ x: 0.5, y: 0.1 }, { x: 0.2, y: 0.9 }]],
    recognizer: {
      engineId: "test-engine",
      engineVersion: "1",
      datasetVersion: "test-data",
      selectedRank: 0,
    },
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    ...overrides,
  };
}

function makeDependencies() {
  const calls = [];
  const database = { close: () => calls.push("close") };
  const notes = [{ id: "note-1", title: "Note", content: "Body" }];
  const entries = [makeEntry()];
  return {
    calls,
    database,
    notes,
    entries,
    dependencies: {
      openDatabase: async () => {
        calls.push("open");
        return database;
      },
      listNotes: async (db) => {
        assert.equal(db, database);
        calls.push("list-notes");
        return notes;
      },
      listEntries: async (db, noteId) => {
        assert.equal(db, database);
        assert.equal(noteId, "note-1");
        calls.push("list-entries");
        return { entries, invalidCount: 0 };
      },
      addEntry: async (db, entry) => {
        assert.equal(db, database);
        calls.push("add");
        return entry;
      },
      updateEntry: async (db, entry) => {
        assert.equal(db, database);
        calls.push("update");
        return entry;
      },
      deleteEntry: async (db, id) => {
        assert.equal(db, database);
        calls.push(`delete:${id}`);
        return entries[0];
      },
      restoreImport: async (db, bundle) => {
        assert.equal(db, database);
        calls.push(`import:${bundle.schemaVersion}`);
        return { importedNotes: 1, importedKanjiInkEntries: 1 };
      },
      recognize: () => [{ character: "人", score: 1 }],
      createController: (options) => options,
      projectNote: (note, noteEntries) => ({
        ...note,
        searchBlob: `${note.title} ${noteEntries.map((entry) => entry.character).join(" ")}`,
      }),
      getSearchClient: () => ({
        upsert: async (note) => calls.push(`search:${note.searchBlob}`),
      }),
      createJsonBundle: (allNotes, allEntries) => ({
        schemaVersion: 3,
        notes: allNotes,
        kanjiInkEntries: allEntries,
      }),
      createMarkdown: () => "# export\n",
    },
  };
}

test("application service owns database lifetime and search projection", async () => {
  const fixture = makeDependencies();
  const application = createKanjiInkApplication(fixture.dependencies);

  const result = await application.loadNoteContext("note-1");
  assert.deepEqual(result, {
    note: fixture.notes[0],
    entries: fixture.entries,
    invalidCount: 0,
  });
  assert.deepEqual(fixture.calls, [
    "open",
    "list-notes",
    "list-entries",
    "close",
    "search:Note 人",
  ]);
});

test("controller persistence is selected-rank aware and hides storage from UI", async () => {
  const fixture = makeDependencies();
  const application = createKanjiInkApplication(fixture.dependencies);
  const createOptions = application.createEntryController();
  const editOptions = application.createEntryController(fixture.entries[0]);

  assert.deepEqual(createOptions.initialStrokes, []);
  assert.deepEqual(createOptions.recognize([]), [{ character: "人", score: 1 }]);
  const created = makeEntry({ id: "created" });
  assert.deepEqual(await createOptions.persist(created), created);

  assert.deepEqual(editOptions.initialStrokes, fixture.entries[0].strokes);
  const edited = makeEntry({ revision: 1, character: "木" });
  const persisted = await editOptions.persist(edited);
  assert.equal(persisted.id, "ink-1");
  assert.equal(persisted.revision, 2);
  assert.equal(persisted.createdAt, fixture.entries[0].createdAt);
  assert.deepEqual(fixture.calls, ["open", "add", "close", "open", "update", "close"]);
});

test("delete, restore, export, and import remain atomic service operations", async () => {
  const fixture = makeDependencies();
  const application = createKanjiInkApplication(fixture.dependencies);

  assert.deepEqual(await application.deleteEntry("ink-1"), fixture.entries[0]);
  assert.deepEqual(await application.restoreEntry(fixture.entries[0]), fixture.entries[0]);
  assert.deepEqual(await application.exportJson(), {
    filename: "myNote-kanji-export.json",
    type: "application/json",
    content: JSON.stringify({
      schemaVersion: 3,
      notes: fixture.notes,
      kanjiInkEntries: fixture.entries,
    }, null, 2),
  });
  assert.deepEqual(await application.exportMarkdown(), {
    filename: "myNote-kanji-export.md",
    type: "text/markdown",
    content: "# export\n",
  });
  assert.deepEqual(await application.restoreBundle({ schemaVersion: 3 }), {
    importedNotes: 1,
    importedKanjiInkEntries: 1,
  });
  assert.equal(fixture.calls.filter((item) => item === "open").length, 5);
  assert.equal(fixture.calls.filter((item) => item === "close").length, 5);
});
