import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const UI_FILES = [
  new URL("../../ui/kanjiInkApp.js", import.meta.url),
  new URL("../../ui/kanjiInkView.js", import.meta.url),
  new URL("../../ui/kanjiInkImportCommand.js", import.meta.url),
];

test("Kanji UI depends on the application service, not IndexedDB or storage adapters", async () => {
  for (const url of UI_FILES) {
    const source = await readFile(url, "utf8");
    assert.doesNotMatch(source, /core\/storage\.js|openDatabase|indexedDB|IDBObjectStore/);
  }

  const view = await readFile(UI_FILES[1], "utf8");
  const importCommand = await readFile(UI_FILES[2], "utf8");
  assert.match(view, /core\/kanjiInkApplication\.js/);
  assert.match(importCommand, /core\/kanjiInkApplication\.js/);
});
