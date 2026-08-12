# Issue #90 Board Renderer Implementation Plan

> **For implementers:** Use the repository's plan-execution workflow and complete each task with RED/GREEN evidence before moving on.

**Goal:** Make the existing list-view adapter render ordered `PINNED` and `NOTES` board sections while preserving bounded rendering for collections with at least 500 notes.

**Architecture:** `ui/notePresentation.js` remains the pure grouping owner. `ui/list.js` consumes `createNoteBoardSections()` and owns safe DOM construction, node reuse, selection events, and the large-collection window. `styles.css` owns the board grid and switches the virtualized path to one column so its fixed-row geometry remains deterministic.

**Tech Stack:** Vanilla JavaScript ES modules, semantic HTML created with DOM APIs, CSS custom properties, Playwright Chromium, Node.js 22.

## Global constraints

- Continue from PR #92 head `914b1a07fa20c4e0cabd044c6b533e277b4ff41d` on the existing `UX/90` remote branch.
- Preserve `UI → Actions → State → Core → Persistence`; the renderer receives prepared state and emits only selection intent.
- Keep search/workspace code as the ordering and query owner.
- Render note content only through text nodes and the existing bounded presentation projection.
- Lists with fewer than 500 valid notes may render the complete board; lists with at least 500 valid notes must keep rendered cards bounded.
- Do not change the shell layout, editor mounting, overlay lifecycle, Japanese filters, Review, persistence, schema, commands, or dependencies in this slice.
- Do not push until the complete focused and repository verification gate is green.

## File map

- Modify `tests/e2e/editor-list-contract.spec.mjs`: test the public list-view adapter in Chromium.
- Modify `ui/list.js`: render semantic board sections and retain the 500-note virtualization boundary.
- Modify `styles.css`: style section headings, responsive card grids, and the deterministic virtualized one-column mode.
- Retain `../specs/2026-08-12-issue-90-board-projection-design.md`: presentation ownership authority.

---

### Task 1: Specify semantic board rendering and the resource boundary

**Files:**
- Modify: `tests/e2e/editor-list-contract.spec.mjs`

**Public seam:**
- Consume: `createListView({ container, onSelect, formatDate })`.
- Observe: section headings, ordered card IDs, active state, click intent, and rendered-card count.

- [x] **Step 1: Add a failing semantic-board test**

Append a browser test that creates a scratch container, imports `/ui/list.js`, renders mixed pinned/unpinned input, and asserts this exact snapshot:

```js
test("list view renders upstream results as semantic pinned and notes board sections", async ({ page }) => {
  await page.goto("/");

  const snapshot = await page.evaluate(async () => {
    const { createListView } = await import("/ui/list.js");
    const container = document.createElement("div");
    document.body.append(container);
    const selectedIds = [];
    const notes = [
      { id: "note-2", title: "Second note", content: "Second", updatedAt: "2026-08-12T02:00:00.000Z", pinned: false },
      { id: "pinned-1", title: "Pinned note", content: "Pinned", updatedAt: "2026-08-12T01:00:00.000Z", pinned: true },
      { id: "note-1", title: "First note", content: "First", updatedAt: "2026-08-12T00:00:00.000Z", pinned: false },
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
```

- [x] **Step 2: Add a failing 499/500 boundary test**

Append a second browser test that renders 499 valid notes, records 499 rendered cards and `data-virtualized="false"`, then renders 500 notes and records fewer than 500 cards with `data-virtualized="true"`:

```js
test("list view virtualizes at the documented 500-note boundary", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const { createListView } = await import("/ui/list.js");
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientHeight: { configurable: true, value: 720 },
      clientWidth: { configurable: true, value: 1000 },
    });
    document.body.append(container);
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
```

- [x] **Step 3: Run RED**

Run:

```sh
npx --no-install playwright test tests/e2e/editor-list-contract.spec.mjs --project=chromium
```

Expected: existing tests pass; new tests fail because the current renderer has no board sections and virtualizes below 500 notes.

---

### Task 2: Implement the minimum board renderer

**Files:**
- Modify: `ui/list.js`
- Modify: `styles.css`

