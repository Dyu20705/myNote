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

test("editor-first shell has one semantic hierarchy with stable command-ready controls", async () => {
  const index = await source("index.html");

  assert.equal(index.match(/<header\b/g)?.length, 1);
  assert.match(index, /<header[^>]+id="applicationHeader"/);
  assert.equal(index.match(/<nav\b/g)?.length, 1);
  assert.match(index, /<nav[^>]+id="workspaceNavigation"[^>]+aria-label="Workspace"/);
  assert.match(index, /<aside[^>]+id="noteNavigationRegion"[^>]+aria-label="Note navigation"/);
  assert.equal(index.match(/<main\b/g)?.length, 1);
  assert.match(index, /<main[^>]+id="editorRegion"[^>]+aria-label="Editor"/);

  for (const id of [
    "notesWorkspaceButton",
    "japaneseWorkspaceButton",
    "searchInput",
    "newNoteButton",
    "refreshButton",
    "saveState",
  ]) {
    assert.match(index, new RegExp(`id="${id}"`));
  }

  assert.doesNotMatch(index, /id="metricsState"/);
  assert.doesNotMatch(index, /render:\d|worker:\d|autosave:\d|mem:\d/i);
});

test("shell refresh reuses the existing runtime and introduces no DOM coordination", async () => {
  const [app, japaneseApp] = await Promise.all([
    source("app.js"),
    source("japaneseApp.js"),
  ]);

  for (const factory of [
    "createStore",
    "createSearchClient",
    "createHistory",
    "createBacklinkIndex",
    "createNoteWorkspaceController",
  ]) {
    assert.equal(app.match(new RegExp(`${factory}\\s*\\(`, "g"))?.length, 1, `${factory} must have one owner`);
    assert.doesNotMatch(japaneseApp, new RegExp(`${factory}\\s*\\(`));
  }
  assert.equal(japaneseApp.match(/createJapaneseWorkspaceCoordinator\s*\(/g)?.length, 1);

  assert.match(app, /refreshButton\.addEventListener\("click"/);
  assert.match(app, /async function reconcileCurrentView\(\)/);
  assert.match(app, /await autosave\.flush\(\)/);
  assert.match(app, /await refreshSearch\(\)/);
  const searchInputBody = app.match(/els\.searchInput\.addEventListener\("input", \(event\) => \{[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.doesNotMatch(searchInputBody, /store\.setState/);
  const reconcileBody = app.match(/async function reconcileCurrentView\(\) \{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(reconcileBody, /location\.reload|dispatchEvent|\.click\s*\(|querySelector/);
  assert.doesNotMatch(app, /dispatchEvent\s*\(new (?:InputEvent|Event)/);
  assert.doesNotMatch(japaneseApp, /dispatchEvent\s*\(/);
  assert.doesNotMatch(japaneseApp, /MutationObserver|\.note-item|\.click\s*\(/);
});
