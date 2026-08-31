import { expect, test } from "@playwright/test";

test.describe("Command Palette Extensions", () => {
  test("palette lists extended commands and executes them", async ({ page }) => {
    await page.goto("/");

    // Dismiss tour if present
    const skipBtn = page.locator(".onboarding-skip");
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    // 1. Open Command Palette
    await page.keyboard.press("Control+k");
    const paletteInput = page.locator("#commandInput");
    await expect(paletteInput).toBeFocused();

    // 2. Search for dark/light toggle
    await paletteInput.fill("Toggle dark");
    const toggleCmd = page.locator(".command-item").filter({ hasText: "Toggle dark/light theme" });
    await expect(toggleCmd).toBeVisible();

    // 3. Execute dark/light toggle
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    // 4. Verify theme toggled
    const bg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(bg).toBeDefined();

    // 5. Open palette and search for settings
    await page.keyboard.press("Control+k");
    await paletteInput.fill("Open settings");
    const settingsCmd = page.locator(".command-item").filter({ hasText: "Open settings" });
    await expect(settingsCmd).toBeVisible();
    await page.keyboard.press("Enter");

    const settingsDialog = page.locator("#settingsDialog");
    await expect(settingsDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settingsDialog).not.toBeVisible();
  });
});
