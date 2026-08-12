import { expect, test } from "@playwright/test";

test("Notes opens on the board with the shared editor overlay closed", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");

  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(page.locator("#titleInput")).toBeHidden();
  await expect(page.locator("#noteList .note-item")).toHaveCount(1);
  await expect(page.locator(".note-board-heading")).toHaveText(["NOTES"]);
  await expect(page.locator("body")).not.toContainText("Autosaves locally");
});

test("ordinary create opens one centered overlay with compact state and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  const create = page.locator("#newNoteButton");
  const search = page.locator("#searchInput");
  await search.fill("Unmatched query");
  await create.click();
  const overlay = page.locator("#noteEditorOverlay");
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute("data-mode", "create");
  await expect(page.locator("#noteEditorOverlayLabel")).toHaveText("Create note");
  await expect(page.locator("#titleInput")).toBeFocused();
  await expect(page.locator("#saveState")).toHaveText("Saved");

  const geometry = await overlay.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      centerX: box.left + box.width / 2,
      centerY: box.top + box.height / 2,
      width: box.width,
      height: box.height,
      viewportWidth: globalThis.innerWidth,
      viewportHeight: globalThis.innerHeight,
    };
  });
  expect(Math.abs(geometry.centerX - geometry.viewportWidth / 2)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.centerY - geometry.viewportHeight / 2)).toBeLessThanOrEqual(2);
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth - 32);
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight - 32);

  const pin = page.locator("#pinNoteButton");
  await expect(pin).toHaveAccessibleName("Pin note");
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await pin.click();
  await expect(pin).toHaveAccessibleName("Unpin note");
  await expect(pin).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(overlay).toBeHidden();
  await expect(create).toBeFocused();
  await expect(search).toHaveValue("Unmatched query");
  await search.fill("");
  await expect(page.locator('[data-section-id="pinned"] .note-item')).toHaveCount(1);
});

test("a hidden command-palette opener falls back to the visible create control", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("#commandInput").fill("New note");
  await page.locator("#commandInput").press("Enter");

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#commandPalette")).toBeHidden();
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(page.locator("#newNoteButton")).toBeFocused();
});

test("Japanese quick create returns focus to its visible workspace control", async ({ page }) => {
  await page.goto("/");
  await page.locator("#japaneseWorkspaceButton").click();
  const create = page.locator("#newJapaneseNoteButton");
  await create.click();
  await page.getByRole("button", { name: "Create vocabulary note" }).click();

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(create).toBeFocused();
});

test("card selection reuses the edit overlay and returns focus to the card", async ({ page }) => {
  await page.goto("/");

  const card = page.locator("#noteList .note-item").first();
  await card.evaluate((element) => {
    element.focus({ preventScroll: true });
    element.click();
  });
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#noteEditorOverlay")).toHaveAttribute("data-mode", "edit");
  await expect(page.locator("#noteEditorOverlayLabel")).toHaveText("Edit note");
  await expect(page.locator("#titleInput")).toHaveValue("Untitled");

  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(card).toBeFocused();
});

test("query scroll focus and a saved draft survive overlay close and reopen", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  const search = page.locator("#searchInput");
  await search.fill("Untitled");
  await expect(page.locator("#noteList .note-item")).toHaveCount(1);

  const expectedScrollTop = await page.evaluate(() => {
    const list = globalThis.document.querySelector("#noteList");
    const panel = globalThis.document.querySelector("#noteNavigationRegion");
    list.style.minHeight = "1800px";
    panel.scrollTop = 240;
    return panel.scrollTop;
  });
  expect(expectedScrollTop).toBeGreaterThan(0);

  const card = page.locator("#noteList .note-item").first();
  await card.evaluate((element) => {
    element.focus({ preventScroll: true });
    element.click();
  });
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await page.locator("#contentInput").fill("Context-preserving overlay draft");
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(search).toHaveValue("Untitled");
  await expect(card).toBeFocused();
  await expect.poll(() => page.locator("#noteNavigationRegion").evaluate((element) => (
    element.scrollTop
  ))).toBe(expectedScrollTop);

  await card.click();
  await expect(page.locator("#contentInput")).toHaveValue("Context-preserving overlay draft");
});

test("the editor modal isolates background note navigation shortcuts", async ({ page }) => {
  await page.goto("/");
  await page.locator("#newNoteButton").click();
  await page.locator("#titleInput").fill("Second note");
  await page.locator("#contentInput").fill("Second body");
  await page.locator("#contentInput").press("Control+Enter");
  await page.getByRole("button", { name: "Close note editor" }).click();

  const original = page.locator("#noteList .note-item", { hasText: "Untitled" });
  await original.click();
  const activeId = await page.locator('.note-item[aria-current="true"]').getAttribute("data-id");
  await page.getByRole("button", { name: "Close note editor" }).focus();
  await page.keyboard.press("j");
  await page.waitForTimeout(250);

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator(`.note-item[data-id="${activeId}"]`)).toHaveAttribute("aria-current", "true");
});

test("the editor focus command opens the overlay at the content field", async ({ page }) => {
  await page.goto("/");
  await page.locator("#newNoteButton").focus();
  await page.keyboard.press("i");

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#contentInput")).toBeFocused();
});

test("a canonical save failure keeps the overlay open with an explicit error", async ({ page }) => {
  await page.goto("/");
  await page.locator("#noteList .note-item").first().click();
  await page.evaluate(() => {
    const original = globalThis.IDBObjectStore.prototype.put;
    Object.defineProperty(globalThis, "__restoreNotePut", {
      configurable: true,
      value() {
        globalThis.IDBObjectStore.prototype.put = original;
      },
    });
    globalThis.IDBObjectStore.prototype.put = function put() {
      throw new Error("Synthetic note write failure");
    };
  });

  await page.locator("#contentInput").fill("Draft that must remain recoverable");
  const close = page.getByRole("button", { name: "Close note editor" });
  await close.click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#saveState")).toHaveText("Storage unavailable");
  await expect(page.locator("#saveState")).toHaveAttribute("data-state", "error");
  await expect(close).toBeEnabled();

  await page.evaluate(() => globalThis.__restoreNotePut());
  await close.click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
});
