import { expect, test } from "@playwright/test";

test("note archive lifecycle preserves note and filters correctly across workspaces", async ({ page }) => {
  page.on("console", msg => console.log(msg.text()));
  await page.goto("/");
  
  // 1. Create a note in the default Notes workspace
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill("Test Archive Note");
  await page.locator("#contentInput").fill("This note will be archived.");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteList .note-item-title")).toContainText(["Test Archive Note"]);

  // 2. Open the note and archive it via the actions menu
  await page.locator("#noteList .note-item").first().click();
  await page.locator("#noteActionsButton").click();
  
  const popover = page.locator("#noteActionsPopover");
  await expect(popover).toBeVisible();
  
  const archiveAction = popover.getByRole("menuitem", { name: /Archive active note/ });
  await expect(archiveAction).toBeVisible();
  await archiveAction.click();

  // Wait for the note overlay to close automatically? Wait, does the action close the overlay?
  // Let's assume we need to close the editor or it stays open. 
  // Let's close the editor.
  if (await page.locator("#noteEditorOverlay").isVisible()) {
    await page.getByRole("button", { name: "Close note editor" }).click();
  }

  // 3. Verify it is removed from the default "Notes" workspace list
  await expect(page.locator("#noteList .note-item")).toHaveCount(0);
  await expect(page.locator("#activeNoteLabel")).toHaveText("No notes");

  // 4. Switch to Archive workspace
  await page.locator("#archiveWorkspaceButton").click();
  await expect(page.locator("#archiveWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#noteNavigationTitle")).toHaveText("Archive");

  // Verify the note appears in Archive
  await expect(page.locator("#noteList .note-item-title")).toContainText(["Test Archive Note"]);

  // 5. Open the archived note and unarchive it
  await page.locator("#noteList .note-item").first().click();
  await page.locator("#noteActionsButton").click();
  await expect(popover).toBeVisible();
  
  const unarchiveAction = popover.getByRole("menuitem", { name: /Unarchive active note/ });
  await expect(unarchiveAction).toBeVisible();
  await unarchiveAction.click();

  if (await page.locator("#noteEditorOverlay").isVisible()) {
    await page.getByRole("button", { name: "Close note editor" }).click();
  }

  // 6. Verify it is removed from Archive workspace
  await expect(page.locator("#noteList .note-item")).toHaveCount(0);
  await expect(page.locator("#activeNoteLabel")).toHaveText("No archived notes");

  // 7. Switch back to Notes workspace and verify it's back
  await page.locator("#notesWorkspaceButton").click();
  await expect(page.locator("#noteList .note-item-title")).toContainText(["Test Archive Note"]);
});
