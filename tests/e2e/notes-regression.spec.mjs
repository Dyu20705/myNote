import { expect, test } from "@playwright/test";

async function runCommand(page, title) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.locator("#commandInput").fill(title);
  await page.locator("#commandInput").press("Enter");
}

async function createAndSave(page, title, content) {
  await page.locator("#newNoteButton").click();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await page.getByRole("button", { name: "Close note editor" }).click();
}

async function activeNoteField(page, field) {
  return page.evaluate(async (fieldName) => {
    const { getActiveStore } = await import("/core/state.js");
    const store = getActiveStore();
    const state = store.getState();
    return state.notes.find((note) => note.id === state.activeId)?.[fieldName];
  }, field);
}

test("generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational", async ({ page }) => {
  const title = "Generic regression note";
  const content = "Searchable generic regression body";

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#noteCount")).toHaveText("0 notes");

  await createAndSave(page, "Navigation peer", "Peer body");
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await expect(page.locator("#saveState")).toHaveText("Unsaved");
  await page.locator("#contentInput").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await expect(page.locator("#noteCount")).toHaveText("2 notes");
  await page.getByRole("button", { name: "Close note editor" }).click();

  await page.locator("#searchInput").fill("Searchable generic");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(1);
  await expect(page.locator("#noteList .note-item-title")).toHaveText(title);
  await page.locator("#searchInput").fill("");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(2);

  await page.locator("#noteCount").click();
  await page.keyboard.press("j");
  await expect(page.locator("#titleInput")).not.toHaveValue(title);
  await page.keyboard.press("k");
  await expect(page.locator("#titleInput")).toHaveValue(title);

  await runCommand(page, "Toggle pin active note");
  await expect.poll(() => activeNoteField(page, "pinned")).toBe(true);

  const downloadPromise = page.waitForEvent("download");
  await runCommand(page, "Export all as JSON");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("myNote-export.json");

  await runCommand(page, "Archive active note");
  await expect.poll(() => activeNoteField(page, "archived")).toBe(true);

  await runCommand(page, "Reset local database");
  await expect(page.locator("#applicationResetDialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("#applicationResetDialog")).toBeHidden();
  await expect(page.locator("#noteCount")).toHaveText("2 notes");
  await expect(page.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
});