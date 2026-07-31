import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Japanese search filtering uses the policy API instead of replacing searchClient.query", async () => {
  const [japaneseApp, filterController] = await Promise.all([
    source("japaneseApp.js"),
    source("ui/japanese-filters.js"),
  ]);

  assert.doesNotMatch(japaneseApp, /searchClient\.query\s*=/);
  assert.match(japaneseApp, /searchClient\.registerResultPolicy\(japaneseNoteFilter\)/);
  assert.doesNotMatch(filterController, /getActive(?:SearchClient|Store)/);
});

test("Japanese filter controller is composed by japaneseApp rather than a standalone entrypoint", async () => {
  const index = await source("index.html");
  assert.doesNotMatch(index, /<script[^>]+src="ui\/japanese-filters\.js"/);
  assert.match(index, /<script[^>]+src="japaneseApp\.js"/);
});
