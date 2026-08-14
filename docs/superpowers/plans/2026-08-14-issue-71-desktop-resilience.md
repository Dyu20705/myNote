# Issue 71 Desktop Resilience Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. For this repository, `docs/engineering/AI_DELIVERY_MODEL.md` overrides any generic agent workflow that would let the worker redesign scope, dispatch unrelated work, merge, or continue to another issue.

**Goal:** Prove and harden the accepted desktop board/overlay experience across supported viewport resizing, narrow-layout stress, and native 200% browser zoom without adding viewport-owned application state.

**Architecture:** Runtime changes are CSS/semantic-presentation only. Existing board, overlay, command, Japanese, and `KanjiInkEntry` owners remain unchanged; resize/zoom is a projection concern and must not trigger canonical mutation. Add one cross-surface Playwright suite, patch only selectors that genuine RED evidence shows are unbounded, then run existing regressions and the full repository gate.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Playwright 1.62, Node.js `>=22.13 <23`, npm 11.x, IndexedDB test fixtures already used by repository E2E tests.

## Global Constraints

- Base all implementation work on the current `dev` head.
- Authoritative design: `docs/design/issues/071-desktop-resilience.md`.
- Preserve `UI → Actions → State → Core → Persistence`.
- No JavaScript resize listener, `ResizeObserver`, viewport store, layout controller, schema change, dependency change, search/scheduler/parser/persistence change, or mobile navigation.
- `720×450` is supplemental narrow-layout stress only; never report it as native 200% zoom proof.
- Native 200% browser zoom requires recorded manual Windows Chrome/Edge evidence or remains `UNKNOWN — REQUIRES VALIDATION`.
- One bounded branch and one PR targeting `dev`; do not merge; stop after PR creation.

---

## File Structure

**Create**

- `tests/e2e/desktop-resilience.spec.mjs` — the single cross-surface viewport/resize/overflow evidence owner for #71.

**Modify only if RED evidence requires it**

- `styles.css` — shell/topbar/board/command-palette containment.
- `editor.css` — note overlay, inspector, action popover, undo notice, drawing-region/editor containment.
- `japanese.css` — Japanese create/filter/review containment.
- `index.html` — only if an existing surface lacks one semantic wrapper/attribute required for CSS containment/accessibility; do not change behavior.

**Do not modify**

- `app.js`, `japaneseApp.js`, core state/controllers/actions/storage/search/parser/scheduler, Kanji persistence/controller/application modules, package dependencies.

---

### Task 1: Create the viewport containment test harness

**Files:**
- Create: `tests/e2e/desktop-resilience.spec.mjs`

**Interfaces:**
- Consumes: existing DOM IDs/classes from #90 (`#noteEditorOverlay`, `#noteActionsButton`, `#noteInspector`, `#noteList`, `#titleInput`, `#contentInput`, `#searchInput`).
- Produces: shared test helpers `expectNoDocumentHorizontalOverflow(page)` and `expectInsideViewport(locator, inset)` used only by this E2E file.

- [ ] **Step 1: Create the helper functions and reference viewport matrix test**

Start the file with:

```js
import { expect, test } from "@playwright/test";

const REFERENCE_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];

async function expectNoDocumentHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
}

async function expectInsideViewport(locator, inset = 0) {
  const geometry = await locator.evaluate((element, safeInset) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      safeInset,
    };
  }, inset);

  expect(geometry.left).toBeGreaterThanOrEqual(geometry.safeInset - 1);
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.safeInset - 1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width - geometry.safeInset + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height - geometry.safeInset + 1);
}

for (const viewport of REFERENCE_VIEWPORTS) {
  test(`board overlay and note transient surfaces stay contained at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expectNoDocumentHorizontalOverflow(page);

    await page.locator("#noteList .note-item").first().click();
    const overlay = page.locator("#noteEditorOverlay");
    await expect(overlay).toBeVisible();
    await expectInsideViewport(overlay);
    await expect(page.locator("#titleInput")).toBeVisible();
    await expect(page.locator("#contentInput")).toBeVisible();

    await page.locator("#noteActionsButton").click();
    const actions = page.locator("#noteActionsPopover");
    await expect(actions).toBeVisible();
    await expectInsideViewport(actions);
    await page.keyboard.press("Escape");

    await page.locator("#noteDetailsButton").click();
    const inspector = page.locator("#noteInspector");
    await expect(inspector).toBeVisible();
    await expectInsideViewport(inspector);
    await page.keyboard.press("Escape");

    await expectNoDocumentHorizontalOverflow(page);
  });
}
```

If the current Details opener has a different stable accepted selector/name, use the existing #90 selector from current `dev`; do not add a second opener.

- [ ] **Step 2: Run only this file and record RED/GREEN truthfully**

Run:

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
```

