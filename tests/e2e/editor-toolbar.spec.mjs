import { expect, test } from "@playwright/test";

test.describe("Contextual Floating Markdown Toolbar (Issue #129)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#noteList");
  });

  test("toolbar is hidden on board and appears contextually when text is selected", async ({ page }) => {
    const toolbar = page.locator("#editorToolbar");
    await expect(toolbar).toBeHidden();

    // Click 'New note'
    await page.locator("#newNoteButton").click();
    const overlay = page.locator("#noteEditorOverlay");
    await expect(overlay).toBeVisible();

    // Initially collapsed cursor in empty note -> toolbar remains hidden
    await expect(toolbar).toBeHidden();

    // Fill text and select a word -> toolbar becomes visible
    const content = page.locator("#contentInput");
    await content.fill("Sample note body for formatting");
    await content.evaluate((el) => {
      el.focus();
      el.setSelectionRange(0, 6);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });
    await expect(toolbar).toBeVisible();

    // Verify formatting buttons exist
    await expect(toolbar.locator("button[data-action='bold']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='italic']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='strikethrough']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='code']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='link']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='heading']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='task']")).toBeVisible();
    await expect(toolbar.locator("button[data-action='kanji-draw']")).toBeVisible();

    // Close overlay
    await page.locator("#closeNoteEditorButton").click();
    await expect(overlay).toBeHidden();
    await expect(toolbar).toBeHidden();
  });

  test("applies bold, italic, strikethrough, code, and link transformations to textarea content", async ({ page }) => {
    // Open new note
    await page.locator("#newNoteButton").click();
    const content = page.locator("#contentInput");
    await expect(page.locator("#titleInput")).toBeFocused();
    await content.fill("sample text for formatting");

    // 1. Select 'text' and click Bold
    await content.evaluate((el) => {
      const idx = el.value.indexOf("text");
      el.focus();
      el.setSelectionRange(idx, idx + "text".length);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });
    await page.locator("#editorToolbar button[data-action='bold']").click();
    await expect(content).toHaveValue("sample **text** for formatting");

    // 2. Select 'sample' and click Italic
    await content.evaluate((el) => {
      const idx = el.value.indexOf("sample");
      el.focus();
      el.setSelectionRange(idx, idx + "sample".length);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });
    await page.locator("#editorToolbar button[data-action='italic']").click();
    await expect(content).toHaveValue("*sample* **text** for formatting");

    // 3. Select 'formatting' and click Strikethrough
    await content.evaluate((el) => {
      const idx = el.value.indexOf("formatting");
      el.focus();
      el.setSelectionRange(idx, idx + "formatting".length);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });
    await page.locator("#editorToolbar button[data-action='strikethrough']").click();
    await expect(content).toHaveValue("*sample* **text** for ~~formatting~~");

    // 4. Test Inline Code
    await content.fill("const variable = 42;");
    await content.evaluate((el) => {
      const idx = el.value.indexOf("variable");
      el.focus();
      el.setSelectionRange(idx, idx + "variable".length);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });
    await page.locator("#editorToolbar button[data-action='code']").click();
    await expect(content).toHaveValue("const `variable` = 42;");

    // 5. Test Link insertion
    await content.fill("reference docs");
    await content.evaluate((el) => {
      const idx = el.value.indexOf("docs");
      el.focus();
      el.setSelectionRange(idx, idx + "docs".length);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });
    await page.locator("#editorToolbar button[data-action='link']").click();
    await expect(content).toHaveValue("reference [docs](url)");
  });

  test("cycles headings and toggles task items on current line", async ({ page }) => {
    await page.locator("#newNoteButton").click();
    const content = page.locator("#contentInput");
    await expect(page.locator("#titleInput")).toBeFocused();
    await content.fill("First heading line\nSecond line");

    // Select text on first line to show toolbar
    await content.evaluate((el) => {
      el.focus();
      el.setSelectionRange(0, 5);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });

    const headingBtn = page.locator("#editorToolbar button[data-action='heading']");

    // Cycle to H1
    await headingBtn.click();
    await expect(content).toHaveValue("# First heading line\nSecond line");

    // Cycle to H2
    await headingBtn.click();
    await expect(content).toHaveValue("## First heading line\nSecond line");

    // Cycle to H3
    await headingBtn.click();
    await expect(content).toHaveValue("### First heading line\nSecond line");

    // Cycle back to plain
    await headingBtn.click();
    await expect(content).toHaveValue("First heading line\nSecond line");

    // Test Task Item toggle
    const taskBtn = page.locator("#editorToolbar button[data-action='task']");
    await taskBtn.click();
    await expect(content).toHaveValue("- [ ] First heading line\nSecond line");

    await taskBtn.click();
    await expect(content).toHaveValue("First heading line\nSecond line");
  });

  test("keyboard navigation inside toolbar and Escape return to editor", async ({ page }) => {
    await page.locator("#newNoteButton").click();
    const content = page.locator("#contentInput");
    await content.fill("Text for selection");
    await content.evaluate((el) => {
      el.focus();
      el.setSelectionRange(0, 4);
      el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
    });

    const boldBtn = page.locator("#editorToolbar button[data-action='bold']");
    const italicBtn = page.locator("#editorToolbar button[data-action='italic']");

    // Focus bold button in toolbar
    await boldBtn.focus();
    await expect(boldBtn).toBeFocused();

    // Press ArrowRight to move to next button
    await page.keyboard.press("ArrowRight");
    await expect(italicBtn).toBeFocused();

    // Press Escape to return focus to textarea
    await page.keyboard.press("Escape");
    await expect(content).toBeFocused();
  });

  test("viewport bounds containment across supported desktop viewports", async ({ page }) => {
    const viewports = [
      { width: 1024, height: 768 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.locator("#newNoteButton").click();
      const content = page.locator("#contentInput");
      await content.fill("Sample note text");
      await content.evaluate((el) => {
        el.focus();
        el.setSelectionRange(0, 6);
        el.dispatchEvent(new el.ownerDocument.defaultView.Event("select"));
      });

      const toolbar = page.locator("#editorToolbar");
      await expect(toolbar).toBeVisible();

      // Check toolbar is within overlay bounds
      const overlayBox = await page.locator("#noteEditorOverlay").boundingBox();
      const toolbarBox = await toolbar.boundingBox();

      expect(toolbarBox.x).toBeGreaterThanOrEqual(overlayBox.x - 2);
      expect(toolbarBox.x + toolbarBox.width).toBeLessThanOrEqual(overlayBox.x + overlayBox.width + 2);

      await page.locator("#closeNoteEditorButton").click();
      await expect(page.locator("#noteEditorOverlay")).toBeHidden();
    }
  });
});
