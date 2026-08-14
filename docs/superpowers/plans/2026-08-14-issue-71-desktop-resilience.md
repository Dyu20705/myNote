# Issue 71 Desktop Resilience Implementation Plan

## Goal

Prove and harden the accepted desktop board/overlay experience across supported viewport resizing, narrow-layout stress, and native 200% browser zoom without adding viewport-owned application state.

## Architecture

Runtime changes are CSS/semantic-presentation only. Existing board, overlay, command, Japanese, and drawing owners remain unchanged. Resize/zoom is a projection concern and must not trigger canonical mutation.

Create one cross-surface Playwright suite. Patch only selectors that genuine RED evidence proves are unbounded.

## Global constraints

- start from current `dev`;
- authoritative design: issue #71 desktop-resilience design;
- preserve `UI → Actions → State → Core → Persistence`;
- no JavaScript resize listener, `ResizeObserver`, viewport store, layout controller, schema/dependency/search/scheduler/parser/persistence change, or mobile navigation;
- `720×450` is supplemental stress only;
- native 200% browser zoom requires actual Windows Chrome/Edge evidence or remains `UNKNOWN — REQUIRES VALIDATION`;
- one bounded branch and one PR to `dev`;
- do not merge or begin #72.

## Files

Create/extend:

- `tests/e2e/desktop-resilience.spec.mjs`

Modify only for genuine RED:

- `styles.css`
- `editor.css`
- `japanese.css`
- `index.html` only for strictly necessary semantic containment/accessibility

Do not modify application/state/core/persistence/scheduler/search/drawing modules.

## Task 1 — reference viewport containment

Add helpers equivalent to:

```js
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
      width: innerWidth,
      height: innerHeight,
      safeInset,
    };
  }, inset);
  expect(geometry.left).toBeGreaterThanOrEqual(geometry.safeInset - 1);
  expect(geometry.top).toBeGreaterThanOrEqual(geometry.safeInset - 1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.width - geometry.safeInset + 1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.height - geometry.safeInset + 1);
}
```

For `1024×768`, `1280×720`, `1440×900`:

1. open `/`;
2. assert no root horizontal overflow;
3. open first note;
4. assert overlay/title/body reachable;
5. open note actions and assert contained;
6. close actions, open Details and assert contained;
7. assert no root overflow.

Run the focused file and record RED/GREEN truthfully. GREEN is valid regression evidence.

## Task 2 — live resize state and board context

At `1440×900`:

1. set a non-empty search query;
2. create deterministic non-zero board scroll using the existing `#noteNavigationRegion`/list fixture pattern from overlay tests;
3. snapshot board scroll;
4. open the selected note;
5. fill a distinctive title/body draft;
6. focus `#contentInput`;
7. resize to `1024×768`, then `1280×720`;
8. after each resize assert:
   - same overlay mode;
   - same active note ID;
   - exact draft values;
   - same search query;
   - `#contentInput` still logically focused;
   - board scroll equals the snapshot unless the browser's available scroll range genuinely clamps lower;
   - overlay contained;
   - no root horizontal overflow;
9. close overlay and assert deterministic focus return.

Do not add resize-specific JavaScript.

## Task 3 — long content

Use synthetic data only:

- long English prose;
- long Japanese text;
- a 256+ character unbroken ASCII token;
- mixed code punctuation.

Exercise at `1024×768` and `720×450` supplemental stress. Assert overlay/card containment and no root horizontal overflow.

## Task 4 — drawing invariance

Reuse the accepted V2 IndexedDB fixture shape from existing drawing tests.

1. seed one drawing for the active note;
2. synchronize through the existing drawing application/view owner;
3. snapshot canonical entries sorted deterministically;
4. resize through all reference viewports plus 720×450 stress;
5. assert drawing region remains above title/body, overlay stays contained, title/body remain reachable, no root overflow;
6. snapshot canonical entries after resize;
7. deep-compare before/after.

Do not persist because of layout and do not add a drawing owner.

## Task 5 — open transient surfaces through resize

This is required cross-resize evidence, not just static geometry.

### Note action or Details surface

1. start at `1440×900`;
2. open note overlay;
3. open one transient surface;
4. focus a real keyboard-reachable control inside it;
5. resize to `1024×768` and `1280×720` while the surface remains open;
6. assert surface still visible, inside viewport, and focused control remains logically focused when still valid;
7. assert no root overflow;
8. close surface using existing behavior and verify focus return if the owner defines it.

### Command palette

1. close note overlay;
2. open command palette at `1440×900`;
3. focus/use existing command input;
4. resize to `1024×768`, `1280×720`, and optionally 720×450 supplemental stress;
5. assert palette/panel remain visible and contained, input remains focused, no root overflow.

If either scenario produces genuine RED and CSS/semantic containment cannot satisfy it, stop and report exact evidence instead of adding viewport state.

## Task 6 — Japanese state through resize

Use existing Japanese helpers/controls.

Verify:

- text search remains intact;
- one common Filter A preset and removable chip remain active;
- Japanese create menu remains contained;
- review dialog remains contained;
- revealed review content/rating controls remain available;
- resizing does not reset workspace/filter/review state;
- no root overflow.

Do not change learning/scheduler semantics.

## Task 7 — CSS only for genuine RED

Before editing CSS, inventory:

```sh
rg -n "100vw|100vh|100dvh|position:\s*(fixed|sticky|absolute)|min-width|max-width|min-height|max-height|overflow|white-space:\s*nowrap|@media" styles.css editor.css japanese.css
```

Permitted fixes include:

- `min-width: 0`;
- `minmax(0, 1fr)`;
- bounded inline/block sizes;
- `overflow: auto` on existing transient/task surfaces;
- `overflow-wrap: anywhere`;
- flex wrapping;
- viewport-safe padding/insets.

No runtime JS unless the design is amended after a stop report.

After each genuine fix rerun only the smallest failing test, then the focused #71 file.

## Task 8 — focused regression

Run:

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
npx playwright test tests/e2e/visual-system.spec.mjs
npx playwright test tests/e2e/japanese-progressive-disclosure.spec.mjs
npx playwright test tests/e2e/japanese-filters.spec.mjs
```

Record exact pass/fail counts.

## Task 9 — native zoom evidence

Do not use viewport emulation as native zoom proof.

For Windows Chrome and Edge at native browser zoom 200%, record:

- Windows version;
- browser/version;
- zoom value;
- window/viewport dimensions;
- board → overlay → edit → resize/close flow;
- note actions/Details/palette;
- Japanese filter/review;
- drawing present/absent;
- horizontal overflow/focus result.

If unavailable, record `UNKNOWN — REQUIRES VALIDATION`.

## Task 10 — complete verification

Run once after focused tests are stable:

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

Do not use remote CI as an iterative debugger.

## CI discipline

- run local/focused verification before push where environment permits;
- batch all review fixes into one push where practical;
- prefer one remote CI run for this review iteration;
- do not create empty/trial commits;
- do not repeatedly rerun an unchanged deterministic failure;
- if current `dev` changed to repair a baseline blocker, refresh the issue branch once after local fixes are ready, then push once.

## PR evidence

Record:

- issue/design/plan references;
- base/head SHA;
- changed files;
- genuine RED or already-GREEN regression evidence;
- focused results;
- complete-gate results;
- acceptance mapping;
- native zoom evidence/unknowns;
- security/privacy;
- performance/resources;
- accessibility;
- compatibility;
- migration impact;
- rollback.

After updating the PR, stop for review.
