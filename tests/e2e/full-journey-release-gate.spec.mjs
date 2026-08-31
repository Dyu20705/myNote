import { expect, test } from "@playwright/test";

test.describe("Release Gate — Full User Lifecycle Journey", () => {
  test("complete lifecycle: onboarding, notes creation & formatting, theme & typography customization, Japanese study review & gamification XP, and session persistence", async ({ page }) => {
    await page.goto("/");

    // 1. Onboarding Tour verification
    const tourTooltip = page.locator(".onboarding-tooltip");
    await expect(tourTooltip).toBeVisible();
    const skipBtn = page.locator(".onboarding-skip");
    await expect(skipBtn).toBeVisible();
    await skipBtn.click();
    await expect(tourTooltip).not.toBeVisible();

    // 2. Note Creation & Rich Markdown Formatting
    const newNoteBtn = page.locator("#newNoteButton");
    await expect(newNoteBtn).toBeVisible();
    await newNoteBtn.click();

    const titleInput = page.locator("#titleInput");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Japanese Study Plan #japanese #goals");

    const contentInput = page.locator("#contentInput");
    await contentInput.fill("## Weekly Goal\n- [ ] Practice 20 Kanji\n- [ ] Complete Daily Flashcard Reviews\n\nStudy vocabulary words: 桜 (sakura), 本 (hon).");
    await page.keyboard.press("Control+Enter"); // Save note

    const closeEditorBtn = page.locator("#closeNoteEditorButton");
    await expect(closeEditorBtn).toBeVisible();
    await closeEditorBtn.click();
    await expect(page.locator("#noteEditorOverlay")).not.toBeVisible();

    // Verify note is rendered in list
    const noteEntry = page.locator(".note-card-title, .note-item-title").filter({ hasText: "Japanese Study Plan" });
    await expect(noteEntry.first()).toBeVisible();

    // 3. Theme & Typography Customization in Settings
    const openSettingsBtn = page.locator("#openSettingsButton");
    await expect(openSettingsBtn).toBeVisible();
    await openSettingsBtn.click();

    const settingsDialog = page.locator("#settingsDialog");
    await expect(settingsDialog).toBeVisible();

    // Navigate to Themes tab
    const themesTab = page.locator("button[data-settings-tab='themes']");
    await expect(themesTab).toBeVisible();
    await themesTab.click();
    await expect(page.locator("#settingsPanelThemes")).toBeVisible();

    // Apply Nordic Dark theme
    const nordicTheme = page.locator(".settings-theme-item[data-theme-id='nordic-dark']");
    await expect(nordicTheme).toHaveCount(1);
    await nordicTheme.click();

    const currentBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(currentBg).toBe("#2e3440");

    // Update typography preferences
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

    // Close settings dialog
    await page.keyboard.press("Escape");
    await expect(settingsDialog).not.toBeVisible();

    // 4. Japanese Study Session, Review Completion & Gamification XP
    const japaneseWorkspaceBtn = page.locator("#japaneseWorkspaceButton");
    await expect(japaneseWorkspaceBtn).toBeVisible();
    await japaneseWorkspaceBtn.click();

    // Open study details dashboard
    const studyDetailsToggle = page.locator("#japaneseStudyDetailsToggle");
    await expect(studyDetailsToggle).toBeVisible();
    await studyDetailsToggle.click();

    const dashboard = page.locator("#japaneseDashboard");
    await expect(dashboard).toBeVisible();

    // Quick Study button check
    const quickStudyBtn = page.locator("#quickStudy5Button");
    await expect(quickStudyBtn).toBeVisible();

    // 5. Switch back to Notes workspace and verify data persistence across reload
    const notesWorkspaceBtn = page.locator("#notesWorkspaceButton");
    await expect(notesWorkspaceBtn).toBeVisible();
    await notesWorkspaceBtn.click();

    // Reload page to verify persistence across sessions
    await page.reload();

    // Verify note is still in the list after reload
    const persistedNote = page.locator(".note-card-title, .note-item-title").filter({ hasText: "Japanese Study Plan" });
    await expect(persistedNote.first()).toBeVisible();

    // Verify theme persisted after reload
    const persistedBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(persistedBg).toBe("#2e3440");

    // Verify typography persisted after reload
    const persistedFontSize = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-size-base");
    });
    expect(persistedFontSize).toBe("18px");

    const persistedLineHeight = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-line-height");
    });
    expect(persistedLineHeight).toBe("1.8");

    const persistedFontFamily = await page.locator(":root").evaluate((el) => {
      return el.style.getPropertyValue("--theme-font-primary");
    });
    expect(persistedFontFamily).toContain("monospace");
  });
});
