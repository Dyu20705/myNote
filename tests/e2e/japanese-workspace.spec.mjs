import { expect, test } from "@playwright/test";
import {
  closeNoteEditor,
  createJapaneseNoteFromMenu,
  openJapaneseReview,
  openJapaneseStudyDetails,
} from "./japanese-helpers.mjs";

async function openJapaneseWorkspace(page) {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute("aria-pressed", "true");
}

test("Notes remains default and workspace switching preserves the active ordinary note", async ({ page }) => {
  await page.goto("/");

  const notesButton = page.getByRole("button", { name: "Notes", exact: true });
  const japaneseButton = page.getByRole("button", { name: "日本語" });
  await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
  await expect(notesButton).toHaveAttribute("aria-pressed", "true");
  await expect(japaneseButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#japaneseDashboard")).toBeHidden();

  const initialTitle = await page.locator("#titleInput").inputValue();
  await japaneseButton.click();

  await expect(japaneseButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#japaneseReviewEntryButton")).toBeVisible();
  await expect(page.getByRole("button", { name: "New Japanese note" })).toBeVisible();
  await expect(page.locator("#japaneseDashboard")).toBeHidden();

  await openJapaneseStudyDetails(page);
  await expect(page.locator("#japaneseDashboard")).toBeVisible();
  await expect(page.locator("#japaneseDashboard [data-dashboard-card]")).toHaveCount(6);
  await expect(page.getByRole("region", { name: "Needs repair" })).toBeHidden();

  await notesButton.click();
  await expect(notesButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#japaneseDashboard")).toBeHidden();
  await expect(page.locator("#titleInput")).toHaveValue(initialTitle);
});

test("quick create updates the filtered workspace and deterministic dashboard", async ({ page }) => {
  await openJapaneseWorkspace(page);

  await createJapaneseNoteFromMenu(page, "Create vocabulary note");

  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect(page.locator("#japaneseDueCount")).toHaveText("1");
  await expect(page.locator("#japaneseNewVocabulary")).toHaveText("1");
  await expect(page.locator("#noteList .note-item-title")).toContainText(["New vocabulary"]);
  await closeNoteEditor(page);

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.locator("#noteCount")).toHaveText("2 notes");
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
});

test("command palette exposes the five Japanese quick-create commands", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");

  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("button", { name: "Create vocabulary note" })).toBeVisible();
  await expect(palette.getByRole("button", { name: "Create kanji note" })).toBeVisible();
  await expect(palette.getByRole("button", { name: "Create grammar note" })).toBeVisible();
  await expect(palette.getByRole("button", { name: "Create today’s output note" })).toBeVisible();
  await expect(palette.getByRole("button", { name: "Create this week’s planner" })).toBeVisible();

  await page.locator("#commandInput").fill("Create kanji note");
  await page.locator("#commandInput").press("Enter");

  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#titleInput")).toHaveValue("新しい漢字");
});

test("review content stays hidden, close resumes, and all ratings are keyboard reachable", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await closeNoteEditor(page);
  const reviewEntry = await openJapaneseReview(page);

  const dialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#reviewContent")).toBeHidden();
  await expect(page.getByText("Content hidden until reveal")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(reviewEntry).toBeFocused();

  await reviewEntry.click();
  await page.getByRole("button", { name: "Reveal review content" }).click();
  await expect(page.locator("#reviewContent")).toBeVisible();
  await expect(page.locator("#reviewContent")).toContainText("## Reading");

  for (const name of ["Again", "Hard", "Good", "Easy"]) {
    await expect(page.getByRole("button", { name })).toBeEnabled();
  }

  await page.getByRole("button", { name: "Good" }).click();
  await expect(page.getByText("Review complete")).toBeVisible();
  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
});

test("rating persistence failure remains visible and retryable without advancing", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await closeNoteEditor(page);
  await openJapaneseReview(page);
  await page.getByRole("button", { name: "Reveal review content" }).click();

  await page.evaluate(() => {
    const original = globalThis.IDBObjectStore.prototype.put;
    Object.defineProperty(globalThis, "__restoreStudyPut", {
      configurable: true,
      value() {
        globalThis.IDBObjectStore.prototype.put = original;
      },
    });
    globalThis.IDBObjectStore.prototype.put = function put() {
      throw new Error("Synthetic review write failure");
    };
  });

  await page.getByRole("button", { name: "Easy" }).click();
  await expect(page.getByText("Save failed; retry rating")).toBeVisible();
  await expect(page.getByRole("button", { name: "Easy" })).toBeEnabled();
  await expect(page.locator("#reviewContent")).toBeVisible();

  await page.evaluate(() => globalThis.__restoreStudyPut());
  await page.getByRole("button", { name: "Easy" }).click();
  await expect(page.getByText("Review complete")).toBeVisible();
});

test("review session deterministically skips missing and archived current notes", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await closeNoteEditor(page);
  await createJapaneseNoteFromMenu(page, "Create kanji note");
  await closeNoteEditor(page);
  await createJapaneseNoteFromMenu(page, "Create grammar note");
  await closeNoteEditor(page);
  await expect(page.locator("#japaneseDueCount")).toHaveText("3");

  await openJapaneseReview(page);
  await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const store = getActiveStore();
    const state = store.getState();
    store.setState({
      notes: state.notes.filter((note) => note.id !== state.reviewSession.currentNoteId),
    });
  });
  await page.getByRole("button", { name: "Reveal review content" }).click();
  await expect(page.getByText("Skipped missing note")).toBeVisible();
  await expect(page.locator("#reviewContent")).toBeHidden();

  await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const store = getActiveStore();
    const state = store.getState();
    store.setState({
      notes: state.notes.map((note) => note.id === state.reviewSession.currentNoteId
        ? { ...note, archived: true }
        : note),
    });
  });
  await page.getByRole("button", { name: "Reveal review content" }).click();
  await expect(page.getByText("Skipped archived note")).toBeVisible();
  await expect(page.locator("#reviewContent")).toBeHidden();

  await page.getByRole("button", { name: "Reveal review content" }).click();
  await expect(page.locator("#reviewContent")).toBeVisible();
  await page.getByRole("button", { name: "Good" }).click();
  await expect(page.getByText("Review complete")).toBeVisible();
});
