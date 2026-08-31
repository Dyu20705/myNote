import { expect, test } from "@playwright/test";

import { closeNoteEditor } from "./japanese-helpers.mjs";

// ---------------------------------------------------------------------------
// Mobile viewport configurations
// ---------------------------------------------------------------------------

const MOBILE_VIEWPORTS = [
  { name: "iPhone 16 Pro", width: 393, height: 852 },
  { name: "Pixel 8", width: 412, height: 915 },
  { name: "Narrow desktop", width: 600, height: 800 },
];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth
  ))).toBe(true);
}

async function expectInsideViewport(locator, inset = 0) {
  const geometry = await locator.evaluate((element, safeInset) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      safeInset,
    };
  }, inset);

  expect(geometry.left).toBeGreaterThanOrEqual(geometry.safeInset - 1);
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.safeInset - 1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width - geometry.safeInset + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height - geometry.safeInset + 1);
}

async function expectMinTouchTarget(locator, size = 44) {
  const box = await locator.boundingBox();
  expect(box, `Expected ${locator} to have a bounding box`).toBeTruthy();
  expect(box.width).toBeGreaterThanOrEqual(size);
  expect(box.height).toBeGreaterThanOrEqual(size);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`Mobile viewport: ${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("no horizontal document overflow on load", async ({ page }) => {
      await page.goto("/");
      await expectNoHorizontalOverflow(page);
    });

    test("navigation: workspace switching preserves layout", async ({ page }) => {
      await page.goto("/");
      await expectNoHorizontalOverflow(page);

      // Workspace buttons visible
      const notesButton = page.locator("#notesWorkspaceButton");
      const japaneseButton = page.locator("#japaneseWorkspaceButton");
      const archiveButton = page.locator("#archiveWorkspaceButton");

      await expect(notesButton).toBeVisible();
      await expect(japaneseButton).toBeVisible();
      await expect(archiveButton).toBeVisible();

      // Switch to Japanese workspace
      await japaneseButton.click();
      await page.waitForFunction(() => (
        globalThis.document.querySelector("#japaneseWorkspaceButton")?.getAttribute("aria-pressed") === "true"
      ));
      await expectNoHorizontalOverflow(page);

      // Switch to Archive workspace
      await archiveButton.click();
      await page.waitForFunction(() => (
        globalThis.document.querySelector("#archiveWorkspaceButton")?.getAttribute("aria-pressed") === "true"
      ));
      await expectNoHorizontalOverflow(page);

      // Switch back to Notes workspace
      await notesButton.click();
      await page.waitForFunction(() => (
        globalThis.document.querySelector("#notesWorkspaceButton")?.getAttribute("aria-pressed") === "true"
      ));
      await expectNoHorizontalOverflow(page);
    });

    test("note workflow: create, edit, close, reopen", async ({ page }) => {
      await page.goto("/");

      // Create new note
      const newNoteButton = page.locator("#newNoteButton");
      await newNoteButton.click();

      const overlay = page.locator("#noteEditorOverlay");
      await overlay.waitFor({ state: "visible" });

      // Editor fits viewport
      await expectInsideViewport(overlay);

      // Type title and body
      const titleInput = page.locator("#titleInput");
      await titleInput.fill("Mobile test note");
      await expect(titleInput).toHaveValue("Mobile test note");

      const contentInput = page.locator("#contentInput");
      await contentInput.fill("Content for mobile viewport test.");
      await expect(contentInput).toHaveValue("Content for mobile viewport test.");

      await expectNoHorizontalOverflow(page);

      // Close editor
      await closeNoteEditor(page);

      // Verify note appears in board
      const noteCard = page.locator(".note-item", { hasText: "Mobile test note" });
      await expect(noteCard.first()).toBeVisible();

      // Reopen note
      await noteCard.first().click();
      await overlay.waitFor({ state: "visible" });
      await expect(titleInput).toHaveValue("Mobile test note");
      await expect(contentInput).toHaveValue("Content for mobile viewport test.");

      // Close again
      await closeNoteEditor(page);
    });

    test("editor: close with Escape and focus returns", async ({ page }) => {
      await page.goto("/");

      const newNoteButton = page.locator("#newNoteButton");
      await newNoteButton.click();

      const overlay = page.locator("#noteEditorOverlay");
      await overlay.waitFor({ state: "visible" });

      // Escape closes editor
      await page.keyboard.press("Escape");
      await overlay.waitFor({ state: "hidden" });

      // Focus returns to a focusable element (new note button or note card)
      const activeTagName = await page.evaluate(() => globalThis.document.activeElement?.tagName);
      expect(activeTagName).toBe("BUTTON");
    });

    test("editor: action buttons reachable", async ({ page }) => {
      await page.goto("/");

      await page.locator("#newNoteButton").click();
      const overlay = page.locator("#noteEditorOverlay");
      await overlay.waitFor({ state: "visible" });

      // Close button accessible
      const closeButton = page.getByRole("button", { name: "Close note editor" });
      await expect(closeButton).toBeVisible();

      await expectInsideViewport(overlay);
      await expectNoHorizontalOverflow(page);

      await closeNoteEditor(page);
    });

    test("Japanese workspace: controls remain usable", async ({ page }) => {
      await page.goto("/");

      // Switch to Japanese workspace
      await page.locator("#japaneseWorkspaceButton").click();
      await page.waitForFunction(() => (
        globalThis.document.querySelector("#japaneseWorkspaceButton")?.getAttribute("aria-pressed") === "true"
      ));

      await expectNoHorizontalOverflow(page);

      // Search input usable
      const searchInput = page.locator("#searchInput");
      if (await searchInput.isVisible()) {
        await searchInput.fill("test");
        await expect(searchInput).toHaveValue("test");
        await searchInput.clear();
      }

      // Review entry button visible if present (may be disabled when no reviews are due)
      const reviewEntry = page.locator("#japaneseReviewEntryButton");
      if (await reviewEntry.isVisible()) {
        await expect(reviewEntry).toBeVisible();
      }

      await expectNoHorizontalOverflow(page);

      // Switch back to Notes
      await page.locator("#notesWorkspaceButton").click();
      await page.waitForFunction(() => (
        globalThis.document.querySelector("#notesWorkspaceButton")?.getAttribute("aria-pressed") === "true"
      ));
    });

    test("touch targets: representative controls meet 44×44px minimum", async ({ page }) => {
      await page.goto("/");

      // Shell-level buttons
      await expectMinTouchTarget(page.locator("#newNoteButton"));
      await expectMinTouchTarget(page.locator("#refreshButton"));

      // Workspace switcher buttons
      const workspaceSwitcher = page.locator(".workspace-switcher button");
      const switcherCount = await workspaceSwitcher.count();
      for (let index = 0; index < switcherCount; index++) {
        await expectMinTouchTarget(workspaceSwitcher.nth(index));
      }

      // Open editor to test editor buttons
      await page.locator("#newNoteButton").click();
      const overlay = page.locator("#noteEditorOverlay");
      await overlay.waitFor({ state: "visible" });

      // Close button
      const closeButton = page.getByRole("button", { name: "Close note editor" });
      await expectMinTouchTarget(closeButton);

      // Toolbar buttons (check first visible one if toolbar is visible)
      const toolbar = page.locator("#editorToolbar");
      if (await toolbar.isVisible()) {
        const toolbarButtons = toolbar.locator(".editor-toolbar-button");
        const tbCount = await toolbarButtons.count();
        if (tbCount > 0) {
          await expectMinTouchTarget(toolbarButtons.first());
        }
      }

      await closeNoteEditor(page);
    });

    test("no horizontal overflow after creating notes with long content", async ({ page }) => {
      await page.goto("/");

      // Create note with long unbroken string
      await page.locator("#newNoteButton").click();
      const overlay = page.locator("#noteEditorOverlay");
      await overlay.waitFor({ state: "visible" });

      await page.locator("#titleInput").fill("A".repeat(200));
      await page.locator("#contentInput").fill("B".repeat(500));

      await expectNoHorizontalOverflow(page);

      await closeNoteEditor(page);

      // Board should not overflow with long title in card
      await expectNoHorizontalOverflow(page);
    });
  });
}
