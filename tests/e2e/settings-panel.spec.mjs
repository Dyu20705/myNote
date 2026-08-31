import { expect, test } from "@playwright/test";

test.describe("Settings Panel UI and Tabs", () => {
  test("opens via command palette, navigates tabs, previews and applies themes, configures daily goals, and closes", async ({ page }) => {
    await page.goto("/");

    // Dismiss tour if present
    const skipBtn = page.locator(".onboarding-skip");
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    // 1. Open Command Palette (Ctrl+K)
    await page.keyboard.press("Control+k");
    const paletteInput = page.locator("#commandInput");
    await expect(paletteInput).toBeFocused();

    // 2. Search and open Settings
    await paletteInput.fill("Open settings");
    const settingsCommand = page.locator(".command-item").filter({ hasText: "Open settings" });
    await expect(settingsCommand).toBeVisible();
    await page.keyboard.press("Enter");

    // 3. Verify Settings Dialog is open
    const dialog = page.locator("#settingsDialog");
    await expect(dialog).toBeVisible();

    // 4. Verify General tab is active by default
    const generalPanel = page.locator("#settingsPanelGeneral");
    await expect(generalPanel).toBeVisible();

    // 5. Navigate to Themes tab
    const themesTab = page.locator("button[data-settings-tab='themes']");
    await themesTab.click();

    const themesPanel = page.locator("#settingsPanelThemes");
    await expect(themesPanel).toBeVisible();
    await expect(generalPanel).not.toBeVisible();

    // 6. Verify themes list rendered with built-in themes
    const themeItems = page.locator(".settings-theme-item");
    await expect(themeItems.first()).toBeVisible();
    const count = await themeItems.count();
    expect(count).toBeGreaterThan(0);

    // 7. Select a theme from settings
    const nordicTheme = page.locator(".settings-theme-item[data-theme-id='nordic-dark']");
    if (await nordicTheme.count() > 0) {
      await nordicTheme.click();
      const currentBg = await page.locator(":root").evaluate((el) => {
        return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
      });
      expect(currentBg).toBe("#2e3440");
    }

    // 8. Navigate to Japanese Learning tab
    const japaneseTab = page.locator("button[data-settings-tab='japanese']");
    await japaneseTab.click();

    const japanesePanel = page.locator("#settingsPanelJapanese");
    await expect(japanesePanel).toBeVisible();

    // 9. Verify daily goals inputs
    const reviewsInput = page.locator("#settingsTargetReviews");
    await expect(reviewsInput).toBeVisible();
    await reviewsInput.fill("60");
    const saveGoalsBtn = page.locator("#settingsSaveGoals");
    await saveGoalsBtn.click();

    // 10. Close settings with Escape
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
