import { expect, test } from "@playwright/test";

async function createInitialNote(page) {
  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
}

async function createAndSave(page, title, content) {
  await page.locator("#newNoteButton").click();
  await expect(page.locator("#titleInput")).toBeFocused();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await page.locator("#contentInput").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
}

test("editor overlay owns drawing projection, title, save status, Details, and More without permanent Save", async ({ page }) => {
  await page.goto("/");
  await createInitialNote(page);

  const header = page.locator("#editorContextHeader");
  await expect(header).toBeVisible();
  await expect(header.locator("#titleInput")).toHaveCount(1);
  await expect(header.locator("#saveState")).toHaveCount(1);
  await expect(page.locator("#noteDrawingRegion")).toBeHidden();
  await expect(header.getByRole("button", { name: "Details", exact: true })).toBeVisible();
  await expect(header.getByRole("button", { name: "More actions", exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Delete note", exact: true })).toHaveCount(0);

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
  await createInitialNote(page);
  const opener = page.getByRole("button", { name: "Details", exact: true });

  await expect(page.locator("#noteInspector")).toBeHidden();
  await expect(page.locator("body")).not.toContainText("No backlinks yet");
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("complementary", { name: "Note details" })).toBeVisible();
  await expect(page.locator("#noteMetadataRegion")).toContainText("Storage");
  await expect(page.locator("#noteMetadataRegion")).toContainText("local");
  await expect(page.locator("#backlinksRegion")).toBeHidden();
  await expect(page.locator("#noteSupplementaryRegion")).toBeHidden();

  await page.getByRole("button", { name: "Close details", exact: true }).click();
  await expect(page.locator("#noteInspector")).toBeHidden();
  await expect(opener).toBeFocused();
});

test("More actions resolves current registry metadata and labelled recoverable delete", async ({ page }) => {
  await page.goto("/");
  await createAndSave(page, "Recoverable note", "Delete and undo evidence");
  await expect(page.locator("#noteCount")).toHaveText("1 note");

  const opener = page.getByRole("button", { name: "More actions", exact: true });
  await opener.click();
  const popover = page.getByRole("menu", { name: "Note actions" });
  await expect(popover).toBeVisible();
  await expect(page.locator("#pinNoteButton")).toHaveAccessibleName("Pin note");
  await expect(popover.getByRole("menuitem", { name: /Save note/ })).toHaveCount(0);
  await expect(popover.getByRole("menuitem", { name: /Toggle pin active note/ })).toHaveCount(0);
  await expect(popover.getByRole("menuitem", { name: /Archive active note/ })).toBeVisible();
  await expect(popover.getByRole("menuitem", { name: /Add drawing/ })).toBeVisible();
  const deleteItem = popover.getByRole("menuitem", { name: /Delete active note/ });
  await expect(deleteItem).toContainText("Recoverable through Undo");
  await deleteItem.click();

  await expect(page.locator("#noteCount")).toHaveText("0 notes");
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  const notice = page.getByRole("status", { name: "Deletion recovery" });
  await expect(notice).toContainText("Note deleted");
  await notice.getByRole("button", { name: "Undo delete", exact: true }).click();
  await expect(page.locator("#noteCount")).toHaveText("1 note");
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

test("list view renders upstream results as semantic pinned and notes board sections", async ({ page }) => {
  await page.goto("/");

  const snapshot = await page.evaluate(async () => {
    const { createListView } = await import("/ui/list.js");
    const container = globalThis.document.createElement("div");
    globalThis.document.body.append(container);
    const selectedIds = [];
    const notes = [
      {
        id: "note-2",
        title: "Second note",
        content: "Second",
        updatedAt: "2026-08-12T02:00:00.000Z",
        pinned: false,
      },
      {
        id: "pinned-1",
        title: "Pinned note",
        content: "Pinned",
        updatedAt: "2026-08-12T01:00:00.000Z",
        pinned: true,
      },
      {
        id: "note-1",
        title: "First note",
        content: "First",
        updatedAt: "2026-08-12T00:00:00.000Z",
        pinned: false,
      },
    ];
    createListView({
      container,
      onSelect(id) {
        selectedIds.push(id);
      },
      formatDate() {
        return "Aug 12";
      },
    }).render({
      notesById: new Map(notes.map((note) => [note.id, note])),
      orderedIds: ["note-2", "pinned-1", "stale", "note-1"],
      activeId: "pinned-1",
      query: "",
    });

    container.querySelector('[data-id="note-2"]').click();
    const result = {
      headings: [...container.querySelectorAll(".note-board-heading")]
        .map((node) => node.textContent),
      sections: [...container.querySelectorAll(".note-board-section")].map((section) => ({
        id: section.dataset.sectionId,
        cards: [...section.querySelectorAll(".note-item")].map((card) => card.dataset.id),
      })),
      activeId: container.querySelector('.note-item[aria-current="true"]')?.dataset.id,
      selectedIds,
      virtualized: container.dataset.virtualized,
    };
    container.remove();
    return result;
  });

  expect(snapshot).toEqual({
    headings: ["PINNED", "NOTES"],
    sections: [
      { id: "pinned", cards: ["pinned-1"] },
      { id: "notes", cards: ["note-2", "note-1"] },
    ],
    activeId: "pinned-1",
    selectedIds: ["note-2"],
    virtualized: "false",
  });
});

test("list view virtualizes at the documented 500-note boundary", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const { createListView } = await import("/ui/list.js");
    const container = globalThis.document.createElement("div");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 720 },
      clientWidth: { configurable: true, value: 1000 },
    });
    globalThis.document.body.append(container);
    const notes = Array.from({ length: 500 }, (_, index) => ({
      id: `note-${index}`,
      title: `Note ${index}`,
      content: "Bounded preview",
      updatedAt: "2026-08-12T00:00:00.000Z",
      pinned: index < 2,
    }));
    const view = createListView({ container, onSelect() {}, formatDate: () => "Aug 12" });
    const notesById = new Map(notes.map((note) => [note.id, note]));

    view.render({
      notesById,
      orderedIds: notes.slice(0, 499).map((note) => note.id),
      activeId: null,
      query: "",
    });
    const below = {
      virtualized: container.dataset.virtualized,
      cards: container.querySelectorAll(".note-item").length,
    };

    view.render({
      notesById,
      orderedIds: notes.map((note) => note.id),
      activeId: null,
      query: "",
    });
    const atBoundary = {
      virtualized: container.dataset.virtualized,
      cards: container.querySelectorAll(".note-item").length,
      headings: [...container.querySelectorAll(".note-board-heading")]
        .map((node) => node.textContent),
    };
    container.remove();
    return { below, atBoundary };
  });

  expect(result.below).toEqual({ virtualized: "false", cards: 499 });
  expect(result.atBoundary.virtualized).toBe("true");
  expect(result.atBoundary.cards).toBeGreaterThan(0);
  expect(result.atBoundary.cards).toBeLessThan(500);
  expect(result.atBoundary.headings).toEqual(["PINNED", "NOTES"]);
});