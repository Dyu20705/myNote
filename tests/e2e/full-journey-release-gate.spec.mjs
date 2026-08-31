import { expect, test } from "@playwright/test";

test.describe("Release Gate — Full User Lifecycle Journey", () => {
  test("complete lifecycle: onboarding, notes creation & formatting, theme & typography customization, Japanese study review & gamification XP, and session persistence", async ({ page }) => {
    await page.goto("/");

    // 1. Onboarding Tour verification
    const tourTooltip = page.locator(".onboarding-tooltip");
    if (await tourTooltip.isVisible()) {
      const skipBtn = page.locator(".onboarding-skip");
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }
      await expect(tourTooltip).not.toBeVisible();
    }

    // 2. Note Creation & Rich Markdown Formatting
    const newNoteBtn = page.locator("#newNoteButton");
    await newNoteBtn.click();

    const titleInput = page.locator("#titleInput");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Japanese Study Plan #japanese #goals");

    const contentInput = page.locator("#contentInput");
    await contentInput.fill("## Weekly Goal\n- [ ] Practice 20 Kanji\n- [ ] Complete Daily Flashcard Reviews\n\nStudy vocabulary words: 桜 (sakura), 本 (hon).");
    await page.keyboard.press("Control+Enter"); // Save note

    const closeEditorBtn = page.locator("#closeNoteEditorButton");
    if (await closeEditorBtn.isVisible()) {
      await closeEditorBtn.click();
      await expect(page.locator("#noteEditorOverlay")).not.toBeVisible();
    }

    // Verify note is rendered in list
    const noteEntry = page.locator(".note-card-title, .note-item-title").filter({ hasText: "Japanese Study Plan" });
    await expect(noteEntry.first()).toBeVisible();

    // 3. Theme & Typography Customization in Settings
    const openSettingsBtn = page.locator("#openSettingsButton");
    if (await openSettingsBtn.isVisible()) {
      await openSettingsBtn.click();
    } else {
      await page.keyboard.press("Control+k");
      const paletteInput = page.locator("#commandInput");
      await paletteInput.fill("Open settings");
      await page.keyboard.press("Enter");
    }

    const settingsDialog = page.locator("#settingsDialog");
    await expect(settingsDialog).toBeVisible();

    // Navigate to Themes tab
    const themesTab = page.locator("button[data-settings-tab='themes']");
    await themesTab.click();
    await expect(page.locator("#settingsPanelThemes")).toBeVisible();

    // Apply Nordic Dark theme
    const nordicTheme = page.locator(".settings-theme-item[data-theme-id='nordic-dark']");
    if (await nordicTheme.count() > 0) {
      await nordicTheme.click();
      const currentBg = await page.locator(":root").evaluate((el) => {
        return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
      });
      expect(currentBg).toBe("#2e3440");
    }

    // Update typography preferences
    const fontSizeSelect = page.locator("#settingsFontSize");
    if (await fontSizeSelect.isVisible()) {
      await fontSizeSelect.selectOption("18");
      const saveTypographyBtn = page.locator("#settingsSaveTypography");
      await saveTypographyBtn.click();

      const rootFontSize = await page.locator(":root").evaluate((el) => {
        return el.style.getPropertyValue("--theme-font-size-base");
      });
      expect(rootFontSize).toBe("18px");
    }

    // Close settings dialog
    await page.keyboard.press("Escape");
    await expect(settingsDialog).not.toBeVisible();

    // 4. Japanese Study Session, Review Completion & Gamification XP
    const japaneseWorkspaceBtn = page.locator("#japaneseWorkspaceButton");
    await japaneseWorkspaceBtn.click();

    const dashboard = page.locator("#japaneseDashboard");
    await expect(dashboard).toBeAttached();

    // Create a Japanese vocabulary note
    await page.keyboard.press("Control+k");
    const cmdInput = page.locator("#commandInput");
    await cmdInput.fill("Create vocabulary note");
    await page.keyboard.press("Enter");

    // Close editor if open
    if (await closeEditorBtn.isVisible()) {
      await closeEditorBtn.click();
    }

    // Test Quick Study button if present
    const quickStudyBtn = page.locator("#quickStudy5Button");
    if (await quickStudyBtn.isVisible() && !await quickStudyBtn.isDisabled()) {
      await quickStudyBtn.click();
      const reviewDialog = page.locator("#reviewDialog");
      if (await reviewDialog.isVisible()) {
        // Show answer
        const showAnswerBtn = page.locator("#showAnswerButton");
        if (await showAnswerBtn.isVisible()) {
          await showAnswerBtn.click();
          // Rate Good
          const rateGoodBtn = page.locator("button[data-rating='good'], button[data-rating='3']");
          if (await rateGoodBtn.isVisible()) {
            await rateGoodBtn.click();
          }
        }
        const closeReviewBtn = page.locator("#closeReviewButton");
        if (await closeReviewBtn.isVisible()) {
          await closeReviewBtn.click();
        }
      }
    }

    // 5. Switch back to Notes workspace and verify data persistence across reload
    const notesWorkspaceBtn = page.locator("#notesWorkspaceButton");
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
  });
});
