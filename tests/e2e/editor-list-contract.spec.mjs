import { expect, test } from "@playwright/test";

async function createAndSave(page, title, content) {
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#contentInput")).toBeFocused();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");
}

test("editor context header owns title, save status, Details, and More without permanent Save", async ({ page }) => {
  await page.goto("/");

  const header = page.locator("#editorContextHeader");
  await expect(header).toBeVisible();
  await expect(header.locator("#titleInput")).toHaveCount(1);
  await expect(header.locator("#saveState")).toHaveCount(1);
  await expect(header.getByRole("button", { name: "Details" })).toBeVisible();
  await expect(header.getByRole("button", { name: "More actions" })).toBeVisible();
  await expect(page.locator("#saveButton")).toHaveCount(0);
  await expect(page.locator("#applicationHeader #saveState")).toHaveCount(0);
});

test("note cards use bounded plain text and semantic non-color selection without a permanent delete control", async ({ page }) => {
  await page.goto("/");
  await createAndSave(
    page,
    "Markdown scan note",
    "# Heading\n- [x] Read **grammar** and [[N5 index]]\n<script>alert('no')</script>",
  );

  const activeCard = page.locator("#noteList .note-item").filter({ hasText: "Markdown scan note" });
  await expect(activeCard).toHaveAttribute("aria-current", "true");
  await expect(activeCard.locator(".note-item-preview")).toHaveText(
    "Heading Read grammar and N5 index alert('no')",
  );
  await expect(activeCard).not.toContainText("**");
  await expect(activeCard).not.toContainText("[[");
  await expect(page.locator(".note-item-delete")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete note" })).toHaveCount(0);

  const selectedGeometry = await activeCard.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      fontWeight: Number.parseInt(style.fontWeight, 10),
    };
  });
  expect(selectedGeometry.boxShadow).toContain("inset");
  expect(selectedGeometry.fontWeight).toBeGreaterThanOrEqual(600);
});

test("Details progressively discloses metadata, hides empty backlinks, and returns focus", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Details" });

  await expect(page.locator("#noteInspector")).toBeHidden();
  await expect(page.locator("body")).not.toContainText("No backlinks yet");
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("complementary", { name: "Note details" })).toBeVisible();
  await expect(page.locator("#noteMetadataRegion")).toContainText("Storage: local");
  await expect(page.locator("#backlinksRegion")).toBeHidden();
  await expect(page.locator("#noteSupplementaryRegion")).toBeHidden();

  await page.getByRole("button", { name: "Close details" }).click();
  await expect(page.locator("#noteInspector")).toBeHidden();
  await expect(opener).toBeFocused();
});

test("More actions resolves current registry metadata and labelled recoverable delete", async ({ page }) => {
  await page.goto("/");
  await createAndSave(page, "Recoverable note", "Delete and undo evidence");
  await expect(page.locator("#noteCount")).toHaveText("2 notes");

  const opener = page.getByRole("button", { name: "More actions" });
  await opener.click();
  const popover = page.getByRole("menu", { name: "Note actions" });
  await expect(popover).toBeVisible();
  await expect(popover.getByRole("menuitem", { name: /Save note/ })).toBeVisible();
  await expect(popover.getByRole("menuitem", { name: /Toggle pin active note/ })).toBeVisible();
  await expect(popover.getByRole("menuitem", { name: /Archive active note/ })).toBeVisible();
  const deleteItem = popover.getByRole("menuitem", { name: /Delete active note/ });
  await expect(deleteItem).toContainText("Recoverable through Undo");
  await deleteItem.click();

  await expect(page.locator("#noteCount")).toHaveText("1 note");
  const notice = page.getByRole("status", { name: "Deletion recovery" });
  await expect(notice).toContainText("Note deleted");
  await notice.getByRole("button", { name: "Undo delete" }).click();
  await expect(page.locator("#noteCount")).toHaveText("2 notes");
  await expect(page.locator("#titleInput")).toHaveValue("Recoverable note");
});

test("explicit save and delete remain discoverable through the shared command registry", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.locator("#commandInput").fill("Save note");
  await expect(page.locator("#commandList [data-command-id='editor.save']")).toBeVisible();
  await page.locator("#commandInput").fill("Delete active note");
  await expect(page.locator("#commandList [data-command-id='notes.delete']")).toBeVisible();
});
