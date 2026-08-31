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

  test("virtualizes large dataset with variable content and verifies top, middle, and bottom scrolling", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createListView } = await import("/ui/list.js");

      // Set up a real scrollable viewport wrapper
      const scrollOwner = globalThis.document.createElement("div");
      scrollOwner.className = "notes-panel";
      scrollOwner.style.height = "600px";
      scrollOwner.style.width = "1000px";
      scrollOwner.style.overflowY = "auto";
      scrollOwner.style.position = "relative";

      const container = globalThis.document.createElement("div");
      container.id = "noteList";
      container.className = "note-list";
      scrollOwner.append(container);
      globalThis.document.body.append(scrollOwner);

      // Generate 600 notes with highly variable content
      const notes = Array.from({ length: 600 }, (_, index) => {
        let title = `Note ${index}`;
        let content = `Regular preview content for note ${index}`;

        if (index >= 10 && index < 50) {
          title = `Extremely Long Title That Wraps Across Multiple Lines In Grid Mode For Stress Testing Note ${index}`;
        } else if (index >= 50 && index < 100) {
          content = "Detailed note preview paragraph with #grammar #n3 tags. ".repeat(15);
        } else if (index >= 100 && index < 150) {
          title = `UnbrokenContentNote_${index}_` + "W".repeat(60);
          content = "UnbrokenText_".repeat(30);
        } else if (index >= 250 && index < 350) {
          title = `Middle Range Note ${index}`;
        } else if (index >= 550) {
          title = `Bottom Range Note ${index}`;
        }

        return {
          id: `note-${index}`,
          title,
          content,
          tags: [`tag-${index % 10}`],
          updatedAt: new Date(Date.now() - index * 60000).toISOString(),
          pinned: index < 3,
        };
      });

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

      // 1. Initial Render at TOP (scrollTop = 0)
      view.render({
        notesById,
        orderedIds,
        activeId: null,
        query: "",
        viewMode: "grid",
      });

      const topCardIds = [...container.querySelectorAll(".note-item")].map((c) => c.dataset.id);
      const topCardCount = topCardIds.length;
      const topVirtualized = container.dataset.virtualized;
      const topHasNote0 = topCardIds.includes("note-0");
      const topHasNote300 = topCardIds.includes("note-300");
      const topHasNote599 = topCardIds.includes("note-599");
      const topOverflow = scrollOwner.scrollWidth > scrollOwner.clientWidth;

      // 2. Scroll to MIDDLE (scrollTop = 16800px ~ row 100)
      scrollOwner.scrollTop = 16800;
      scrollOwner.dispatchEvent(new globalThis.Event("scroll"));

      const midCardIds = [...container.querySelectorAll(".note-item")].map((c) => c.dataset.id);
      const midCardCount = midCardIds.length;
      const midHasNote0 = midCardIds.includes("note-0");
      const midHasNote300 = midCardIds.includes("note-300");
      const midHasNote599 = midCardIds.includes("note-599");
      const midOverflow = scrollOwner.scrollWidth > scrollOwner.clientWidth;

      // 3. Scroll to BOTTOM (scrollTop = max scroll)
      scrollOwner.scrollTop = scrollOwner.scrollHeight;
      scrollOwner.dispatchEvent(new globalThis.Event("scroll"));

      const bottomCardIds = [...container.querySelectorAll(".note-item")].map((c) => c.dataset.id);
      const bottomCardCount = bottomCardIds.length;
      const bottomHasNote0 = bottomCardIds.includes("note-0");
      const bottomHasNote300 = bottomCardIds.includes("note-300");
      const bottomHasNote598 = bottomCardIds.includes("note-598");
      const bottomHasNote599 = bottomCardIds.includes("note-599");
      const bottomOverflow = scrollOwner.scrollWidth > scrollOwner.clientWidth;

      // 4. Test Card Selection at bottom
      const lastCard = container.querySelector('.note-item[data-id="note-598"]');
      lastCard?.click();

      // 5. Switch to List Mode
      view.render({
        notesById,
        orderedIds,
        activeId: "note-598",
        query: "",
        viewMode: "list",
      });
      const listCardCount = container.querySelectorAll(".note-item").length;
      const listMode = container.dataset.viewMode;

      // Cleanup
      scrollOwner.remove();

      return {
        top: { count: topCardCount, virtualized: topVirtualized, hasNote0: topHasNote0, hasNote300: topHasNote300, hasNote599: topHasNote599, overflow: topOverflow },
        mid: { count: midCardCount, hasNote0: midHasNote0, hasNote300: midHasNote300, hasNote599: midHasNote599, overflow: midOverflow },
        bottom: { count: bottomCardCount, hasNote0: bottomHasNote0, hasNote300: bottomHasNote300, hasNote598: bottomHasNote598, hasNote599: bottomHasNote599, overflow: bottomOverflow },
        selectedId,
        listMode: { count: listCardCount, viewMode: listMode },
      };
    });

    // Top assertions
    expect(result.top.virtualized).toBe("true");
    expect(result.top.count).toBeGreaterThanOrEqual(15);
    expect(result.top.count).toBeLessThanOrEqual(80);
    expect(result.top.hasNote0).toBe(true);
    expect(result.top.hasNote300).toBe(false);
    expect(result.top.hasNote599).toBe(false);
    expect(result.top.overflow).toBe(false);

    // Middle assertions
    expect(result.mid.count).toBeGreaterThanOrEqual(15);
    expect(result.mid.count).toBeLessThanOrEqual(80);
    expect(result.mid.hasNote0).toBe(false);
    expect(result.mid.hasNote300).toBe(true);
    expect(result.mid.hasNote599).toBe(false);
    expect(result.mid.overflow).toBe(false);

    // Bottom assertions
    expect(result.bottom.count).toBeGreaterThanOrEqual(15);
    expect(result.bottom.count).toBeLessThanOrEqual(80);
    expect(result.bottom.hasNote0).toBe(false);
    expect(result.bottom.hasNote300).toBe(false);
    expect(result.bottom.hasNote598).toBe(true);
    expect(result.bottom.hasNote599).toBe(true);
    expect(result.bottom.overflow).toBe(false);

    // Interaction & View Mode assertions
    expect(result.selectedId).toBe("note-598");
    expect(result.listMode.viewMode).toBe("list");
    expect(result.listMode.count).toBeGreaterThanOrEqual(15);
    expect(result.listMode.count).toBeLessThanOrEqual(80);
  });
});
