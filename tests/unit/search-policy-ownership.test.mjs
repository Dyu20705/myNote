import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Japanese search filtering uses the policy API instead of replacing searchClient.query", async () => {
  const [japaneseApp, filterController] = await Promise.all([
    source("ui/japaneseApp.js"),
    source("ui/japanese-filters.js"),
  ]);

  assert.doesNotMatch(japaneseApp, /searchClient\.query\s*=/);
  assert.match(japaneseApp, /searchClient\.registerResultPolicy\(japaneseNoteFilter\)/);
  assert.doesNotMatch(filterController, /getActive(?:SearchClient|Store)/);
});

test("Japanese filter controller is composed through the single application entrypoint", async () => {
  const [index, app, japaneseApp] = await Promise.all([
    source("index.html"),
    source("app.js"),
    source("ui/japaneseApp.js"),
  ]);

  assert.doesNotMatch(index, /<script[^>]+src="japaneseApp\.js"/);
  assert.match(index, /<script[^>]+src="app\.js"/);
  assert.match(app, /import \{ createJapaneseApp \} from "\.\/ui\/japaneseApp\.js"/);
  assert.match(japaneseApp, /createJapaneseFilterController\s*\(/);
});
