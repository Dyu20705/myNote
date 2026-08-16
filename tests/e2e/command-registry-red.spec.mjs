import { expect, test } from "@playwright/test";
import {
  createJapaneseNoteFromMenu,
  openJapaneseReview,
} from "./japanese-helpers.mjs";

async function openApplication(page) {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("0 notes");
  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
}

async function createOrdinaryNote(page, title) {
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(`${title} body`);
  await page.locator("#contentInput").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteList .note-item-title")).toContainText([title]);
}

async function closeNoteEditor(page) {
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
}

async function openJapaneseWorkspace(page) {
  await openApplication(page);
  await page.locator("#japaneseWorkspaceButton").click();
  await expect(page.locator("#japaneseWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
}

async function openPalette(page) {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  return palette;
}

test("application create shortcut yields to an active editor draft", async ({ page }) => {
  await openApplication(page);
  await page.locator("#noteList .note-item").first().click();

  const title = page.locator("#titleInput");
  await title.fill("Draft in progress");
  await title.focus();

  await title.dispatchEvent("keydown", {
    key: "n",
    code: "KeyN",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(500);

  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await expect(title).toHaveValue("Draft in progress");
  await expect(title).toBeFocused();
});

test("IME composition suppresses shell navigation commands", async ({ page }) => {
  await openApplication(page);
  await createOrdinaryNote(page, "Second note");
  await expect(page.locator("#noteCount")).toHaveText("2 notes");
  await expect(page.locator("#titleInput")).toHaveValue("Second note");

  const shellControl = page.locator("#notesWorkspaceButton");
  await shellControl.focus();
  await shellControl.dispatchEvent("compositionstart", { bubbles: true });
  await shellControl.dispatchEvent("keydown", {
    key: "j",
    code: "KeyJ",
    isComposing: true,
    bubbles: true,
    cancelable: true,
  });
  await shellControl.dispatchEvent("compositionend", { data: "じ", bubbles: true });
  await page.waitForTimeout(250);

  await expect(page.locator("#titleInput")).toHaveValue("Second note");
  await expect(shellControl).toBeFocused();
});

test("review modal isolates background note-navigation commands", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await closeNoteEditor(page);
  await createJapaneseNoteFromMenu(page, "Create kanji note");
  await expect(page.locator("#titleInput")).toHaveValue("新しい漢字");
  await closeNoteEditor(page);

  await openJapaneseReview(page);
  await page.getByRole("button", { name: "Reveal review content" }).click();
  const dialog = page.getByRole("dialog", { name: "Japanese review session" });
  const good = page.getByRole("button", { name: "Good" });
  await expect(dialog).toBeVisible();
  await good.focus();

  const backgroundTitle = await page.locator("#titleInput").inputValue();
  await page.keyboard.press("j");
  await page.waitForTimeout(250);

  await expect(dialog).toBeVisible();
  await expect(good).toBeFocused();
  await expect(page.locator("#titleInput")).toHaveValue(backgroundTitle);
});

test("review numeric shortcut remains owned by the active modal", async ({ page }) => {
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await closeNoteEditor(page);
  await openJapaneseReview(page);
  await page.getByRole("button", { name: "Reveal review content" }).click();

  await page.getByRole("button", { name: "Good" }).focus();
  await page.keyboard.press("3");
  await expect(page.getByText("Review complete")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Japanese review session" })).toBeVisible();
});

test("an intervening key resets the gg sequence", async ({ page }) => {
  await openApplication(page);
  await createOrdinaryNote(page, "Second note");
  await expect(page.locator("#titleInput")).toHaveValue("Second note");

  await page.evaluate(() => {
    let syntheticNow = 1_000;
    Date.now = () => syntheticNow;
    Object.defineProperty(globalThis, "__setCommandTestNow", {
      configurable: true,
      value(next) {
        syntheticNow = next;
      },
    });
  });

  const shellControl = page.locator("#notesWorkspaceButton");
  await shellControl.focus();
  await page.keyboard.press("g");
  await page.keyboard.press("j");
  await expect(page.locator("#titleInput")).toHaveValue("Untitled");
  await page.evaluate(() => globalThis.__setCommandTestNow(1_100));
  await page.keyboard.press("g");
  await page.waitForTimeout(250);

  await expect(page.locator("#titleInput")).toHaveValue("Untitled");
  await expect(shellControl).toBeFocused();
});

test("palette and direct shortcut share Notes-workspace availability", async ({ page }) => {
  await openJapaneseWorkspace(page);

  const palette = await openPalette(page);
  const createCommand = palette.getByRole("button", { name: /New note/ });
  await expect(createCommand).toBeVisible();
  await expect(createCommand).toHaveAttribute("aria-disabled", "true");
  await expect(createCommand).toContainText("Switch to Notes workspace to create an ordinary note");

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  const beforeCount = await page.locator("#noteCount").textContent();

  const workspaceButton = page.locator("#japaneseWorkspaceButton");
  await workspaceButton.focus();
  await workspaceButton.dispatchEvent("keydown", {
    key: "n",
    code: "KeyN",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  await page.waitForTimeout(500);

  await expect(page.locator("#noteCount")).toHaveText(beforeCount);
  await expect(page.locator("#japaneseWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
});

test("Japanese commands remain discoverable with a degraded-state reason", async ({ page }) => {
  await openApplication(page);
  await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    getActiveStore().setState({ studyDataUnavailable: true });
  });

  const palette = await openPalette(page);
  const command = palette.getByRole("button", { name: /Create vocabulary note/ });
  await expect(command).toBeVisible();
  await expect(command).toHaveAttribute("aria-disabled", "true");
  await expect(command).toContainText("Japanese study data is unavailable");
});