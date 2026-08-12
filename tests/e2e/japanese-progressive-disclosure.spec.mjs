import { expect, test } from "@playwright/test";

async function openJapaneseWorkspace(page) {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByRole("button", { name: "日本語", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
}

async function createJapaneseNote(page, action, title) {
  await page.getByRole("button", { name: "New Japanese note" }).click();
  await page.getByRole("group", { name: "New Japanese note" })
    .getByRole("button", { name: action })
    .click();
  await expect(page.locator("#titleInput")).toHaveValue(title);
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
]) {
  test(`Japanese Notes and Review stay bounded at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openJapaneseWorkspace(page);
    await expect(page.locator("#noteEditorOverlay")).toBeHidden();
    await expect.poll(() => page.evaluate(() => (
      globalThis.document.documentElement.scrollWidth
      <= globalThis.document.documentElement.clientWidth
    ))).toBe(true);
    await expect(page.locator("#japaneseReviewEntryButton")).toBeVisible();
    await expect(page.locator("#japaneseSubviewNavigation")).toBeHidden();
    await expect(page.locator("#japaneseNotesSummary")).toBeHidden();
    await expect.poll(() => page.evaluate(() => (
      globalThis.document.documentElement.scrollWidth
      <= globalThis.document.documentElement.clientWidth
    ))).toBe(true);
  });
}

test("Japanese Notes exposes Filter A and starts Review from one compact board action", async ({ page }) => {
  await openJapaneseWorkspace(page);

  await expect(page.locator("#contentInput")).toBeHidden();
  await expect(page.locator(".search-box")).toBeVisible();
  await expect(page.getByRole("button", { name: "New Japanese note" })).toBeVisible();
  await expect(page.locator("#japaneseDashboard")).toBeHidden();
  await expect(page.locator("#japaneseReviewOverview")).toBeHidden();
  await expect(page.locator("#japaneseSubviewNavigation")).toBeHidden();
  await expect(page.locator("#japaneseNotesSummary")).toBeHidden();
  await expect(page.getByRole("region", { name: "Needs repair" })).toBeHidden();
  const review = page.locator("#japaneseReviewEntryButton");
  await expect(review).toHaveAccessibleName("Review 0");
  await expect(review).toHaveAccessibleDescription("No Japanese reviews are due");
  await expect(review).toBeDisabled();

  await createJapaneseNote(page, "Create vocabulary note", "New vocabulary");
  await expect(review).toHaveAccessibleName("Review 1");
  await expect(review).toHaveAccessibleDescription("Start due Japanese reviews");
  await expect(review).toBeEnabled();
  await review.click();
  const dialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal review content" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(review).toBeFocused();
});

test("filter disclosure renders removable validated chips without clearing text search", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNote(page, "Create vocabulary note", "New vocabulary");
  await createJapaneseNote(page, "Create grammar note", "New grammar pattern");

  const search = page.locator("#searchInput");
  await search.fill("New");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(2);

  const toggle = page.getByRole("button", { name: "+ Filter", exact: true });
  await expect(page.getByRole("region", { name: "Japanese note filters" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Clear all" })).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await page.locator("#japaneseNoteType").selectOption("grammar");
  await expect(page.locator("#noteList .note-item-title")).toHaveText("New grammar pattern");
  await expect(page.getByRole("button", { name: "Remove Type: Grammar filter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear all" })).toBeVisible();

  await page.getByRole("button", { name: "Remove Type: Grammar filter" }).click();
  await expect(search).toHaveValue("New");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Clear all" })).toBeHidden();
});

test("quick-create UI and palette expose the same command identity and unavailable reason", async ({ page }) => {
  await openJapaneseWorkspace(page);

  const trigger = page.getByRole("button", { name: "New Japanese note" });
  await trigger.click();
  const menuCommand = page.getByRole("group", { name: "New Japanese note" })
    .getByRole("button", { name: "Create vocabulary note" });
  const commandId = await menuCommand.getAttribute("data-command-id");
  expect(commandId).toBeTruthy();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await page.locator("#commandInput").fill("Create vocabulary note");
  const paletteCommand = palette.locator(`[data-command-id="${commandId}"]`);
  await expect(paletteCommand).toBeVisible();
  await paletteCommand.click();
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.getByRole("button", { name: "Close note editor" }).click();

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page.locator("#commandInput").fill("Create grammar note");
  await page.locator("#commandInput").press("Enter");
  await expect(page.getByRole("button", { name: "日本語", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#titleInput")).toHaveValue("New grammar pattern");
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.getByRole("button", { name: "Close note editor" }).click();
  await trigger.click();

  await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    getActiveStore().setState({ studyDataUnavailable: true });
  });
  await expect(menuCommand).toBeDisabled();

  await page.keyboard.press("Control+k");
  await page.locator("#commandInput").fill("Create vocabulary note");
  const unavailable = palette.locator(`[data-command-id="${commandId}"]`);
  await expect(unavailable).toHaveAttribute("aria-disabled", "true");
  await expect(unavailable).toContainText("Japanese study data is unavailable");
});

test("shared quick-create command blocks a concurrent registry execution", async ({ page }) => {
  await openJapaneseWorkspace(page);

  const result = await page.evaluate(async () => {
    const { commandRuntime } = await import("/app.js");
    const commandId = "japanese.create.vocabulary";
    const firstExecution = commandRuntime.execute(commandId);
    const during = commandRuntime.snapshot().find((command) => command.id === commandId);
    const secondExecution = await Promise.resolve(commandRuntime.execute(commandId));
    await firstExecution;
    const after = commandRuntime.snapshot().find((command) => command.id === commandId);
    return { during, secondExecution, after };
  });

  expect(result.during.available).toBe(false);
  expect(result.during.unavailableReason).toBe("Japanese note creation is already in progress");
  expect(result.secondExecution).toMatchObject({
    executed: false,
    reason: "Japanese note creation is already in progress",
  });
  expect(result.after.available).toBe(true);
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(1);
});

test("quick-create disclosure exposes every action through native keyboard traversal", async ({ page }) => {
  await openJapaneseWorkspace(page);

  const trigger = page.getByRole("button", { name: "New Japanese note" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const group = page.getByRole("group", { name: "New Japanese note" });
  const vocabulary = group.getByRole("button", { name: "Create vocabulary note" });
  const kanji = group.getByRole("button", { name: "Create kanji note" });
  await expect(vocabulary).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(kanji).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("compact Review closes back to the same board control", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNote(page, "Create vocabulary note", "New vocabulary");
  const review = page.locator("#japaneseReviewEntryButton");
  await review.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Japanese review session" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
});

test("compact Review resumes an active reveal-first session", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNote(page, "Create vocabulary note", "New vocabulary");
  const review = page.locator("#japaneseReviewEntryButton");
  await review.click();

  const dialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#reviewContent")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(review).toBeFocused();
  await review.click();
  await expect(page.getByRole("button", { name: "Reveal review content" })).toBeFocused();
});
