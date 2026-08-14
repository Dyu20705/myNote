import { expect, test } from "@playwright/test";

import { closeNoteEditor, createJapaneseNoteFromMenu } from "./japanese-helpers.mjs";

const REFERENCE_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];

async function expectNoDocumentHorizontalOverflow(page) {
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

async function seedDrawing(page, noteId) {
  await page.evaluate(async (id) => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const timestamp = "2026-08-14T00:00:00.000Z";
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").put({
      id: "issue-71-resize-drawing",
      noteId: id,
      strokes: [{
        tool: "pen",
        width: 0.008,
        points: [{ x: 0.2, y: 0.2, t: 0 }, { x: 0.8, y: 0.8, t: 1 }],
      }],
      paperStyle: "grid",
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 2,
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, noteId);
}

async function readDrawings(page, noteId) {
  return page.evaluate(async (id) => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readonly");
    const entriesRequest = transaction.objectStore("kanjiInkEntries").index("noteId").getAll(id);
    const entries = await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(entriesRequest.result);
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return entries.toSorted((left, right) => left.id.localeCompare(right.id));
  }, noteId);
}

for (const viewport of REFERENCE_VIEWPORTS) {
  test(`board overlay and note transient surfaces stay contained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expectNoDocumentHorizontalOverflow(page);

    await page.locator("#noteList .note-item").first().click();
    const overlay = page.locator("#noteEditorOverlay");
    await expect(overlay).toBeVisible();
    await expectInsideViewport(overlay);
    await expect(page.locator("#titleInput")).toBeVisible();
    await expect(page.locator("#contentInput")).toBeVisible();

    await page.locator("#noteActionsButton").click();
    const actions = page.locator("#noteActionsPopover");
    await expect(actions).toBeVisible();
    await expectInsideViewport(actions);
    await page.keyboard.press("Escape");

    await page.locator("#detailsButton").click();
    const inspector = page.locator("#noteInspector");
    await expect(inspector).toBeVisible();
    await expectInsideViewport(inspector);
    await page.keyboard.press("Escape");

    await expectNoDocumentHorizontalOverflow(page);
  });
}

test("live desktop resize preserves query draft overlay and logical focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const search = page.locator("#searchInput");
  await search.fill("Untitled");
  const card = page.locator("#noteList .note-item").first();
  const activeId = await card.getAttribute("data-id");
  await card.click();

  const overlay = page.locator("#noteEditorOverlay");
  const title = page.locator("#titleInput");
  const content = page.locator("#contentInput");
  await title.fill("Untitled resize preservation title");
  await content.fill("Resize preservation body 日本語 code::token");
  await content.focus();

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-mode", "edit");
    await expect(title).toHaveValue("Untitled resize preservation title");
    await expect(content).toHaveValue("Resize preservation body 日本語 code::token");
    await expect(search).toHaveValue("Untitled");
    await expect(content).toBeFocused();
    await expect(page.locator(`.note-item[data-id="${activeId}"]`)).toHaveAttribute("aria-current", "true");
    await expectInsideViewport(overlay);
    await expectNoDocumentHorizontalOverflow(page);
  }

  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(overlay).toBeHidden();
  await expect(card).toBeFocused();
});

test("long English Japanese and code-like content cannot widen the document during narrow-layout stress", async ({ page }) => {
  const unbroken = "A".repeat(256);
  const japanese = "日本語の長い文章を表示して折り返しを検証します。".repeat(16);
  const mixed = `${unbroken}\n${japanese}\nconst::very::long::code::path => [${unbroken}]`;

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#noteList .note-item").first().click();
    await page.locator("#titleInput").fill(unbroken);
    await page.locator("#contentInput").fill(mixed);
    await expectInsideViewport(page.locator("#noteEditorOverlay"));
    await expectNoDocumentHorizontalOverflow(page);
    await closeNoteEditor(page);

    const card = page.locator("#noteList .note-item").first();
    await expect(card).toBeVisible();
    await expect(card.locator(".note-item-title")).toContainText(unbroken);
    await expectNoDocumentHorizontalOverflow(page);
  }
});

test("drawing projection and canonical entries remain invariant through desktop resize", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#noteList .note-item").first();
  const noteId = await card.getAttribute("data-id");
  await card.click();
  await seedDrawing(page, noteId);
  await page.evaluate(async () => (await import("/ui/kanjiInkView.js")).kanjiInkApp.synchronize());

  const before = await readDrawings(page, noteId);
  const drawingRegion = page.locator("#noteDrawingRegion");
  await expect(drawingRegion).toBeVisible();
  expect(await page.evaluate(() => {
    const region = globalThis.document.getElementById("noteDrawingRegion");
    const title = globalThis.document.getElementById("titleInput");
    return Boolean(region.compareDocumentPosition(title) & globalThis.Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  for (const viewport of [
    ...REFERENCE_VIEWPORTS,
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(drawingRegion).toBeVisible();
    await expect(page.locator("#titleInput")).toBeInViewport();
    await expect(page.locator("#contentInput")).toBeInViewport();
    await expectInsideViewport(page.locator("#noteEditorOverlay"));
    await expectNoDocumentHorizontalOverflow(page);
  }

  const after = await readDrawings(page, noteId);
  expect(JSON.stringify(after) === JSON.stringify(before)).toBe(true);
});

test("note and command transient surfaces stay contained during 720x450 narrow-layout stress", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto("/");
  await page.locator("#noteList .note-item").first().click();

  await page.locator("#noteActionsButton").click();
  await expect(page.locator("#noteActionsPopover")).toBeVisible();
  await expectInsideViewport(page.locator("#noteActionsPopover"));
  await page.keyboard.press("Escape");

  await page.locator("#detailsButton").click();
  await expect(page.locator("#noteInspector")).toBeVisible();
  await expectInsideViewport(page.locator("#noteInspector"));
  await page.keyboard.press("Escape");

  await closeNoteEditor(page);
  await page.keyboard.press("Control+k");
  await expect(page.locator("#commandPalette")).toBeVisible();
  await expectInsideViewport(page.locator(".command-panel"));
  await expectNoDocumentHorizontalOverflow(page);
});

test("Japanese filters create menu and review state survive desktop resize", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "日本語", exact: true }).click();

  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await closeNoteEditor(page);
  await createJapaneseNoteFromMenu(page, "Create grammar note");
  await closeNoteEditor(page);

  const search = page.locator("#searchInput");
  const commonFilters = page.getByRole("group", { name: "Japanese common filters" });
  const grammar = commonFilters.getByRole("button", { name: "Grammar", exact: true });
  await search.fill("New");
  await grammar.click();
  await expect(search).toHaveValue("New");
  await expect(grammar).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Remove Type: Grammar filter" })).toBeVisible();

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(search).toHaveValue("New");
    await expect(grammar).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Remove Type: Grammar filter" })).toBeVisible();
    await expectNoDocumentHorizontalOverflow(page);
  }

  await page.getByRole("button", { name: "New Japanese note" }).click();
  const createMenu = page.getByRole("group", { name: "New Japanese note" });
  await expect(createMenu).toBeVisible();
  await expectInsideViewport(createMenu);
  await page.keyboard.press("Escape");

  const review = page.locator("#japaneseReviewEntryButton");
  await review.click();
  const reviewDialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(reviewDialog).toBeVisible();
  await page.getByRole("button", { name: "Reveal review content" }).click();
  await expect(page.locator("#reviewContent")).toBeVisible();

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(reviewDialog).toBeVisible();
    await expect(page.locator("#reviewContent")).toBeVisible();
    await expect(page.locator("#reviewRatings")).toBeVisible();
    await expectInsideViewport(reviewDialog);
    await expectNoDocumentHorizontalOverflow(page);
  }
});
