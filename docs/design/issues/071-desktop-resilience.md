# 71 — Desktop Resize, Zoom, and Overflow Resilience Design

## Status

- **Issue:** #71
- **Design status:** accepted by owner delivery-model approval; implementation not started
- **Implementation target:** `dev`
- **Design source commit:** `bfdea529b0513cb409ef493ded06309826b9c927`
- **Runtime baseline commit:** `78c09bc9a54ecceb6fb59408c38c5e8d4707c44c` (PR #92 merge; runtime files inspected on `dev` remain unchanged by governance-only commits before this design)
- **Evidence date:** 2026-08-14
- **Parent:** #15
- **Execution roadmap:** #20
- **Depends on:** #65, #66, #67, #74, #68, #69, #70, #90 completed/accepted
- **Blocks:** #72, then #73
- **Review authority:** Duy + ChatGPT

## Goal

Make the accepted board-first desktop application resilient to supported window resizing and native 200% browser zoom without adding mobile navigation, viewport-owned application state, or a second drawing/persistence owner.

## User outcome

A desktop user can keep working while resizing the window or using 200% browser zoom: the board remains scannable; the centered note overlay remains usable; drafts, query/filter/review context, and logical focus remain intact; saved drawings stay directly above title/body; transient surfaces stay reachable; and the document never develops horizontal page overflow.

## Current verified baseline

The design is based on the current `dev` tree and the completed #90 runtime.

### Architecture

Current architecture already requires:

```text
UI → Actions → State → Core → Persistence
```

`app.js` is the single composition root. Note presentation and `NoteEditorOverlay` are UI owners only. `kanjiInkEntries` remains a separate canonical store and the note drawing region is a projection. Resize/presentation work must not change any of those owners.

### Board and document containment

`styles.css` currently provides:

- `html, body { overflow: hidden; }`;
- `.app-shell { width: min(var(--mn-shell-max), calc(100vw - 24px)); height: 100dvh; overflow: hidden; }`;
- `.workspace { min-height: 0; overflow: hidden; }`;
- `.notes-panel { min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; }`;
- board cards and title/preview/tag content use `min-width: 0` and `overflow-wrap: anywhere`;
- board grid uses `repeat(auto-fit, minmax(min(100%, 260px), 1fr))`;
- the command panel is width-bounded but its vertical bound is currently primarily the fixed `command-list` maximum;
- topbar/header actions already wrap below 900 CSS px;
- a narrow layout breakpoint exists below 720 CSS px.

These are strong containment primitives and should be hardened rather than replaced.

### Note overlay and drawing projection

`editor.css` currently provides:

```css
.note-editor-overlay {
  width: min(780px, calc(100vw - 32px));
  height: min(640px, calc(100dvh - 32px));
  overflow: hidden;
}

.note-drawing-region {
  max-height: min(220px, 25dvh);
  overflow: auto;
}
```

The inspector and note-action popover are absolute, bounded by the overlay, and become fixed/inset below 720 CSS px. The save-state label becomes wrappable and editor actions wrap below that breakpoint.

Existing #90 Playwright coverage proves the create/edit overlay is centered/bounded at 1280×720 and preserves query, board scroll, saved draft, and focus-return behavior at 1024×768.

### Drawing regression coverage

Existing drawing-projection tests already verify:

- saved drawing appears directly above title/body;
- zero drawing region collapses;
- multiple drawings remain bounded;
- title/body stay reachable at 1024×768, 1280×720, 1440×900, and a supplemental 720×450 CSS viewport;
- no horizontal document overflow after expanding multiple drawings;
- ordinary and Japanese notes share the projection;
- save/delete failures preserve canonical state.

#71 must extend resilience evidence and must not reimplement #69/#90 drawing behavior.

### Japanese surfaces

`japanese.css` currently provides:

- wrapping filter presets and panel-header actions;
- width-bounded Japanese create menu;
- responsive filter/dashboard/action grids;
- review dialog width `min(720px, calc(100vw - 24px))` with vertical scrolling;
- review content internal scrolling;
- a 620 CSS px breakpoint that stacks dense Japanese controls.

These existing narrow CSS rules are allowed to serve desktop zoom/resizing resilience. Their existence is not a mobile support claim.

## Design decisions

### Decision 1 — CSS-first and CSS-only runtime scope

#71 is a presentation resilience package.

The accepted runtime implementation is limited to CSS/semantic presentation changes plus Playwright tests/documentation. Do not add:

- `resize` event listeners;
- `ResizeObserver` application controllers;
- viewport width/height in application state;
- breakpoint-specific command/action state;
- a new layout coordinator;
- a viewport-specific drawing controller;
- persistence writes caused by resize/zoom.

If a RED test exposes state loss that genuinely cannot be fixed through current presentation/focus ownership, Codex must stop and report the exact failing contract. A JavaScript resize controller is not pre-authorized by this design.

### Decision 2 — preserve board-first + one centered overlay

Every supported desktop size and zoomed layout stays in the #90 interaction family:

```text
board
→ centered NoteEditorOverlay when creating/editing
→ close/save
→ same board context
```

No permanent editor pane, list/editor route split, back button, bottom navigation, drawer, or off-canvas mobile navigation may be introduced.

### Decision 3 — narrow CSS width is resilience evidence, not mobile support

At native browser zoom, the CSS viewport can become substantially narrower than the physical/window pixel dimensions. Existing `@media (max-width: 720px)` / `620px` rules may therefore participate in desktop 200% zoom behavior.

A `720×450` Playwright CSS viewport is permitted only as **supplemental narrow-layout stress evidence**. It must never be described as proof of native 200% browser zoom.

Native browser zoom acceptance requires recorded manual evidence.

### Decision 4 — internal scrolling before document overflow

The document/root must not horizontally scroll. When vertical space becomes constrained, bounded task surfaces scroll internally in this order:

1. note drawing region;
2. note editor body/presentation region as already owned by the overlay;
3. inspector/action popover;
4. command list/panel;
5. Japanese create/filter/review transient surfaces.

No content should escape the viewport merely to preserve an arbitrary fixed height.

### Decision 5 — do not mutate canonical state during presentation changes

Resize/zoom may change layout only.

It must not:

- persist the active note;
- create or update a `KanjiInkEntry`;
- reorder canonical drawings;
- mutate study review state;
- clear text search;
- clear Japanese filters;
- restart a review session;
- change active note merely because geometry changed.

Autosave that occurs because the user actually edited content remains governed by the existing autosave contract; the resize event itself must not become a persistence trigger.

## Supported matrix

### Automated desktop reference viewports

- `1024×768`
- `1280×720`
- `1440×900`

### Supplemental automated narrow-layout stress

- `720×450` CSS viewport

This is not native zoom evidence.

### Required native manual evidence

- Windows desktop Chrome at native browser zoom `200%`;
- Windows desktop Edge at native browser zoom `200%`.

Record exact browser versions, OS version, window dimensions, and observed workflow. If an environment is unavailable, record `UNKNOWN — REQUIRES VALIDATION`; do not claim it passed.

### Required input

- keyboard;
- desktop mouse.

### Explicitly unsupported in this work package

- mobile/tablet product layouts;
- touch-first interaction;
- virtual/on-screen keyboard behavior;
- portrait device acceptance;
- Android/iOS browser support;
- orientation transitions;
- PWA/native wrappers;
- stylus guarantees beyond existing #69 unknowns.

## Layout contract

### Root and shell

At every automated viewport and narrow-layout stress viewport:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

The application shell must remain fully within the CSS viewport. Vertical scrolling is owned by existing bounded panels/transient surfaces rather than the root document.

### Topbar and identity

- workspace identity, workspace switcher, search, create/review controls, and other accepted actions must shrink/wrap within the shell;
- no header child may impose a minimum inline size that causes root horizontal overflow;
- short identity text may remain single-line with truncation where needed;
- action labels may wrap only when their existing control semantics remain legible and focusable;
- keyboard focus indicators must remain visible after wrapping.

### Board

- board grid continues to use available columns automatically;
- no viewport-specific board data/state is introduced;
- long English/Japanese/unbroken code-like strings cannot expand a card beyond its column;
- focused cards remain inside the visible scrolling panel;
- board scroll position is unchanged merely by opening/closing/resizing the overlay except normal browser layout clamping when content dimensions genuinely shrink.

### Note editor overlay

- overlay remains centered when opened;
- overlay bounding rectangle must remain within the CSS viewport with the accepted safe inset;
- overlay content must use `min-width: 0` / bounded block sizing so long content cannot widen it;
- title, body, save state, pin/close/overflow actions, and drawing projections remain reachable;
- constrained height uses internal scroll instead of pushing actions/title/body outside an unreachable document area;
- closing still returns focus to the logical opener when it exists.

### Drawing projection

- zero drawings: region remains hidden and consumes no permanent space;
- one drawing: projection remains directly above title/body;
- multiple drawings: existing newest-first/bounded disclosure remains the owner;
- drawing region remains internally scrollable/bounded;
- Edit/Delete controls remain reachable by keyboard;
- resize/zoom does not change entry count, IDs, timestamps, strokes, paper style, or ordering in IndexedDB;
- no vector/base64 data enters note content.

### Note inspector and action popover

- opening either surface must keep its bounding rectangle within the visible CSS viewport;
- long labels/metadata wrap inside the surface;
- constrained height uses internal scrolling;
- moving to the existing fixed/inset narrow rule is allowed;
- closing returns focus through existing owners;
- hidden surfaces cannot retain focus.

### Command palette

- scrim/palette remains fixed to the viewport;
- command panel must be both inline-size and block-size bounded;
- command list becomes the scrolling region when vertical space is constrained;
- command input and close/dismiss behavior remain reachable;
- command scope/IME precedence remains #74-owned and unchanged.

### Japanese surfaces

The following must remain within the viewport and preserve canonical filter/review state:

- workspace switcher;
- Filter A presets/chips;
- `+ Filter` advanced panel;
- Japanese create menu;
- `Review N` entry;
- review dialog/rating controls;
- degraded/repair/status content already owned by current Japanese UI.

Rules:

- chips/presets may wrap;
- dense grids may stack at existing narrow breakpoints;
- Japanese create menu/review dialog must be block-size bounded and internally scrollable where necessary;
- review content must not force root overflow;
- resizing while review is open does not reset reveal/session/rating state.

## Focus and state preservation contract

### Resize while editing

Given an open edit overlay with:

- an active note;
- a non-empty search query;
- a modified title/body draft;
- `#contentInput` focused;

resizing among supported desktop viewports must preserve:

- same overlay mode;
- same active note ID;
- exact visible title/body draft;
- same search query;
- logical focus on `#contentInput` when it remains visible;
- no unexpected overlay close;
- no root horizontal overflow.

### Resize while a transient surface is open

If the currently opened surface still fits after CSS reflow, it remains open and its focused control remains logical. If the browser itself forces geometry clamping, the surface must still remain reachable and focus must not move into hidden background content.

No resize-specific JavaScript focus policy is added in #71.

### Japanese state

Resizing must not clear or reinitialize:

- workspace;
- text query;
- Filter A/advanced canonical filter state;
- active Japanese note;
- review session/reveal state.

## Long-content contract

Automated coverage must include all of these in a note or visible status/control surface:

- long English prose;
- long Japanese text without convenient spaces;
- one unbroken ASCII/code-like token of at least 256 characters;
- mixed Markdown/code punctuation.

Expected behavior:

- root horizontal overflow remains absent;
- title/body stay reachable;
- card text stays inside its card;
- transient surfaces wrap or internally scroll rather than widen the root.

Do not alter canonical parsing/search semantics to satisfy presentation.

## Expected files and interfaces

### Runtime files allowed to change

- `styles.css`
- `editor.css`
- `japanese.css`
- `index.html` only if a missing semantic wrapper/attribute is strictly necessary for CSS containment or accessibility and no behavior changes

### Tests allowed to change/create

- Create: `tests/e2e/desktop-resilience.spec.mjs`
- Extend existing focused E2E tests only when a regression belongs to their existing owner:
  - `tests/e2e/note-editor-overlay.spec.mjs`
  - `tests/e2e/note-drawing-projection.spec.mjs`
  - `tests/e2e/visual-system.spec.mjs`
  - Japanese progressive-disclosure/review E2E files already present in the repository

Prefer the new `desktop-resilience.spec.mjs` for cross-surface resize/overflow assertions so existing feature tests do not become a second #71 matrix.

### Documentation allowed to change

- this design/implementation plan as evidence corrections only;
- `docs/UX_ISSUE_EXECUTION.md` only to reconcile #90 completion and #71 design authority if necessary;
- release/manual-evidence documentation only when the implementation PR records actual evidence.

### Runtime files forbidden in #71

Unless Duy + ChatGPT approve a design amendment after a reported blocker, do not modify:

- `app.js`
- `japaneseApp.js`
- `core/state.js`
- workspace controllers/coordinators
- autosave/actions/lifecycle modules
- command registry/stack
- search worker/client
- parser/model
- storage/schema/migrations
- study scheduler/review persistence
- Kanji entry/controller/application/persistence modules

No dependency or package change is authorized.

## RED test contract

Create `tests/e2e/desktop-resilience.spec.mjs` and make the following assertions before applying runtime CSS changes that are needed to make them pass.

### Helper contract

Use a viewport-bound helper conceptually equivalent to:

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

Equivalent assertion helpers are allowed; semantics are not.

### Test A — reference viewport matrix

For each `1024×768`, `1280×720`, `1440×900`:

1. open `/`;
2. assert board/root has no horizontal document overflow;
3. open first note;
4. assert overlay inside viewport;
5. assert title/body visible/reachable;
6. open note actions and assert popover inside viewport;
7. close actions, open Details/inspector, assert inside viewport;
8. assert root still has no horizontal overflow.

### Test B — live resize preserves draft/query/focus

1. start at `1440×900`;
2. search for the existing note;
3. open the note;
4. fill a distinctive unsaved-in-flight title/body value under the existing autosave lifecycle;
5. focus `#contentInput`;
6. resize `1440×900 → 1024×768 → 1280×720`;
7. after each resize assert exact title/body value, search value, overlay mode, active note, `#contentInput` focus, and no horizontal overflow;
8. close overlay and verify existing focus-return behavior.

Do not trigger persistence merely to make resize assertions pass.

### Test C — supplemental `720×450` stress

At `720×450`:

- open note overlay;
- open/close action popover and inspector;
- open command palette after overlay closes;
- assert each active surface is inside the viewport;
- assert no horizontal document overflow;
- label the test/output as narrow-layout stress, not native zoom.

### Test D — long-content stress

Create/edit a note containing:

- English long text;
- Japanese repeated phrase;
- an unbroken ASCII token >=256 characters;
- code punctuation.

Assert board card, overlay, action surfaces, and root remain horizontally contained at `1024×768` and `720×450`.

### Test E — drawing canonical invariance under resize

Seed one or more valid V2 drawings using the same bounded IndexedDB test shape already used by `note-drawing-projection.spec.mjs`.

1. synchronize the existing drawing projection;
2. capture exact persisted entries before resize;
3. resize across the supported matrix and `720×450` stress;
4. assert drawing region/title/body stay reachable and direct projection remains above title/body;
5. capture persisted entries after resize;
6. assert deep equality of IDs, strokes, `paperStyle`, `createdAt`, `updatedAt`, and schema version;
7. assert no root horizontal overflow.

### Test F — Japanese surface containment/state

1. enter Japanese workspace;
2. exercise Filter A and `+ Filter` without clearing text search;
3. resize between supported viewports;
4. assert filter/query state remains visible/consistent;
5. open Japanese create menu and assert viewport containment;
6. when a review session fixture is available through existing helpers, open the review dialog, resize, and assert dialog/rating controls remain reachable and review state is not reset.

Do not create new learning semantics or synthetic application state solely for this test.

## Implementation sequence

1. Add the #71 Playwright helper/assertion file and run it against current `dev` to collect genuine RED failures.
2. Audit only the failing selectors plus the known containment surfaces in `styles.css`, `editor.css`, and `japanese.css`.
3. Apply the minimum CSS containment/reflow changes.
4. Run `tests/e2e/desktop-resilience.spec.mjs` to GREEN.
5. Run existing overlay/drawing/Japanese/visual focused tests.
6. Run the complete repository verification gate.
7. Perform manual native Chrome/Edge 200% zoom checks and record exact evidence/unknowns.
8. Self-review the diff for unauthorized JavaScript/state/schema/ownership/mobile scope.
9. Open one PR to `dev` and stop.

## Acceptance criteria

- [ ] `1024×768`, `1280×720`, and `1440×900` preserve the #90 board-first + centered-overlay model.
- [ ] Supplemental `720×450` narrow-layout stress passes but is not reported as native zoom proof.
- [ ] Native Windows Chrome 200% zoom evidence is recorded, or explicitly remains `UNKNOWN — REQUIRES VALIDATION` and blocks that environment claim.
- [ ] Native Windows Edge 200% zoom evidence is recorded, or explicitly remains `UNKNOWN — REQUIRES VALIDATION` and blocks that environment claim.
- [ ] The root document has no horizontal overflow in the automated matrix.
- [ ] Board cards tolerate long English/Japanese/code-like text without widening the root.
- [ ] The note overlay remains centered/bounded and title/body/actions stay reachable.
- [ ] Live resizing preserves active note, exact visible draft, query, and logical focus.
- [ ] Inspector and note action popover remain inside the viewport and internally scroll when needed.
- [ ] Command palette remains inside the viewport and command list scrolls internally when block space is constrained.
- [ ] Japanese filters/create/review surfaces remain bounded and do not reset canonical filter/review state.
- [ ] Zero drawings consume no permanent region.
- [ ] One/multiple drawings remain directly above title/body and bounded.
- [ ] Resize/zoom produces no change to persisted `KanjiInkEntry` records.
- [ ] Edit/Delete drawing affordances remain reachable through existing #69/#90 owners.
- [ ] No resize listener, viewport state, layout controller, schema, persistence, search, scheduler, parser, or framework change is introduced.
- [ ] No mobile/touch/native product support is claimed or implemented.
- [ ] Focus/IME/command scope remains owned by existing #74 behavior.
- [ ] Focused regression suites and full repository verification pass.
- [ ] No unresolved P0/P1 draft/focus/overflow/drawing-projection defect remains within the supported evidence boundary.

## Security and privacy

No new data path is introduced.

- Tests use synthetic content only.
- Do not log note bodies, Japanese study content, drawing strokes, or IndexedDB dumps in PR artifacts.
- Overflow/geometry diagnostics should contain dimensions/selectors only.
- No network or telemetry capability is added.

## Performance and resource bounds

#71 must avoid persistent runtime work.

Required result:

- no resize listener/controller;
- no polling/timer/observer loop added for layout;
- no persistence triggered by geometry changes;
- no full board/drawing/search rebuild on resize;
- CSS reflow is the primary mechanism;
- existing drawing preview count/bounds remain unchanged.

If native resizing reveals severe layout jank that cannot be attributed/tested through CSS, record it as a finding for architecture review rather than adding unapproved runtime orchestration.

## Accessibility

- existing keyboard navigation remains functional;
- focus ring cannot be clipped by new overflow rules;
- focused controls remain reachable in internally scrolling surfaces;
- closing overlay/popover/inspector/palette/review keeps existing deterministic focus return;
- no hover-only recovery/action path is added;
- 200% zoom is treated as an accessibility requirement only when evidenced natively;
- reduced-motion behavior remains unchanged and must stay green in existing tests;
- screen-reader/IME combinations not already supported remain explicit unknowns rather than new #71 claims.

## Compatibility and unsupported environments

Supported product claim for this package remains desktop browser only to the current release boundary.

Explicit unknowns unless directly evidenced:

- non-Chromium browsers;
- Android/iOS;
- mobile/tablet navigation;
- touch/virtual keyboard;
- OS display scaling as distinct from browser zoom;
- stylus/pen geometry behavior;
- untested screen-reader/IME/OS combinations.

## Migration

None.

#71 must not change IndexedDB version, canonical note shape, study review shape, `KanjiInkEntry` shape, parser metadata, export format, or stored records.

## Rollback

One PR revert of:

- #71 CSS/semantic presentation changes;
- #71 focused Playwright tests;
- #71 evidence documentation.

Rollback requires no data migration/downgrade and must preserve all notes, reviews, drawings, search data, and existing schema.

## Focused verification

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
npx playwright test tests/e2e/visual-system.spec.mjs
```

Also run the current Japanese progressive-disclosure/review E2E specs affected by CSS selectors.

## Complete verification

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

## Manual native zoom evidence

For both Windows Chrome and Windows Edge:

1. record OS and exact browser version;
2. open current implementation branch build;
3. set browser zoom to native `200%` using browser zoom controls;
4. verify Notes board at a desktop window size and no root horizontal overflow;
5. open existing note; type a distinctive draft; verify title/body/actions/drawing region reachable;
6. resize the desktop window while overlay is open;
7. verify draft/query/focus remain logical;
8. open note actions and Details; verify viewport containment;
9. open command palette; verify containment;
10. enter Japanese workspace; verify filters/create menu/review surface where data is available;
11. record result as PASS or exact failure/unknown.

Do not use browser `pageScaleFactor`, CSS transforms, or a small Playwright viewport as proof of native zoom.

## Codex stop conditions

Codex must stop and report instead of guessing when:

- a failing #71 behavior requires modifying application state/controllers/actions rather than CSS/semantic presentation;
- satisfying resize behavior appears to require a `resize` listener, `ResizeObserver`, viewport store, or persistence call;
- a test requires changing #69 drawing persistence/lifecycle semantics;
- a test requires changing Japanese scheduler/review semantics;
- an accepted transient surface cannot be bounded without changing its interaction owner;
- current `dev` has materially diverged from the design source such that selectors/owners no longer match;
- another runtime issue becomes conflicting/in-progress;
- native zoom evidence cannot be performed: record it as unknown rather than inventing equivalence.

## Definition of Done

#71 is implementation-complete only when one bounded PR targeting `dev` satisfies the automated contract, full verification is green, native zoom evidence is honestly recorded to the available environment boundary, the diff contains no unauthorized runtime ownership change, and Duy + ChatGPT review the PR.

Codex stops after opening the PR. Issue closure and progression to #72 are review/integration decisions, not Codex actions.