import { expect, test } from "@playwright/test";

test("edited synthetic note survives a save-triggered reload", async ({ page }) => {
  const title = "E2E synthetic title";
  const content = "E2E synthetic body";

  await page.goto("/");
  await page.locator("#newNoteButton").click();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await expect(page.locator("#saveState")).toHaveText("Unsaved changes");

  await page.locator("#saveButton").click();
  await expect(page.locator("#saveState")).toHaveText("Saved locally");

  await page.reload();
  await expect(page.locator("#titleInput")).toHaveValue(title);
  await expect(page.locator("#contentInput")).toHaveValue(content);
});