**Interfaces:**
- Import: `createNoteBoardSections` beside `createNoteCardPresentation`.
- Preserve: `createListView({ container, onSelect, formatDate }).render(payload)`.
- Add no application state or persistence dependency.

- [x] **Step 1: Replace the flat DOM composition with section composition**

Implement these constants and helpers in `ui/list.js`:

```js
const VIRTUALIZATION_THRESHOLD = 500;
const VIRTUAL_ROW_HEIGHT = 168;
const VIRTUAL_OVERSCAN = 8;

function createSection(section, nodes, viewId) {
  const root = document.createElement("section");
  root.className = "note-board-section";
  root.dataset.sectionId = section.id;
  const heading = document.createElement("h3");
  heading.id = `note-board-${viewId}-${section.id}-heading`;
  heading.className = "note-board-heading";
  heading.textContent = section.label;
  root.setAttribute("aria-labelledby", heading.id);
  const grid = document.createElement("div");
  grid.className = "note-board-grid";
  grid.append(...nodes);
  root.append(heading, grid);
  return root;
}
```

Use `createNoteBoardSections({ notesById, orderedIds })`, drop empty sections, and append section roots in the returned order. Reuse `nodeCache`, patch active state through `renderButton`, and remove cache entries absent from the current board IDs.

- [x] **Step 2: Keep rendering bounded at 500 notes**

For fewer than 500 valid board IDs, render every section/card and set `container.dataset.virtualized = "false"`.

For 500 or more valid board IDs:

- flatten the projected `pinned` then `notes` IDs;
- compute the current fixed-row window with `VIRTUAL_ROW_HEIGHT` and `VIRTUAL_OVERSCAN`;
- project only the visible IDs back through `createNoteBoardSections()`;
- render top and bottom `.list-spacer` elements around visible section roots;
- set `container.dataset.virtualized = "true"`.

Use the nearest `.notes-panel` as the scroll owner in the application and fall back to
the supplied container for isolated consumers. The scroll listener rerenders only while
the current payload is virtualized.

- [x] **Step 3: Add board CSS**

Update `styles.css` so:

```css
.note-list {
  display: block;
  padding: var(--mn-space-6);
  overflow: visible;
}

.note-board-section + .note-board-section {
  margin-top: var(--mn-space-8);
}

.note-board-heading {
  margin: 0 0 var(--mn-space-4);
  color: var(--mn-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.note-board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--mn-space-4);
}

.note-list[data-virtualized="true"] .note-board-grid {
  grid-template-columns: minmax(0, 1fr);
}

.note-item-container {
  display: block;
  min-width: 0;
}

.note-item {
  min-height: 152px;
  align-content: start;
  border-radius: var(--mn-radius-xl);
  padding: var(--mn-space-3);
}
```

Retain the existing safe text presentation, active-state non-color cue, hover state, metadata, preview, tags, and spacer rules.

- [x] **Step 4: Run focused GREEN**

Run:

```sh
npx --no-install playwright test tests/e2e/editor-list-contract.spec.mjs --project=chromium
node --check ui/list.js
npx --no-install eslint ui/list.js tests/e2e/editor-list-contract.spec.mjs
git diff --check
```

Expected: all focused browser tests pass and static checks exit zero.

- [x] **Step 5: Run affected regression packages**

Run:

```sh
npx --no-install playwright test tests/e2e/editor-shell.spec.mjs tests/e2e/notes-regression.spec.mjs tests/e2e/japanese-progressive-disclosure.spec.mjs --project=chromium
npm run test:content
npm run lint
npm run test:unit
```

Expected: every command exits zero. This slice remains intentionally incomplete until later shell/overlay work lands on the same PR.

- [x] **Step 6: Review and commit the bounded slice**

Confirm only the plan, renderer test, renderer, and CSS changed, then commit with:

```sh
git add -- ':(top)docs/**/2026-08-12-issue-90-board-renderer.md' tests/e2e/editor-list-contract.spec.mjs ui/list.js styles.css
git diff --cached --check
git commit -m "feat(ux): render note board sections"
```

Do not push yet. The next slice is the centered create/edit overlay and board-context lifecycle.
