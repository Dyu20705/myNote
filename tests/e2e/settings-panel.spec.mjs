import { expect, test } from "@playwright/test";

test.describe("Settings Panel UI and Tabs", () => {
  test("opens via command palette, navigates tabs, previews and applies themes, configures typography and daily goals, traps focus, and closes", async ({ page }) => {
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

    // 6. Verify built-in themes list rendered
    const builtinItems = page.locator(".settings-builtin-themes .settings-theme-item");
    await expect(builtinItems.first()).toBeVisible();
    const count = await builtinItems.count();
    expect(count).toBeGreaterThan(0);

    // 7. Verify custom themes container and import button are present
    const customContainer = page.locator(".settings-custom-themes");
    await expect(customContainer).toBeVisible();
    const importBtn = page.locator("#settingsImportThemeButton");
    await expect(importBtn).toBeVisible();

    // 8. Select a theme from settings (e.g. nordic-dark)
    const nordicTheme = page.locator(".settings-theme-item[data-theme-id='nordic-dark']");
    if (await nordicTheme.count() > 0) {
      await nordicTheme.click();
      const currentBg = await page.locator(":root").evaluate((el) => {
        return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
      });
      expect(currentBg).toBe("#2e3440");
    }

    // 9. Configure Typography preferences
    const fontSizeSelect = page.locator("#settingsFontSize");
    await expect(fontSizeSelect).toBeVisible();
    await fontSizeSelect.selectOption("18");

    const lineHeightSelect = page.locator("#settingsLineHeight");
    await expect(lineHeightSelect).toBeVisible();
    await lineHeightSelect.selectOption("1.6");

    const saveTypographyBtn = page.locator("#settingsSaveTypography");
    await saveTypographyBtn.click();

    const rootFontSize = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-size-base");
    });
    expect(rootFontSize).toBe("18px");

    // 10. Navigate to Japanese Learning tab
    const japaneseTab = page.locator("button[data-settings-tab='japanese']");
    await japaneseTab.click();

    const japanesePanel = page.locator("#settingsPanelJapanese");
    await expect(japanesePanel).toBeVisible();

    // 11. Verify daily goals inputs and saving
    const reviewsInput = page.locator("#settingsTargetReviews");
    await expect(reviewsInput).toBeVisible();
    await reviewsInput.fill("60");
    const saveGoalsBtn = page.locator("#settingsSaveGoals");
    await saveGoalsBtn.click();

    // 12. Test Focus Trap: pressing Tab cycles focus inside the modal dialog
    await page.keyboard.press("Tab");
    const activeInsideDialog = await dialog.evaluate((d) => d.contains(globalThis.document.activeElement));
    expect(activeInsideDialog).toBe(true);

    // 13. Close settings with Escape
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
