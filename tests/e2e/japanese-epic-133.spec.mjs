import { test, expect } from "@playwright/test";
import { createJapaneseNoteFromMenu, closeNoteEditor, openJapaneseStudyDetails } from "./japanese-helpers.mjs";

test.describe("Epic 133 Features", () => {
  test("Gamification, Daily Goals, and Quick Study integration", async ({ page }) => {
    test.setTimeout(60000); 
    await page.goto("/");

    await page.locator("#japaneseWorkspaceButton").click();
    await page.waitForFunction(() => window.document.querySelector("#japaneseWorkspaceButton")?.getAttribute("aria-pressed") === "true");

    await openJapaneseStudyDetails(page);
    await expect(page.locator("#gamificationXp")).toHaveText("0");
    await expect(page.locator("#gamificationStreak")).toHaveText("0");
    await expect(page.locator("#dailyGoalText")).toHaveText("0 / 50");

    // Configure daily goal
    await page.locator("#dailyGoalSettingsButton").click();
    await page.locator("#dailyGoalSettingsDialog").waitFor({ state: "visible" });
    await page.locator("#dailyGoalTargetInput").fill("10");
    await page.locator("#dailyGoalSettingsForm .primary-button").click();
    await page.locator("#dailyGoalSettingsDialog").waitFor({ state: "hidden" });
    
    await expect(page.locator("#dailyGoalText")).toHaveText("0 / 10");

    // Create notes
    for (let i = 0; i < 6; i++) {
      await createJapaneseNoteFromMenu(page, "Vocabulary");
      await page.locator("#titleInput").fill(`Test Vocab ${i}`);
      await page.locator("#contentInput").fill(`## Word\n語${i}\n`);
      await page.locator("#saveState").waitFor({ state: "visible" });
      await expect(page.locator("#saveState")).toHaveText("Saved");
      await closeNoteEditor(page);
    }
    
    await openJapaneseStudyDetails(page);

    await expect(page.locator("#japaneseReviewDueLabel")).toContainText("6 due");

    // Quick study
    await page.locator("#quickStudy5Button").click();
    const dialog = page.getByRole("dialog", { name: "Japanese review session" });
    await dialog.waitFor({ state: "visible" });
    
    await expect(page.locator("#reviewProgress")).toHaveText("Item 1 of 5");
    
    // Keyboard flip
    await page.keyboard.press("Space");
    await expect(page.locator("#reviewRatings")).toBeVisible();
    
    // Keyboard rate (1 = Again, 2 = Hard, 3 = Good, 4 = Easy)
    await page.keyboard.press("4"); // Easy
    await expect(page.locator("#reviewProgress")).toHaveText("Item 2 of 5");
    
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    
    await openJapaneseStudyDetails(page);
    
    await expect(page.locator("#gamificationXp")).toHaveText("15");
    await expect(page.locator("#gamificationStreak")).toHaveText("1");
    await expect(page.locator("#dailyGoalProgress")).toHaveAttribute("value", "1");
    await expect(page.locator("#dailyGoalText")).toHaveText("1 / 10");
  });

  test("Kanji canvas features (Guidance, Replay, Export)", async ({ page }) => {
    await page.goto("/");
    await page.locator("#japaneseWorkspaceButton").click();
    
    // Need a Japanese note to attach drawing to
    await createJapaneseNoteFromMenu(page, "Vocabulary");
    await page.locator("#titleInput").fill("Kanji Draw Test");
    await page.locator("#saveState").waitFor({ state: "visible" });
    await expect(page.locator("#saveState")).toHaveText("Saved");
    
    // Open kanji drawing dialog via Note Actions
    await page.locator("#noteActionsButton").click();
    await page.getByRole("menuitem", { name: /Add drawing/ }).click();
    
    await page.locator("#kanjiInkDialog").waitFor({ state: "visible" });
    
    const canvas = page.locator("#kanjiInkCanvas");
    const box = await canvas.boundingBox();
    
    // Draw a stroke
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 50);
    await page.mouse.up();
    
    // Test replay
    await page.locator("#replayKanjiButton").click();
    // Replay animates so we just check it doesn't crash
    await page.waitForTimeout(500); 
    
    // Test guidance
    await page.locator("#guidanceKanjiButton").click();
    
    // Since dialog uses escape to close, command palette might not be accessible?
    // Let's close the kanji dialog and then run the export command?
    // Wait, export kanji png needs the dialog open?
    // The command palette `>Export Kanji drawing as PNG`
    // Let's click the searchInput if possible. 
    // Wait! In V1, command palette can be accessed via `Meta+k`
    
    

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator("#exportKanjiPngButton").click()
    ]);
    expect(download.suggestedFilename()).toBe("kanji-export.png");
  });


});
