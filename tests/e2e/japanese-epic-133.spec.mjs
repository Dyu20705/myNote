import { test, expect } from "@playwright/test";
import { createJapaneseNoteFromMenu, closeNoteEditor, openJapaneseStudyDetails } from "./japanese-helpers.mjs";

test.describe("Epic 133 Features", () => {
  test("Gamification, Daily Goals, and Quick Study integration", async ({ page }) => {
    test.setTimeout(60000); // Allow more time for creating 6 notes
    await page.goto("http://127.0.0.1:4180/");

    await page.locator("#japaneseWorkspaceButton").click();
    // eslint-disable-next-line no-undef
    await page.waitForFunction(() => window.document.querySelector("#japaneseWorkspaceButton")?.getAttribute("aria-pressed") === "true");

    await openJapaneseStudyDetails(page);
    await expect(page.locator("#gamificationXp")).toHaveText("0");
    await expect(page.locator("#gamificationStreak")).toHaveText("0");

    for (let i = 0; i < 6; i++) {
      await createJapaneseNoteFromMenu(page, "Vocabulary");
      await page.locator("#titleInput").fill(`Test Vocab ${i}`);
      await page.locator("#contentInput").fill(`## Word\n語${i}\n`);
      await page.locator("#saveState").waitFor({ state: "visible" });
      await expect(page.locator("#saveState")).toHaveText("Saved");
      await closeNoteEditor(page);
    }
    
    await openJapaneseStudyDetails(page); // Re-open because menu switches might close it

    await expect(page.locator("#japaneseReviewDueLabel")).toContainText("6 due");

    await page.locator("#quickStudy5Button").click();
    await page.getByRole("dialog", { name: "Japanese review session" }).waitFor({ state: "visible" });
    
    await expect(page.locator("#reviewProgress")).toHaveText("Item 1 of 5");
    
    await page.getByRole("button", { name: "Reveal review content" }).click();
    await page.getByRole("button", { name: "Easy" }).click();
    
    await expect(page.locator("#reviewProgress")).toHaveText("Item 2 of 5");

    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Japanese review session" }).waitFor({ state: "hidden" });
    
    await openJapaneseStudyDetails(page);
    
    await expect(page.locator("#gamificationXp")).toHaveText("15");
    await expect(page.locator("#gamificationStreak")).toHaveText("1");
    await expect(page.locator("#dailyGoalProgress")).toHaveValue("1");
  });
});
