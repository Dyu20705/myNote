import { expect, test } from "@playwright/test";
import { closeNoteEditor, createJapaneseNoteFromMenu } from "./japanese-helpers.mjs";

async function createJapaneseNote(page, buttonName, expectedTitle) {
  await createJapaneseNoteFromMenu(page, buttonName);
  const title = page.getByRole("textbox", { name: "Note title", exact: true });
  await expect(title).toHaveValue(expectedTitle);
  await expect(title).toBeFocused();
  await closeNoteEditor(page);
}

test("Japanese filters compose with search, validate ranges, and stay workspace-local", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await expect(page.getByRole("region", { name: "Japanese note filters" })).toBeHidden();

  await page.getByRole("button", { name: "日本語", exact: true }).click();
  const filters = page.getByRole("region", { name: "Japanese note filters" });
  const common = page.getByRole("group", { name: "Japanese common filters" });
  await expect(filters).toBeHidden();
  for (const name of ["All", "Vocabulary", "Grammar", "Kanji", "Reading", "+ Filter"]) {
    await expect(common.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(common.getByRole("button", { name: "All", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(common.getByRole("button", { name: "Reading", exact: true })).toBeDisabled();
  await expect(common.getByRole("button", { name: "Reading", exact: true }))
    .toHaveAttribute("title", "Reading filters require the Japanese V2 learning model");
  await expect(common.getByRole("button", { name: "Reading", exact: true }))
    .toHaveAccessibleDescription("Reading filters require the Japanese V2 learning model");
  await expect(page.getByRole("button", { name: /Apply/i })).toHaveCount(0);
  await common.getByRole("button", { name: "+ Filter", exact: true }).click();
  await expect(filters).toBeVisible();

  await createJapaneseNote(page, "Create vocabulary note", "New vocabulary");
  await createJapaneseNote(page, "Create kanji note", "新しい漢字");
  await createJapaneseNote(page, "Create grammar note", "New grammar pattern");

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

  const search = page.locator("#searchInput");
  await search.fill("New");
  await common.getByRole("button", { name: "Grammar", exact: true }).click();
  await expect(common.getByRole("button", { name: "Grammar", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#noteList .note-item-title")).toHaveText("New grammar pattern");
  await expect(search).toHaveValue("New");
  await common.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(2);
  await search.fill("");

  await page.locator("#japaneseDateFrom").fill("2026-07-30");
  await page.locator("#japaneseDateTo").fill("2026-07-31");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(2);
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Showing 2 of 3 Japanese notes");

  await page.locator("#japaneseNoteType").selectOption("grammar");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(1);
  await expect(page.locator("#noteList .note-item-title")).toHaveText("New grammar pattern");
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Showing 1 of 3 Japanese notes");

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(filters).toBeHidden();
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(4);

  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(filters).toBeVisible();
  await expect(page.locator("#japaneseNoteType")).toHaveValue("grammar");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(1);

  await page.locator("#japaneseDateFrom").fill("2026-08-01");
  await expect(page.locator("#japaneseDateFrom")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#japaneseDateTo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Created from must be on or before Created to");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear all" }).click();
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(3);
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("Showing 3 of 3 Japanese notes");
  await expect(common.getByRole("button", { name: "All", exact: true })).toBeFocused();
});
