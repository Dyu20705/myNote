import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("app is the single browser composition root for both workspaces", async () => {
  const [index, app, japaneseApp] = await Promise.all([
    source("index.html"),
    source("app.js"),
    source("japaneseApp.js"),
  ]);

  assert.match(index, /<script[^>]+src="app\.js"/);
  assert.doesNotMatch(index, /<script[^>]+src="japaneseApp\.js"/);
  assert.match(app, /createJapaneseApp\s*\(/);
  assert.match(japaneseApp, /export function createJapaneseApp/);
});

test("Japanese workspace refresh uses the injected workspace API instead of the DOM list bridge", async () => {
  const japaneseApp = await source("japaneseApp.js");

  assert.doesNotMatch(japaneseApp, /getActive(?:Store|SearchClient|CommandStack|History|BacklinkIndex)/);
  assert.doesNotMatch(japaneseApp, /dispatchEvent\s*\(/);
  assert.doesNotMatch(japaneseApp, /MutationObserver/);
  assert.doesNotMatch(japaneseApp, /\.note-item/);
  assert.doesNotMatch(japaneseApp, /\.click\s*\(/);
  assert.match(japaneseApp, /runtime\.workspace/);
});
