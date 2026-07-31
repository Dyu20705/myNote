import test from "node:test";
import assert from "node:assert/strict";
import { filterJapaneseNoteIds } from "../../core/japaneseFilters.js";

const notes = [
  { id: "vocab", createdAt: "2026-07-29T04:00:00.000Z" },
  { id: "kanji", createdAt: "2026-07-30T04:00:00.000Z" },
  { id: "grammar", createdAt: "2026-07-31T04:00:00.000Z" },
  { id: "broken", createdAt: "not-a-date" },
];

const reviews = [
  { noteId: "vocab", notebookType: "vocabulary" },
  { noteId: "kanji", notebookType: "kanji" },
  { noteId: "grammar", notebookType: "grammar" },
  { noteId: "ghost", notebookType: "grammar" },
];

test("returns search order unchanged when filters are empty", () => {
  const ids = ["grammar", "vocab", "kanji"];
  assert.deepEqual(filterJapaneseNoteIds({ ids, notes, reviews, filters: {} }), ids);
});

test("filters by an inclusive created-date range", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar", "kanji", "vocab", "broken"],
    notes,
    reviews,
    filters: { fromDate: "2026-07-30", toDate: "2026-07-31", notebookType: "all" },
  }), ["grammar", "kanji"]);
});

test("filters by notebook type", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar", "kanji", "vocab"],
    notes,
    reviews,
    filters: { notebookType: "kanji" },
  }), ["kanji"]);
});

test("combines date and notebook type without inventing missing metadata", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["grammar", "kanji", "vocab", "ghost", "missing"],
    notes,
    reviews,
    filters: { fromDate: "2026-07-30", toDate: "", notebookType: "grammar" },
  }), ["grammar"]);
});

test("type-only filtering excludes orphan review IDs", () => {
  assert.deepEqual(filterJapaneseNoteIds({
    ids: ["ghost", "grammar"],
    notes,
    reviews,
    filters: { notebookType: "grammar" },
  }), ["grammar"]);
});
