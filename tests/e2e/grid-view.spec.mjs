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
    expect(result.top.count).toBeGreaterThanOrEqual(10);
    expect(result.top.count).toBeLessThanOrEqual(80);
    expect(result.top.hasNote0).toBe(true);
    expect(result.top.hasNote300).toBe(false);
    expect(result.top.hasNote599).toBe(false);
    expect(result.top.overflow).toBe(false);

    // Middle assertions
    expect(result.mid.count).toBeGreaterThanOrEqual(10);
    expect(result.mid.count).toBeLessThanOrEqual(80);
    expect(result.mid.hasNote0).toBe(false);
    expect(result.mid.hasNote300).toBe(true);
    expect(result.mid.hasNote599).toBe(false);
    expect(result.mid.overflow).toBe(false);

    // Bottom assertions
    expect(result.bottom.count).toBeGreaterThanOrEqual(10);
    expect(result.bottom.count).toBeLessThanOrEqual(80);
    expect(result.bottom.hasNote0).toBe(false);
    expect(result.bottom.hasNote300).toBe(false);
    expect(result.bottom.hasNote598).toBe(true);
    expect(result.bottom.hasNote599).toBe(true);
    expect(result.bottom.overflow).toBe(false);

    // Interaction & View Mode assertions
    expect(result.selectedId).toBe("note-598");
    expect(result.listMode.viewMode).toBe("list");
    expect(result.listMode.count).toBeGreaterThanOrEqual(10);
    expect(result.listMode.count).toBeLessThanOrEqual(80);
  });

  test("section-aware virtualization preserves Pinned and Notes section boundaries (5 pinned, 595 unpinned)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createListView } = await import("/ui/list.js");

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

      // 5 pinned notes + 595 normal notes = 600 notes
      const notes = Array.from({ length: 600 }, (_, index) => ({
        id: `note-${index}`,
        title: index < 5 ? `Pinned Card ${index}` : `Normal Card ${index}`,
        content: `Body preview for note ${index}`,
        tags: [],
        updatedAt: new Date(Date.now() - index * 60000).toISOString(),
        pinned: index < 5,
      }));

      const notesById = new Map(notes.map((n) => [n.id, n]));
      const orderedIds = notes.map((n) => n.id);

      const view = createListView({
        container,
        onSelect() {},
        formatDate: () => "Aug 12",
      });

      // Render in grid mode
      view.render({
        notesById,
        orderedIds,
        activeId: null,
        query: "",
        viewMode: "grid",
      });

      // 1. Check top: Pinned section and start of Notes section
      const topPinnedSection = container.querySelector('.note-board-section[data-section-id="pinned"]');
      const topNotesSection = container.querySelector('.note-board-section[data-section-id="notes"]');
      const topPinnedCardIds = [...(topPinnedSection?.querySelectorAll(".note-item") || [])].map((c) => c.dataset.id);
      const topNotesCardIds = [...(topNotesSection?.querySelectorAll(".note-item") || [])].map((c) => c.dataset.id);

      // 2. Scroll across boundary (e.g. 500px down)
      scrollOwner.scrollTop = 500;
      scrollOwner.dispatchEvent(new globalThis.Event("scroll"));

      const boundaryNotesSection = container.querySelector('.note-board-section[data-section-id="notes"]');
      const boundaryNotesCardIds = [...(boundaryNotesSection?.querySelectorAll(".note-item") || [])].map((c) => c.dataset.id);

      // 3. Scroll to bottom
      scrollOwner.scrollTop = scrollOwner.scrollHeight;
      scrollOwner.dispatchEvent(new globalThis.Event("scroll"));

      const bottomNotesSection = container.querySelector('.note-board-section[data-section-id="notes"]');
      const bottomNotesCardIds = [...(bottomNotesSection?.querySelectorAll(".note-item") || [])].map((c) => c.dataset.id);
      const bottomHasLastNote = bottomNotesCardIds.includes("note-599");

      scrollOwner.remove();

      return {
        top: {
          hasPinnedSection: Boolean(topPinnedSection),
          hasNotesSection: Boolean(topNotesSection),
          pinnedCards: topPinnedCardIds,
          notesFirstCard: topNotesCardIds[0],
          notesCardCount: topNotesCardIds.length,
        },
        boundary: {
          notesCards: boundaryNotesCardIds,
        },
        bottom: {
          hasLastNote: bottomHasLastNote,
          bottomCards: bottomNotesCardIds,
        },
      };
    });

    // Top checks
    expect(result.top.hasPinnedSection).toBe(true);
    expect(result.top.hasNotesSection).toBe(true);
    expect(result.top.pinnedCards).toEqual(["note-0", "note-1", "note-2", "note-3", "note-4"]);
    expect(result.top.notesFirstCard).toBe("note-5");
    expect(result.top.notesCardCount).toBeGreaterThan(0);

    // Boundary checks
    expect(result.boundary.notesCards.length).toBeGreaterThan(0);
    expect(result.boundary.notesCards.includes("note-5")).toBe(true);

    // Bottom checks
    expect(result.bottom.hasLastNote).toBe(true);
    expect(result.bottom.bottomCards.includes("note-598")).toBe(true);
    expect(result.bottom.bottomCards.includes("note-599")).toBe(true);
  });

  test("section-aware virtualization handles multi-category search result sections", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { createListView } = await import("/ui/list.js");

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

      // Create 600 notes producing multiple search sections when query is "kanji"
      const notes = Array.from({ length: 600 }, (_, index) => {
        let title = `Regular Note ${index}`;
        let content = `General content ${index}`;
        let tags = [];
        let japanese = false;

        if (index < 10) {
          title = `Kanji Title Match ${index}`;
        } else if (index < 30) {
          tags = ["kanji", "n3"];
        } else if (index < 80) {
          japanese = true;
          content = "Japanese study note";
        } else {
          content = `Body mentioning kanji study in note ${index}`;
        }

        return {
          id: `note-${index}`,
          title,
          content,
          tags,
          japanese,
          updatedAt: new Date(Date.now() - index * 60000).toISOString(),
          pinned: false,
        };
      });

      const notesById = new Map(notes.map((n) => [n.id, n]));
      const orderedIds = notes.map((n) => n.id);

      const view = createListView({
        container,
        onSelect() {},
        formatDate: () => "Aug 12",
      });

      // Render search query in grid mode
      view.render({
        notesById,
        orderedIds,
        activeId: null,
        query: "kanji",
        viewMode: "grid",
      });

      const sectionIds = [...container.querySelectorAll(".note-board-section")].map((s) => s.dataset.sectionId);
      const titleSection = container.querySelector('.note-board-section[data-section-id="title"]');
      const tagSection = container.querySelector('.note-board-section[data-section-id="tags"]');
      const titleCards = [...(titleSection?.querySelectorAll(".note-item") || [])].map((c) => c.dataset.id);
      const tagCards = [...(tagSection?.querySelectorAll(".note-item") || [])].map((c) => c.dataset.id);

      // Scroll to middle of content matches
      scrollOwner.scrollTop = 15000;
      scrollOwner.dispatchEvent(new globalThis.Event("scroll"));
      const midSectionIds = [...container.querySelectorAll(".note-board-section")].map((s) => s.dataset.sectionId);
      const midContentCards = [...container.querySelectorAll('.note-board-section[data-section-id="notes"] .note-item')].map((c) => c.dataset.id);

      // Scroll to bottom
      scrollOwner.scrollTop = scrollOwner.scrollHeight;
      scrollOwner.dispatchEvent(new globalThis.Event("scroll"));
      const bottomCards = [...container.querySelectorAll(".note-item")].map((c) => c.dataset.id);

      scrollOwner.remove();

      return {
        initialSectionIds: sectionIds,
        titleCards,
        tagCards,
        midSectionIds,
        midContentCardsCount: midContentCards.length,
        bottomHasLastNote: bottomCards.includes("note-599"),
      };
    });

    expect(result.initialSectionIds.includes("title")).toBe(true);
    expect(result.initialSectionIds.includes("tags")).toBe(true);
    expect(result.titleCards).toEqual(["note-0", "note-1", "note-2", "note-3", "note-4", "note-5", "note-6", "note-7", "note-8", "note-9"]);
    expect(result.tagCards.length).toBeGreaterThan(0);
    expect(result.midSectionIds.includes("notes")).toBe(true);
    expect(result.midContentCardsCount).toBeGreaterThan(0);
    expect(result.bottomHasLastNote).toBe(true);
  });
});
