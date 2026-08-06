import { expect, test } from "@playwright/test";

async function openAndClose(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
  await page.locator("#closeKanjiDialogButton").click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
}

test("repeated open and close retains one dialog, stylesheet, and command action", async ({ page }) => {
  await page.goto("/");

  for (let iteration = 0; iteration < 20; iteration += 1) {
    await openAndClose(page);
  }

  await expect(page.locator("#kanjiInkDialog")).toHaveCount(1);
  await expect(page.locator('link[data-kanji-ink-styles="true"]')).toHaveCount(1);

  await page.locator("#noteActionsButton").click();
  await expect(page.getByRole("menuitem", { name: /Add Kanji handwriting/ })).toHaveCount(1);
});
