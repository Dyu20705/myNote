import { expect, test } from "@playwright/test";

test("edited synthetic note survives a save-triggered reload", async ({ page }) => {
  const title = "E2E synthetic title";
  const content = "E2E synthetic body";

  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("0 notes");
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill(title);
  await expect(page.locator("#saveState")).toHaveText("Unsaved");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await page.clock.install();
  await page.clock.pauseAt(Date.now());
  await page.locator("#contentInput").fill(content);
  await expect(page.locator("#saveState")).toHaveText("Unsaved");

  await page.locator("#contentInput").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await page.reload();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await page.locator("#noteList .note-item", { hasText: title }).click();
  await expect(page.locator("#titleInput")).toHaveValue(title);
  await expect(page.locator("#contentInput")).toHaveValue(content);
});