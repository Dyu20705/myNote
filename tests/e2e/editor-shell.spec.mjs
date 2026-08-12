import { expect, test } from "@playwright/test";
import { createJapaneseNoteFromMenu } from "./japanese-helpers.mjs";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
];

async function expectBoardInInitialViewport(page) {
  const geometry = await page.evaluate(() => {
    const navigation = globalThis.document.querySelector("#noteNavigationRegion").getBoundingClientRect();
    return {
      navigationTop: navigation.top,
      navigationBottom: navigation.bottom,
      documentWidth: globalThis.document.documentElement.scrollWidth,
      viewportWidth: globalThis.document.documentElement.clientWidth,
    };
  });

  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  expect(geometry.navigationTop).toBeGreaterThanOrEqual(0);
  expect(geometry.navigationBottom).toBeLessThanOrEqual(await page.evaluate(() => globalThis.innerHeight));
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
}

async function expectOpenOverlayBounded(page) {
  const geometry = await page.locator("#noteEditorOverlay").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      contentHeight: globalThis.document.querySelector("#contentInput").getBoundingClientRect().height,
      viewportWidth: globalThis.innerWidth,
      viewportHeight: globalThis.innerHeight,
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.contentHeight).toBeGreaterThanOrEqual(160);
}

for (const viewport of VIEWPORTS) {
  test(`board and centered overlay remain bounded in both workspaces at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#noteCount")).toHaveText("1 note");
    await expectBoardInInitialViewport(page);
    await page.locator("#noteList .note-item").first().click();
    await expectOpenOverlayBounded(page);
    await page.getByRole("button", { name: "Close note editor" }).click();

    await page.locator("#japaneseWorkspaceButton").click();
    await expect(page.locator("#japaneseWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
    await expectBoardInInitialViewport(page);
    await createJapaneseNoteFromMenu(page, "Create vocabulary note");
    await expectOpenOverlayBounded(page);
    await page.getByRole("button", { name: "Close note editor" }).click();

    const boundedSecondaryRegion = await page.locator("#noteNavigationRegion").evaluate((element) => ({
      overflowY: globalThis.getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(["auto", "scroll"]).toContain(boundedSecondaryRegion.overflowY);
    expect(boundedSecondaryRegion.scrollHeight).toBeGreaterThanOrEqual(boundedSecondaryRegion.clientHeight);
  });
}

test("shell exposes coherent application and editor-context landmarks without telemetry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Workspace" })).toHaveCount(1);
  await expect(page.getByRole("complementary", { name: "Note navigation" })).toHaveCount(1);
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  const card = page.locator("#noteList .note-item").first();
  await card.click();
  await expect(page.getByRole("dialog", { name: "Edit note" })).toBeVisible();
  await expect(page.getByRole("main", { name: "Editor" })).toHaveCount(1);
  await expect(page.locator("#editorContextHeader")).toBeVisible();
  await page.getByRole("button", { name: "Close note editor" }).click();

  const notes = page.locator("#notesWorkspaceButton");
  const japanese = page.locator("#japaneseWorkspaceButton");
  await expect(notes).toHaveRole("button");
  await expect(japanese).toHaveRole("button");
  await expect(notes).toHaveAccessibleName("Notes");
  await expect(japanese).toHaveAccessibleName("日本語");
  await expect(notes).toHaveAttribute("aria-pressed", "true");
  await expect(japanese).toHaveAttribute("aria-pressed", "false");

  const commandOrder = await page.evaluate(() => [
    "notesWorkspaceButton",
    "japaneseWorkspaceButton",
    "searchInput",
    "newNoteButton",
    "refreshButton",
  ].map((id) => globalThis.document.querySelector(`#${id}`)).map((element) => element?.id));
  expect(commandOrder).toEqual([
    "notesWorkspaceButton",
    "japaneseWorkspaceButton",
    "searchInput",
    "newNoteButton",
    "refreshButton",
  ]);

  await expect(page.locator("#metricsState")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/render:\d|search:\d|worker:\d|autosave:\d|mem:\d/i);
});