Expected:

- RED if any current surface escapes the viewport or causes root horizontal overflow.
- GREEN is also a valid baseline result; do not manufacture a failing CSS change. If GREEN, this task establishes regression evidence and later runtime CSS changes require another genuine failing assertion.

- [ ] **Step 3: Commit the test harness**

```sh
git add tests/e2e/desktop-resilience.spec.mjs
git commit -m "test(ux): cover desktop viewport containment"
```

---

### Task 2: Add live resize, draft/query/focus, and long-content evidence

**Files:**
- Modify: `tests/e2e/desktop-resilience.spec.mjs`

**Interfaces:**
- Consumes: existing overlay/autosave/search/focus behavior.
- Produces: deterministic evidence that resizing does not become an application-state transition.

- [ ] **Step 1: Add live-resize preservation test**

Append a test equivalent to:

```js
test("live desktop resize preserves query draft overlay and logical focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const search = page.locator("#searchInput");
  await search.fill("Untitled");
  const card = page.locator("#noteList .note-item").first();
  const activeId = await card.getAttribute("data-id");
  await card.click();

  const overlay = page.locator("#noteEditorOverlay");
  const title = page.locator("#titleInput");
  const content = page.locator("#contentInput");
  await title.fill("Resize preservation title");
  await content.fill("Resize preservation body 日本語 code::token");
  await content.focus();

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute("data-mode", "edit");
    await expect(title).toHaveValue("Resize preservation title");
    await expect(content).toHaveValue("Resize preservation body 日本語 code::token");
    await expect(search).toHaveValue("Untitled");
    await expect(content).toBeFocused();
    await expect(page.locator(`.note-item[data-id="${activeId}"]`)).toHaveAttribute("aria-current", "true");
    await expectInsideViewport(overlay);
    await expectNoDocumentHorizontalOverflow(page);
  }
});
```

- [ ] **Step 2: Add long-content stress test**

Use synthetic content only:

```js
test("long English Japanese and code-like content cannot widen the document", async ({ page }) => {
  const unbroken = "A".repeat(256);
  const japanese = "日本語の長い文章を表示して折り返しを検証します。".repeat(16);
  const mixed = `${unbroken}\n${japanese}\nconst::very::long::code::path => [${unbroken}]`;

  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 720, height: 450 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#noteList .note-item").first().click();
    await page.locator("#titleInput").fill(unbroken);
    await page.locator("#contentInput").fill(mixed);
    await expectInsideViewport(page.locator("#noteEditorOverlay"));
    await expectNoDocumentHorizontalOverflow(page);
  }
});
```

The `720×450` case must be named/documented as narrow-layout stress, not zoom.

