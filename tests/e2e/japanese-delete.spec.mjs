import { expect, test } from "@playwright/test";
import {
  createJapaneseNoteFromMenu,
  openJapaneseReviewSubview,
} from "./japanese-helpers.mjs";

async function openJapaneseWorkspace(page) {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute("aria-pressed", "true");
}

async function enrolledRecordPresence(page, noteId) {
  return page.evaluate(async (id) => {
    const { getActiveStore } = await import("/core/state.js");
    const store = getActiveStore();
    const state = store.getState();
    return {
      note: state.notes.some((note) => note.id === id),
      review: state.studyReviews.some((review) => review.noteId === id),
    };
  }, noteId);
}

test("palette delete, undo, and Delete key keep enrolled note and review atomic across reloads", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect(page.locator("#japaneseDueCount")).toHaveText("1");

  const noteId = await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    return getActiveStore().getState().activeId;
  });
  expect(noteId).toBeTruthy();
  await expect.poll(() => enrolledRecordPresence(page, noteId)).toEqual({ note: true, review: true });

  await page.keyboard.press("Control+k");
  await page.locator("#commandInput").fill("Delete active note");
  await page.locator("#commandInput").press("Enter");

  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
  await expect.poll(() => enrolledRecordPresence(page, noteId)).toEqual({ note: false, review: false });

  await openJapaneseReviewSubview(page);
  await page.getByRole("heading", { name: "Study dashboard" }).click();
  await page.keyboard.press("Control+z");

  await expect(page.locator("#japaneseDueCount")).toHaveText("1");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect.poll(() => enrolledRecordPresence(page, noteId)).toEqual({ note: true, review: true });

  await page.reload();
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("#japaneseDueCount")).toHaveText("1");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect.poll(() => enrolledRecordPresence(page, noteId)).toEqual({ note: true, review: true });

  await openJapaneseReviewSubview(page);
  await page.getByRole("heading", { name: "Study dashboard" }).click();
  await page.keyboard.press("Delete");

  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
  await expect.poll(() => enrolledRecordPresence(page, noteId)).toEqual({ note: false, review: false });

  await page.reload();
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
  await expect.poll(() => enrolledRecordPresence(page, noteId)).toEqual({ note: false, review: false });
});
