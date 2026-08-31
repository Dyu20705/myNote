import { test, expect } from "@playwright/test";

test.describe("Grid View & View Mode Switcher (#131)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("switches between list and grid view with accessible button states", async ({ page }) => {
    const viewModeButton = page.locator("#viewModeButton");
    const noteList = page.locator("#noteList");

    await expect(noteList).toHaveAttribute("data-view-mode", "list");
    await expect(viewModeButton).toHaveText("Grid view");
    await expect(viewModeButton).toHaveAttribute("aria-label", "Switch to grid view");

    await viewModeButton.click();
    await expect(noteList).toHaveAttribute("data-view-mode", "grid");
    await expect(viewModeButton).toHaveText("List view");
    await expect(viewModeButton).toHaveAttribute("aria-label", "Switch to list view");

    await viewModeButton.click();
    await expect(noteList).toHaveAttribute("data-view-mode", "list");
    await expect(viewModeButton).toHaveText("Grid view");
    await expect(viewModeButton).toHaveAttribute("aria-label", "Switch to grid view");
  });

  test("opens card in grid view", async ({ page }) => {
    // Create first note
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
    await page.locator("#titleInput").fill("First Grid Note");
    await page.locator("#contentInput").fill("Body content for grid testing.");
    await page.locator("#closeNoteEditorButton").click();
    await expect(page.locator("#noteEditorOverlay")).toBeHidden();

    // Switch to Grid View
    const viewModeButton = page.locator("#viewModeButton");
    await viewModeButton.click();
    await expect(page.locator("#noteList")).toHaveAttribute("data-view-mode", "grid");

    // Click note item card
    const card = page.locator(".note-item").filter({ hasText: "First Grid Note" });
    await card.click();

    // Verify editor opens with correct content
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();
    await expect(page.locator("#titleInput")).toHaveValue("First Grid Note");
  });

  test("persists view mode preference across reloads", async ({ page }) => {
    const viewModeButton = page.locator("#viewModeButton");
    const noteList = page.locator("#noteList");

    await viewModeButton.click();
    await expect(noteList).toHaveAttribute("data-view-mode", "grid");

    // Wait a brief tick for IndexedDB settings put
    await page.waitForTimeout(300);

    // Reload page
    await page.reload();

    await expect(page.locator("#noteList")).toHaveAttribute("data-view-mode", "grid");
    await expect(page.locator("#viewModeButton")).toHaveText("List view");
  });

  test("supports 2D keyboard navigation across grid cards", async ({ page }) => {
    // Create three notes
    for (const title of ["Card Alpha", "Card Beta", "Card Gamma"]) {
      await page.getByRole("button", { name: "New note", exact: true }).first().click();
      await page.locator("#titleInput").fill(title);
      await page.locator("#closeNoteEditorButton").click();
      await expect(page.locator("#noteEditorOverlay")).toBeHidden();
    }

    // Switch to grid view
    await page.locator("#viewModeButton").click();
    await expect(page.locator("#noteList")).toHaveAttribute("data-view-mode", "grid");

    const cards = page.locator(".note-item");
    await expect(cards).toHaveCount(3);

    // Focus first card
    await cards.first().focus();
    await expect(cards.first()).toBeFocused();

    // Press ArrowRight or ArrowDown to move to next card
    await page.keyboard.press("ArrowRight");
    await expect(cards.nth(1)).toBeFocused();

    // Press ArrowRight to move to third card
    await page.keyboard.press("ArrowRight");
    await expect(cards.nth(2)).toBeFocused();

    // Press ArrowLeft to move back to second card
    await page.keyboard.press("ArrowLeft");
    await expect(cards.nth(1)).toBeFocused();

    // Press Enter on focused card to open editor
    await page.keyboard.press("Enter");
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  });

  test("virtualizes large dataset in multi-column grid view (>500 items)", async ({ page }) => {
    // Populate 600 synthetic notes via state
    const result = await page.evaluate(async () => {
      const { createListView } = await import("/ui/list.js");
      const container = globalThis.document.createElement("div");
      Object.defineProperties(container, {
        clientHeight: { configurable: true, value: 720 },
        clientWidth: { configurable: true, value: 1000 },
      });
      globalThis.document.body.append(container);

      const notes = Array.from({ length: 600 }, (_, index) => ({
        id: `note-${index}`,
        title: `Virtual Note ${index}`,
        content: `Preview content for note ${index}`,
        updatedAt: "2026-08-12T00:00:00.000Z",
        pinned: index < 3,
      }));
      const notesById = new Map(notes.map((note) => [note.id, note]));
      const orderedIds = notes.map((note) => note.id);

      let selectedId = null;
      const view = createListView({
        container,
        onSelect(id) {
          selectedId = id;
        },
        formatDate: () => "Aug 12",
      });

      // 1. Render in grid mode with 600 items
      view.render({
        notesById,
        orderedIds,
        activeId: null,
        query: "",
        viewMode: "grid",
      });

      const initialCards = container.querySelectorAll(".note-item").length;
      const virtualized = container.dataset.virtualized;
      const viewMode = container.dataset.viewMode;

      // Select first card
      const firstCard = container.querySelector(".note-item");
      firstCard?.click();

      // 2. Switch to list mode
      view.render({
        notesById,
        orderedIds,
        activeId: "note-0",
        query: "",
        viewMode: "list",
      });
      const listModeCards = container.querySelectorAll(".note-item").length;
      const listModeVirtualized = container.dataset.virtualized;

      container.remove();
      return {
        initialCards,
        virtualized,
        viewMode,
        selectedId,
        listModeCards,
        listModeVirtualized,
      };
    });

    expect(result.virtualized).toBe("true");
    expect(result.viewMode).toBe("grid");
    expect(result.initialCards).toBeGreaterThan(0);
    expect(result.initialCards).toBeLessThan(600);
    expect(result.selectedId).toBe("note-0");
    expect(result.listModeVirtualized).toBe("true");
    expect(result.listModeCards).toBeGreaterThan(0);
    expect(result.listModeCards).toBeLessThan(600);
  });
});