- [ ] **Step 3: Run the focused file**

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
```

Record exact failing assertion(s) before any CSS patch.

- [ ] **Step 4: Commit the additional RED/regression evidence**

```sh
git add tests/e2e/desktop-resilience.spec.mjs
git commit -m "test(ux): cover resize state and long content"
```

---

### Task 3: Add drawing invariance and Japanese/transient-surface stress

**Files:**
- Modify: `tests/e2e/desktop-resilience.spec.mjs`

**Interfaces:**
- Consumes: IndexedDB v3 `kanjiInkEntries` fixture shape already used by `tests/e2e/note-drawing-projection.spec.mjs`; existing Japanese workspace/filter/create/review controls.
- Produces: evidence that layout changes do not mutate canonical drawing data or reset Japanese presentation state.

- [ ] **Step 1: Add a local drawing fixture helper using the existing V2 shape**

Use the same persisted structure already accepted by current tests:

```js
async function seedDrawing(page, noteId) {
  await page.evaluate(async (id) => {
    const request = indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const timestamp = "2026-08-14T00:00:00.000Z";
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").put({
      id: "issue-71-resize-drawing",
      noteId: id,
      strokes: [{
        tool: "pen",
        width: 0.008,
        points: [{ x: 0.2, y: 0.2, t: 0 }, { x: 0.8, y: 0.8, t: 1 }],
      }],
      paperStyle: "grid",
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 2,
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, noteId);
}
```

Add a read helper that returns a defensive JSON-compatible snapshot of all entries for the note, sorted by `id`, so before/after deep equality is deterministic.

- [ ] **Step 2: Add drawing resize invariance test**

The test must:

1. open the first note and get the active note ID;
2. seed the drawing;
3. call the existing `kanjiInkApp.synchronize()` exactly as the existing projection test does;
4. snapshot persisted entries;
5. resize through all three reference viewports plus `720×450` stress;
6. after each resize assert `#noteDrawingRegion` visible, title/body reachable, overlay contained, and no root horizontal overflow;
7. snapshot persisted entries after resizing;
8. `expect(after).toEqual(before)`.

Also assert the drawing region precedes the title in DOM order using the existing `compareDocumentPosition` pattern from `note-drawing-projection.spec.mjs`.

- [ ] **Step 3: Add supplemental transient-surface test at 720×450**

After the note overlay is closed:

```js
await page.setViewportSize({ width: 720, height: 450 });
await page.keyboard.press("Control+k");
await expect(page.locator("#commandPalette")).toBeVisible();
await expectInsideViewport(page.locator("#commandPanel"));
await expectNoDocumentHorizontalOverflow(page);
```

Use the current stable command panel selector from `dev` if it differs; do not add a new panel solely for testing.

- [ ] **Step 4: Add Japanese containment/state test using existing controls**

Use existing Japanese workspace/filter/create selectors. The test must verify:

- text search is not cleared by Filter A interactions;
- preset/chip state survives resizing;
- Japanese create menu remains within the viewport;
- root horizontal overflow remains absent.

For review dialog coverage, reuse an existing repository review fixture/helper if one exists. If current helper APIs cannot create a review session without changing learning semantics, do not invent new application state: keep review-dialog geometry covered by its existing focused E2E spec and report that cross-resize review evidence is pending architecture review.

- [ ] **Step 5: Run focused tests**

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
```

- [ ] **Step 6: Commit**

```sh
git add tests/e2e/desktop-resilience.spec.mjs
git commit -m "test(ux): cover drawings and Japanese resize resilience"
```

---

### Task 4: Apply CSS containment only for genuine RED failures

**Files:**
- Modify only as required: `styles.css`, `editor.css`, `japanese.css`
- Modify only if strictly necessary: `index.html`

**Interfaces:**
- Consumes: failing geometry/overflow assertions from Tasks 1–3.
- Produces: CSS-only containment; no application/state interface.

Before editing, run:

```sh
rg -n "100vw|100vh|100dvh|position:\s*(fixed|sticky|absolute)|min-width|max-width|min-height|max-height|overflow|white-space:\s*nowrap|@media" styles.css editor.css japanese.css
```

- [ ] **Step 1: If command palette vertical containment is RED, patch `styles.css`**

Use this shape, adjusting only existing selector names if current `dev` differs:

```css
.command-palette {
  padding: max(var(--mn-space-3), 4dvh) var(--mn-space-3) var(--mn-space-3);
  overflow: auto;
}

.command-panel {
  max-height: calc(100dvh - (2 * var(--mn-space-3)));
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.command-list {
  min-height: 0;
  max-height: min(320px, calc(100dvh - 96px));
  overflow: auto;
}
```

Do not change command registry/scope/keyboard behavior.

- [ ] **Step 2: If shell/header/card overflow is RED, patch only the failing containment selectors in `styles.css`**

Permitted containment primitives:

```css
.identity-navigation,
.header-actions,
.panel-header,
.panel-header-actions {
  min-width: 0;
}

:where(.primary-button, .shell-button, .secondary-button, .quiet-button, .destructive-button) {
  max-width: 100%;
}

@media (max-width: 720px) {
  .identity-navigation {
    flex-wrap: wrap;
  }

  .search-box {
    min-width: min(180px, 100%);
  }
}
```

If a label itself causes overflow, prefer targeted `overflow-wrap: anywhere` or existing ellipsis semantics over global typography changes.

- [ ] **Step 3: If overlay/transient-surface containment is RED, patch `editor.css`**

Permitted hardening shape:

```css
.note-editor-overlay {
  max-inline-size: calc(100vw - 24px);
  max-block-size: calc(100dvh - 24px);
}

.editor-panel,
.editor-context-header,
.editor-context-copy,
.editor-context-actions {
  min-width: 0;
}

.note-inspector,
.note-actions-popover {
  max-width: calc(100% - 24px);
}

.note-action-item strong,
.note-action-item span {
  overflow-wrap: anywhere;
}

.undo-notice {
  max-width: calc(100vw - 24px);
}
```

If constrained block height proves the editor panel itself needs scrolling, add `overflow-y: auto` only to the existing `.editor-panel` presentation owner; do not create a second scroll/state controller.

- [ ] **Step 4: If Japanese transient surfaces are RED, patch `japanese.css`**

Use dynamic viewport block bounds and existing internal scrolling:

```css
.japanese-create-menu {
  max-height: calc(100dvh - 24px);
  overflow: auto;
}

.review-dialog {
  max-height: calc(100dvh - 32px);
}

.review-content {
  max-height: min(46dvh, calc(100dvh - 180px));
}

.workspace-switcher,
.japanese-filter-toolbar,
.japanese-filter-presets,
.japanese-filter-chips {
  min-width: 0;
}
```

Keep existing wrapping/stacking behavior. Do not change scheduler/review semantics.

- [ ] **Step 5: Re-run the exact failing test after each CSS patch**

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs --grep "<exact failing test name>"
```

Expected: GREEN for that failure without new failures in the same file.

- [ ] **Step 6: Run the complete #71 E2E file**

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit only the CSS/semantic changes actually justified by RED evidence**

```sh
git add styles.css editor.css japanese.css index.html
git commit -m "fix(ux): bound desktop resize surfaces"
```

Do not stage a file that did not change.

If all new tests were GREEN before runtime edits, skip this commit and state in the PR that current runtime already satisfied automated #71 containment; do not manufacture a runtime diff.

---

### Task 5: Focused regression, full verification, manual native zoom, and PR

**Files:**
- Modify: no runtime files unless a focused regression exposes a bounded #71 CSS defect.
- Optional evidence documentation: only the path explicitly selected by current repository convention/design; do not invent a release gate outside #71.

**Interfaces:**
- Produces: reviewable PR evidence only.

- [ ] **Step 1: Run focused browser regressions**

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
npx playwright test tests/e2e/visual-system.spec.mjs
```

Then run the existing Japanese progressive-disclosure and review E2E specs affected by the touched selectors.

Expected: PASS.

- [ ] **Step 2: Run the complete repository gate**

```sh
npm ci
npx --no-install playwright install --with-deps chromium
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

Expected: every command PASS. Record exact versions/environment.

- [ ] **Step 3: Perform native Windows Chrome 200% zoom evidence**

Record:

```text
OS: <exact Windows version>
Browser: Chrome <exact version>
Zoom: browser-native 200%
Window/viewport: <exact observed dimensions>
Workflows:
- board containment
- overlay + distinctive draft
- live resize
- note actions + Details
- command palette
- Japanese filters/create/review where fixture exists
- drawing region/title/body reachability
Result: PASS | exact failure | UNKNOWN — REQUIRES VALIDATION
```

Do not substitute Playwright `720×450` for this result.

- [ ] **Step 4: Perform native Windows Edge 200% zoom evidence**

Record the same fields for Edge.

If unavailable, record `UNKNOWN — REQUIRES VALIDATION`; do not claim PASS.

- [ ] **Step 5: Self-review the complete diff**

Run:

```sh
git diff dev...HEAD --stat
git diff dev...HEAD -- AGENTS.md docs/ARCHITECTURE.md docs/INVARIANTS.md package.json package-lock.json app.js japaneseApp.js core
```

Expected for implementation scope: no unauthorized runtime architecture/dependency/core changes. The first diff may include only #71 test/CSS/evidence files plus any explicitly allowed semantic markup.

- [ ] **Step 6: Push the branch and open one PR targeting `dev`**

PR body must contain:

```text
Issue: #71
Design: docs/design/issues/071-desktop-resilience.md
Plan: docs/superpowers/plans/2026-08-14-issue-71-desktop-resilience.md
Base SHA: <sha>
Head SHA: <sha>

RED evidence:
<exact failing assertions, or state that the accepted new regression test was already GREEN and no runtime patch was manufactured>

GREEN evidence:
<focused commands/results>

Full verification:
<all required commands/results>

Native zoom:
Chrome: <PASS/failure/UNKNOWN + exact environment>
Edge: <PASS/failure/UNKNOWN + exact environment>

Acceptance mapping:
<criterion-by-criterion evidence>

Security/privacy: no new data/network path; synthetic fixtures only
Performance/resources: CSS-only, no resize listener/observer/store/persistence trigger
Accessibility: focus/keyboard/zoom evidence
Compatibility: explicit unsupported/unknown environments
Migration: none
Rollback: one PR revert; no data downgrade
```

- [ ] **Step 7: STOP**

Do not merge the PR. Do not change #72. Do not begin another issue. Wait for Duy + ChatGPT review.