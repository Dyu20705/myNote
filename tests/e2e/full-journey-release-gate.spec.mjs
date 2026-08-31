import { expect, test } from "@playwright/test";

test.describe("Release Gate — Full User Lifecycle Journey", () => {
  test("complete lifecycle: onboarding, notes creation, formatting, Japanese study, review, theme customization, settings, and persistence", async ({ page }) => {
    await page.goto("/");

    // Dismiss tour if present
    const skipBtn = page.locator(".onboarding-skip");
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }

    // 1. Create a note with content
    const newNoteBtn = page.locator("#newNoteButton");
    await newNoteBtn.click();

    const titleInput = page.locator("#titleInput");
    await expect(titleInput).toBeVisible();
    await titleInput.fill("Release Gate Note");

    const contentInput = page.locator("#contentInput");
    await contentInput.fill("Testing release gate functionality with #japanese and #test tags.\n\n- [ ] Task 1");
    await page.keyboard.press("Control+Enter"); // Save
    const closeEditorBtn = page.locator("#closeNoteEditorButton");
    if (await closeEditorBtn.isVisible()) {
      await closeEditorBtn.click();
      await expect(page.locator("#noteEditorOverlay")).not.toBeVisible();
    }

    // 2. Open command palette and toggle dark/light theme
    await page.keyboard.press("Control+k");
    const paletteInput = page.locator("#commandInput");
    await paletteInput.fill("Toggle dark/light theme");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);

    // 3. Open Settings and verify tabs
    await page.keyboard.press("Control+k");
    await paletteInput.fill("Open settings");
    await page.keyboard.press("Enter");

    const settingsDialog = page.locator("#settingsDialog");
    await expect(settingsDialog).toBeVisible();

    const themesTab = page.locator("button[data-settings-tab='themes']");
    await themesTab.click();
    await expect(page.locator("#settingsPanelThemes")).toBeVisible();

    const japaneseTab = page.locator("button[data-settings-tab='japanese']");
    await japaneseTab.click();
    await expect(page.locator("#settingsPanelJapanese")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(settingsDialog).not.toBeVisible();

    // 4. Switch to Japanese Workspace
    const japaneseWorkspaceBtn = page.locator("#japaneseWorkspaceButton");
    await japaneseWorkspaceBtn.click();

    const dashboard = page.locator("#japaneseDashboard");
    await expect(dashboard).toBeAttached();
    const studyDetailsBtn = page.locator("#japaneseStudyDetailsToggle");
    if (await studyDetailsBtn.isVisible()) {
      await studyDetailsBtn.click();
    }

    // 5. Test Quick Study button if present
    const quickStudyBtn = page.locator("#quickStudy5Button");
    if (await quickStudyBtn.isVisible() && !await quickStudyBtn.isDisabled()) {
      await quickStudyBtn.click();
      const reviewDialog = page.locator("#reviewDialog");
      if (await reviewDialog.isVisible()) {
        const closeReviewBtn = page.locator("#closeReviewButton");
        await closeReviewBtn.click();
      }
    }

    // 6. Switch back to Notes workspace
    const notesWorkspaceBtn = page.locator("#notesWorkspaceButton");
    await notesWorkspaceBtn.click();

    // 7. Verify created note persisted and is in list
    const noteItem = page.locator(".note-card-title, .note-item-title").filter({ hasText: "Release Gate Note" });
    await expect(noteItem.first()).toBeVisible();

    // 8. Reload page to verify persistence across sessions
    await page.reload();

    const reloadedNote = page.locator(".note-card-title, .note-item-title").filter({ hasText: "Release Gate Note" });
    await expect(reloadedNote.first()).toBeVisible();
  });
});
