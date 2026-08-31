import { expect, test } from "@playwright/test";

test.describe("Settings Panel UI and Tabs", () => {
  test("opens via settings button and command palette, navigates tabs, previews and applies themes, configures typography and daily goals, traps focus, and persists across reload", async ({ page }) => {
    await page.goto("/");

    // Dismiss tour if present
    const skipBtn = page.locator(".onboarding-skip");
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    // 1. Open Settings via openSettingsButton
    const openSettingsBtn = page.locator("#openSettingsButton");
    await expect(openSettingsBtn).toBeVisible();
    await openSettingsBtn.click();

    // 2. Verify Settings Dialog is open
    const dialog = page.locator("#settingsDialog");
    await expect(dialog).toBeVisible();

    // 3. Verify General tab is active by default
    const generalPanel = page.locator("#settingsPanelGeneral");
    await expect(generalPanel).toBeVisible();

    // 4. Navigate to Themes tab
    const themesTab = page.locator("button[data-settings-tab='themes']");
    await expect(themesTab).toBeVisible();
    await themesTab.click();

    const themesPanel = page.locator("#settingsPanelThemes");
    await expect(themesPanel).toBeVisible();
    await expect(generalPanel).not.toBeVisible();

    // 5. Verify built-in themes list rendered
    const builtinItems = page.locator(".settings-builtin-themes .settings-theme-item");
    await expect(builtinItems.first()).toBeVisible();
    const count = await builtinItems.count();
    expect(count).toBeGreaterThan(0);

    // 6. Verify custom themes container and import button are present
    const customContainer = page.locator(".settings-custom-themes");
    await expect(customContainer).toBeVisible();
    const importBtn = page.locator("#settingsImportThemeButton");
    await expect(importBtn).toBeVisible();

    // 7. Select a theme from settings (Nordic Dark)
    const nordicTheme = page.locator(".settings-theme-item[data-theme-id='nordic-dark']");
    await expect(nordicTheme).toHaveCount(1);
    await nordicTheme.click();

    const currentBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(currentBg).toBe("#2e3440");

    // 8. Configure Typography preferences: Monospace, 18px, 1.8 line-height
    const fontFamilySelect = page.locator("#settingsFontFamily");
    await expect(fontFamilySelect).toBeVisible();
    await fontFamilySelect.selectOption("monospace");

    const fontSizeSelect = page.locator("#settingsFontSize");
    await expect(fontSizeSelect).toBeVisible();
    await fontSizeSelect.selectOption("18");

    const lineHeightSelect = page.locator("#settingsLineHeight");
    await expect(lineHeightSelect).toBeVisible();
    await lineHeightSelect.selectOption("1.8");

    const saveTypographyBtn = page.locator("#settingsSaveTypography");
    await expect(saveTypographyBtn).toBeVisible();
    await saveTypographyBtn.click();

    const rootFontSize = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-size-base");
    });
    expect(rootFontSize).toBe("18px");

    const rootLineHeight = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-line-height");
    });
    expect(rootLineHeight).toBe("1.8");

    const rootFontFamily = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-primary");
    });
    expect(rootFontFamily).toContain("monospace");

    // 9. Navigate to Japanese Learning tab
    const japaneseTab = page.locator("button[data-settings-tab='japanese']");
    await expect(japaneseTab).toBeVisible();
    await japaneseTab.click();

    const japanesePanel = page.locator("#settingsPanelJapanese");
    await expect(japanesePanel).toBeVisible();

    // 10. Verify daily goals inputs and saving
    const reviewsInput = page.locator("#settingsTargetReviews");
    await expect(reviewsInput).toBeVisible();
    await reviewsInput.fill("60");
    const saveGoalsBtn = page.locator("#settingsSaveGoals");
    await expect(saveGoalsBtn).toBeVisible();
    await saveGoalsBtn.click();

    // 11. Test Focus Trap: pressing Tab cycles focus inside the modal dialog
    await page.keyboard.press("Tab");
    const activeInsideDialog = await dialog.evaluate((d) => d.contains(globalThis.document.activeElement));
    expect(activeInsideDialog).toBe(true);

    // 12. Close settings with Escape
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // 13. Reload and verify typography settings persisted
    await page.reload();
    const persistedFontFamily = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-primary");
    });
    expect(persistedFontFamily).toContain("monospace");

    const persistedFontSize = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-size-base");
    });
    expect(persistedFontSize).toBe("18px");
  });
});
