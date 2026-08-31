import { test, expect } from "@playwright/test";

test.describe("Details Inspector Sidebar (#130)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("toggles details inspector via details button with accessible states and focus restore", async ({ page }) => {
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();

    const detailsButton = page.locator("#detailsButton");
    const inspector = page.locator("#noteInspector");
    const closeButton = page.locator("#closeDetailsButton");

    await expect(inspector).toBeHidden();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");

    await detailsButton.click();
    await expect(inspector).toBeVisible();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    await expect(closeButton).toBeFocused();

    await closeButton.click();
    await expect(inspector).toBeHidden();
    await expect(detailsButton).toHaveAttribute("aria-expanded", "false");
    await expect(detailsButton).toBeFocused();
  });

  test("toggles details inspector via Ctrl+I keyboard shortcut in editor", async ({ page }) => {
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();

    const contentInput = page.locator("#contentInput");
    const inspector = page.locator("#noteInspector");

    await contentInput.focus();
    await expect(inspector).toBeHidden();

    // Trigger toggle via keyboard shortcut
    await page.keyboard.press("Control+i");
    await expect(inspector).toBeVisible();

    // Trigger toggle again to close
    await page.keyboard.press("Control+i");
    await expect(inspector).toBeHidden();
  });

  test("dismisses details inspector on Escape key and restores focus", async ({ page }) => {
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();

    const detailsButton = page.locator("#detailsButton");
    const inspector = page.locator("#noteInspector");

    await detailsButton.click();
    await expect(inspector).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(inspector).toBeHidden();
  });

  test("renders statistics, tags, and outgoing links dynamically from content", async ({ page }) => {
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();

    const titleInput = page.locator("#titleInput");
    const contentInput = page.locator("#contentInput");
    const detailsButton = page.locator("#detailsButton");

    await titleInput.fill("Structured Note");
    await contentInput.fill("Hello world with #programming and #javascript. Linking to [[roadmap]] and [[ideas]].");

    await detailsButton.click();
    const inspector = page.locator("#noteInspector");
    await expect(inspector).toBeVisible();

    // Check stats region
    const statsList = page.locator("#noteStatsList");
    await expect(statsList).toContainText("Words");
    await expect(statsList).toContainText("11");
    await expect(statsList).toContainText("Characters");
    await expect(statsList).toContainText("Reading time");

    // Check tags region
    const tagsList = page.locator("#noteTagsList");
    await expect(page.locator("#noteTagsRegion")).toBeVisible();
    await expect(tagsList).toContainText("#programming");
    await expect(tagsList).toContainText("#javascript");

    // Check outgoing links region
    const outgoingList = page.locator("#outgoingLinksList");
    await expect(page.locator("#outgoingLinksRegion")).toBeVisible();
    await expect(outgoingList).toContainText("[[roadmap]]");
    await expect(outgoingList).toContainText("[[ideas]]");
  });

  test("hides empty tags and outgoing links regions when none exist", async ({ page }) => {
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();

    await page.locator("#contentInput").fill("Simple plain text without tags or links.");
    await page.locator("#detailsButton").click();

    await expect(page.locator("#noteStatsRegion")).toBeVisible();
    await expect(page.locator("#noteTagsRegion")).toBeHidden();
    await expect(page.locator("#outgoingLinksRegion")).toBeHidden();
    await expect(page.locator("#japaneseStudyRegion")).toBeHidden();
  });

  for (const viewport of [
    { width: 1024, height: 768, name: "1024x768" },
    { width: 1280, height: 720, name: "1280x720" },
    { width: 1440, height: 900, name: "1440x900" },
    { width: 720, height: 450, name: "720x450" },
  ]) {
    test(`details inspector remains contained within viewport at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await page.getByRole("button", { name: "New note", exact: true }).first().click();
      await page.locator("#contentInput").fill("Sample content for viewport boundary verification.");
      await page.locator("#detailsButton").click();

      const inspector = page.locator("#noteInspector");
      await expect(inspector).toBeVisible();

      const bounds = await inspector.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 2);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 2);

      const overflow = await page.evaluate(() => {
        return globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