test("search shortcut and ordinary create remain truthful to the active workspace", async ({ page }) => {
  await page.goto("/");

  const search = page.locator("#searchInput");
  const editor = page.locator("#contentInput");
  const shortcut = page.locator(".search-box kbd");
  await expect(search).toHaveAccessibleName("Search notes");
  await expect(shortcut).toHaveText("/");
  await expect(shortcut).toHaveAttribute("aria-hidden", "true");

  const card = page.locator("#noteList .note-item").first();
  await card.click();
  await editor.focus();
  await page.keyboard.press("/");
  await expect(editor).toHaveValue("/");
  await expect(search).not.toBeFocused();
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(card).toBeFocused();

  await page.locator("#notesWorkspaceButton").focus();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();

  await page.locator("#japaneseWorkspaceButton").click();
  await expect(page.locator("#newNoteButton")).toBeHidden();
  await expect(page.getByRole("button", { name: "New Japanese note" })).toBeVisible();

  await page.locator("#notesWorkspaceButton").click();
  await expect(page.locator("#newNoteButton")).toBeVisible();
});

test("keyboard traversal includes editor context actions and reaches the shell deterministically", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#noteList .note-item").first();
  await card.click();
  await expect(page.locator("#titleInput")).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.locator("#pinNoteButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#detailsButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#noteActionsButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#closeNoteEditorButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#contentInput")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(card).toBeFocused();

  await page.locator("#notesWorkspaceButton").focus();
  await expect(page.locator("#notesWorkspaceButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#japaneseWorkspaceButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#searchInput")).toBeFocused();
  await expect.poll(() => page.locator(".search-box").evaluate((element) => (
    globalThis.getComputedStyle(element).borderTopColor
  ))).toBe("rgb(56, 189, 248)");
  await page.keyboard.press("Tab");
  await expect(page.locator("#newNoteButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#refreshButton")).toBeFocused();
});

test("shell controls remain functional through refresh, save, selection, search, palette, and Japanese create", async ({ page }) => {
  await page.goto("/");

  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill("Synthetic shell note");
  await page.locator("#contentInput").fill("Repository-safe editor shell evidence.");
  await expect(page.locator("#saveState")).toHaveText("Unsaved");
  await page.locator("#contentInput").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await page.getByRole("button", { name: "Close note editor" }).click();

  await page.locator("#searchInput").fill("Synthetic shell");
  await expect(page.locator("#noteList .note-item-title")).toContainText(["Synthetic shell note"]);
  await page.locator("#refreshButton").click();
  await expect(page.locator("#searchInput")).toHaveValue("Synthetic shell");

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.locator("#japaneseWorkspaceButton").click();
  await expect(page.locator("#japaneseWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect(page.locator("#titleInput")).toBeFocused();
});

test("rapid workspace switching preserves per-workspace query, selection, and the newest draft", async ({ page }) => {
  await page.goto("/");
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill("Newest synthetic draft");
  await page.locator("#contentInput").fill("This pending draft must survive rapid workspace transitions.");
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await page.locator("#searchInput").fill("Newest synthetic");

  const notes = page.locator("#notesWorkspaceButton");
  const japanese = page.locator("#japaneseWorkspaceButton");
  await japanese.click();
  await page.locator("#searchInput").fill("Japanese-only query");
  await notes.click();
  await japanese.click();
  await notes.click();

  await expect(notes).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#searchInput")).toHaveValue("Newest synthetic");
  await expect(page.locator("#titleInput")).toHaveValue("Newest synthetic draft");
  await expect(page.locator("#contentInput")).toHaveValue("This pending draft must survive rapid workspace transitions.");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await japanese.click();
  await expect(page.locator("#searchInput")).toHaveValue("Japanese-only query");
  await notes.click();
  await page.locator("#noteList .note-item", { hasText: "Newest synthetic draft" }).click();
  await expect(page.locator("#titleInput")).toHaveValue("Newest synthetic draft");
  await expect(page.locator("#contentInput")).toHaveValue("This pending draft must survive rapid workspace transitions.");
});
