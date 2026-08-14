import { expect, test } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4173";
const DEFERRED_DESTINATIONS = ["Reminders", "Labels", "Archive", "Trash"];
const FORBIDDEN_COMMAND_IDS = /^(reminders?|labels?|trash|analytics|attachments?|formatting|recognition)(\.|$)/i;

async function commandSnapshot(page) {
  return page.evaluate(async () => {
    const { commandRuntime } = await import("/app.js");
    return commandRuntime.snapshot();
  });
}

async function activeCanonicalNoteShape(page) {
  return page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const state = getActiveStore().getState();
    const note = state.notes.find((candidate) => candidate.id === state.activeId);
    return note ? Object.keys(note).sort() : [];
  });
}

test("release shell exposes only owner-backed navigation and bounded commands", async ({ page }) => {
  await page.goto("/");

  const workspace = page.getByRole("navigation", { name: "Workspace" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("button")).toHaveCount(2);
  await expect(workspace.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(workspace.getByRole("button", { name: "日本語", exact: true })).toHaveAttribute("aria-pressed", "false");

  for (const label of DEFERRED_DESTINATIONS) {
    await expect(workspace.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await expect(workspace.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }

  const refresh = page.getByRole("button", { name: "Refresh" });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect(workspace.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");

  const commands = await commandSnapshot(page);
  expect(commands.length).toBeGreaterThan(0);
  expect(commands.length).toBeLessThanOrEqual(128);
  expect(commands.some(({ id }) => id === "notes.archive")).toBe(true);
  expect(commands.map(({ id }) => id).filter((id) => FORBIDDEN_COMMAND_IDS.test(id))).toEqual([]);
  expect(commands.filter(({ available }) => !available).every(({ unavailableReason }) => (
    typeof unavailableReason === "string" && unavailableReason.trim().length > 0
  ))).toBe(true);
});

test("workspace transitions preserve ordinary context and keyboard return", async ({ page }) => {
  await page.goto("/");

  const search = page.locator("#searchInput");
  await search.fill("synthetic-release-query");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");

  const notes = page.locator("#notesWorkspaceButton");
  const japanese = page.locator("#japaneseWorkspaceButton");
  await notes.focus();
  await page.keyboard.press("Tab");
  await expect(japanese).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(japanese).toHaveAttribute("aria-pressed", "true");

  await japanese.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(notes).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(notes).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("synthetic-release-query");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");
});

for (const viewport of [
  { width: 1024, height: 768, label: "minimum desktop" },
  { width: 1280, height: 720, label: "wide desktop" },
  { width: 1440, height: 900, label: "reference desktop" },
  { width: 720, height: 450, label: "200 percent layout proxy" },
]) {
  test(`${viewport.label} keeps the document and primary actions contained`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "New note", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
}

test("saved-grid drawing stays local and outside canonical note content", async ({ page }) => {
  const externalRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== APP_ORIGIN) externalRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await page.locator("#titleInput").fill("Synthetic release note");
  await page.locator("#contentInput").fill("Synthetic content only");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: /Add drawing/ }).click();
  const dialog = page.getByRole("dialog", { name: "Draw Kanji" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Pen", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Marker", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Eraser", exact: true })).toBeVisible();
  await expect(page.locator("#recognizeKanjiButton, #kanjiCandidateList, #kanjiSelectedCharacter")).toHaveCount(0);

  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);

  const noteKeys = await activeCanonicalNoteShape(page);
  expect(noteKeys).not.toContain("strokes");
  expect(noteKeys).not.toContain("paperStyle");
  expect(externalRequests).toEqual([]);
});
