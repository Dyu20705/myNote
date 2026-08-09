import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth === globalThis.document.documentElement.clientWidth)).toBe(true);
}

async function openAndClose(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  await expect(page.locator("#noteActionsButton")).toBeFocused();
  await expectNoHorizontalOverflow(page);
}

test("repeated open and close retains one dialog, stylesheet, command, and bounded desktop layout", async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await openAndClose(page);
  }

  for (let iteration = 0; iteration < 17; iteration += 1) await openAndClose(page);
  await expect(page.locator("#kanjiInkDialog")).toHaveCount(1);
  await expect(page.locator('link[data-kanji-ink-styles="true"]')).toHaveCount(1);
  await page.locator("#noteActionsButton").click();
  await expect(page.getByRole("menuitem", { name: /Add Kanji handwriting/ })).toHaveCount(1);

  await page.keyboard.press("Escape");
  // A 1440×900 desktop at 200% browser zoom exposes a 720×450 CSS viewport.
  await page.setViewportSize({ width: 720, height: 450 });
  await openAndClose(page);
});
