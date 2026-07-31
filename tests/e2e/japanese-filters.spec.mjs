import { expect, test } from "@playwright/test";

test("Japanese filters combine created-date range and notebook type", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await expect(page.getByRole("region", { name: "Japanese note filters" })).toBeHidden();

  await page.getByRole("button", { name: "日本語" }).click();
  const filters = page.getByRole("region", { name: "Japanese note filters" });
  await expect(filters).toBeVisible();

  await page.getByRole("button", { name: "Create vocabulary note" }).click();
  await page.getByRole("button", { name: "Create kanji note" }).click();
  await page.getByRole("button", { name: "Create grammar note" }).click();

  await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const store = getActiveStore();
    const state = store.getState();
    const types = new Map(state.studyReviews.map((review) => [review.noteId, review.notebookType]));
    const dates = {
      vocabulary: new Date(2026, 6, 29, 12).toISOString(),
      kanji: new Date(2026, 6, 30, 12).toISOString(),
      grammar: new Date(2026, 6, 31, 12).toISOString(),
    };
    store.setState({
      notes: state.notes.map((note) => types.has(note.id)
        ? { ...note, createdAt: dates[types.get(note.id)] }
        : note),
    });
  });

  await page.locator("#japaneseDateFrom").fill("2026-07-30");
  await page.locator("#japaneseDateTo").fill("2026-07-31");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(2);
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Showing 2 of 3 Japanese notes");

  await page.locator("#japaneseNoteType").selectOption("grammar");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(1);
  await expect(page.locator("#noteList .note-item-title")).toHaveText("New grammar pattern");
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Showing 1 of 3 Japanese notes");

  await page.getByRole("button", { name: "Clear Japanese filters" }).click();
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(3);
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Showing 3 of 3 Japanese notes");
});
