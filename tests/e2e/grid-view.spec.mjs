import { test, expect } from "@playwright/test";

test.describe("Grid View & View Mode Switcher (#131)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("switches between list and grid view with accessible button states", async ({ page }) => {
    const viewModeButton = page.locator("#viewModeButton");
    const noteList = page.locator("#noteList");

    await expect(noteList).toHaveAttribute("data-view-mode", "list");
    await expect(viewModeButton).toHaveText("Grid view");
    await expect(viewModeButton).toHaveAttribute("aria-label", "Switch to grid view");

    await viewModeButton.click();
    await expect(noteList).toHaveAttribute("data-view-mode", "grid");
    await expect(viewModeButton).toHaveText("List view");
    await expect(viewModeButton).toHaveAttribute("aria-label", "Switch to list view");

    await viewModeButton.click();
    await expect(noteList).toHaveAttribute("data-view-mode", "list");
    await expect(viewModeButton).toHaveText("Grid view");
    await expect(viewModeButton).toHaveAttribute("aria-label", "Switch to grid view");
  });

  test("opens card in grid view", async ({ page }) => {
    // Create first note
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await page.locator("#titleInput").fill("First Grid Note");
    await page.locator("#contentInput").fill("Body content for grid testing.");
    await page.locator("#closeNoteEditorButton").click();
    await expect(page.locator("#noteEditorOverlay")).toBeHidden();

    // Switch to Grid View
    const viewModeButton = page.locator("#viewModeButton");
    await viewModeButton.click();
    await expect(page.locator("#noteList")).toHaveAttribute("data-view-mode", "grid");

    // Click note item card
    const card = page.locator(".note-item").filter({ hasText: "First Grid Note" });
    await card.click();

    // Verify editor opens with correct content
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();
    await expect(page.locator("#titleInput")).toHaveValue("First Grid Note");
  });

  test("persists view mode preference across reloads", async ({ page }) => {
    const viewModeButton = page.locator("#viewModeButton");
    const noteList = page.locator("#noteList");

    await viewModeButton.click();
    await expect(noteList).toHaveAttribute("data-view-mode", "grid");

    // Wait a brief tick for IndexedDB settings put
    await page.waitForTimeout(300);

    // Reload page
    await page.reload();

    await expect(page.locator("#noteList")).toHaveAttribute("data-view-mode", "grid");
    await expect(page.locator("#viewModeButton")).toHaveText("List view");
  });

  test("supports 2D keyboard navigation across grid cards", async ({ page }) => {
    // Create three notes
    for (const title of ["Card Alpha", "Card Beta", "Card Gamma"]) {
      await page.getByRole("button", { name: "New note", exact: true }).first().click();
      await page.locator("#titleInput").fill(title);
      await page.locator("#closeNoteEditorButton").click();
      await expect(page.locator("#noteEditorOverlay")).toBeHidden();
    }

    // Switch to grid view
    await page.locator("#viewModeButton").click();
    await expect(page.locator("#noteList")).toHaveAttribute("data-view-mode", "grid");

    const cards = page.locator(".note-item");
    await expect(cards).toHaveCount(3);

    // Focus first card
    await cards.first().focus();
    await expect(cards.first()).toBeFocused();

    // Press ArrowRight or ArrowDown to move to next card
    await page.keyboard.press("ArrowRight");
    await expect(cards.nth(1)).toBeFocused();

    // Press ArrowRight to move to third card
    await page.keyboard.press("ArrowRight");
    await expect(cards.nth(2)).toBeFocused();

    // Press ArrowLeft to move back to second card
    await page.keyboard.press("ArrowLeft");
    await expect(cards.nth(1)).toBeFocused();

    // Press Enter on focused card to open editor
    await page.keyboard.press("Enter");
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  });
});
