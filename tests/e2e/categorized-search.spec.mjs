import { test, expect } from "@playwright/test";

test.describe("Categorized Search Results (#132)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("categorizes search results into distinct sections for title, tag, and content matches", async ({ page }) => {
    // 1. Create note with title match
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await page.locator("#titleInput").fill("React Architecture");
    await page.locator("#contentInput").fill("Overview of component design.");
    await page.locator("#closeNoteEditorButton").click();
    await expect(page.locator("#noteEditorOverlay")).toBeHidden();

    // 2. Create note with tag match
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await page.locator("#titleInput").fill("Web Frontend");
    await page.locator("#contentInput").fill("Discussion with #react tag included.");
    await page.locator("#closeNoteEditorButton").click();
    await expect(page.locator("#noteEditorOverlay")).toBeHidden();

    // 3. Create note with content body match only
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await page.locator("#titleInput").fill("General Discussion");
    await page.locator("#contentInput").fill("We are using React for state management.");
    await page.locator("#closeNoteEditorButton").click();
    await expect(page.locator("#noteEditorOverlay")).toBeHidden();

    // Search for "React"
    const searchInput = page.locator("#searchInput");
    await searchInput.fill("React");

    // Wait for search result sections to render
    const noteBoard = page.locator("#noteList");
    await expect(noteBoard).toBeVisible();

    const headings = page.locator(".note-board-heading");
    const headingTexts = await headings.allTextContents();

    expect(headingTexts).toContain("TITLE MATCHES");
    expect(headingTexts).toContain("TAG MATCHES");
    expect(headingTexts).toContain("CONTENT MATCHES");

    // Verify correct cards under sections
    const titleSection = page.locator('.note-board-section[data-section-id="title"]');
    await expect(titleSection).toContainText("React Architecture");

    const tagSection = page.locator('.note-board-section[data-section-id="tags"]');
    await expect(tagSection).toContainText("Web Frontend");

    const contentSection = page.locator('.note-board-section[data-section-id="notes"]');
    await expect(contentSection).toContainText("General Discussion");

    // Clear search and verify standard section returns
    await searchInput.fill("");
    await expect(page.locator('.note-board-section[data-section-id="notes"]')).toBeVisible();
    await expect(page.locator('.note-board-section[data-section-id="title"]')).toBeHidden();
  });
});
