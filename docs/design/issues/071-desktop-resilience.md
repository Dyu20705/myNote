# 71 — Desktop Resize, Zoom, and Overflow Resilience

## Status

- Issue: #71
- Design status: accepted
- Implementation target: `dev`
- Runtime baseline: completed #90 board/overlay runtime
- Parent: #15
- Execution roadmap: #20
- Depends on: #65, #66, #67, #74, #68, #69, #70, #90 accepted/integrated
- Blocks: #72, then #73
- Review authority: owner + architecture reviewer

## Goal

Make the accepted board-first desktop application resilient to supported window resizing and native 200% browser zoom without adding mobile navigation, viewport-owned application state, or a second drawing/persistence owner.

## User outcome

A desktop user can resize the window or use 200% browser zoom while the board remains usable, the centered note overlay remains reachable, drafts/query/filter/review context and logical focus remain intact, saved drawings remain directly above title/body, transient surfaces stay bounded, and the root document never develops horizontal overflow.

## Verified baseline

The accepted runtime already provides:

- board-first Notes and Japanese Notes;
- one centered `NoteEditorOverlay` for create/edit;
- board card wrapping and `min-width: 0` containment;
- a viewport-bounded note overlay;
- a bounded internally scrollable drawing region;
- absolute/fixed inspector and note-action surfaces with narrow CSS rules;
- a width-bounded command panel;
- wrapping Japanese Filter A controls and a scrollable review dialog;
- existing regression coverage for overlay focus return, draft/query preservation, drawing projection, zero/multiple drawings, and narrow CSS layout stress.

These primitives are hardened, not replaced.

## Architecture decision — presentation only

#71 is a presentation-resilience package.

Runtime changes are limited to:

- CSS containment;
- semantic markup/attributes strictly required for containment/accessibility;
- Playwright regression evidence;
- recorded environment evidence.

Do not add:

- `resize` event listeners;
- `ResizeObserver` layout ownership;
- viewport dimensions in application state;
- breakpoint-specific command/action state;
- a layout coordinator;
- a viewport-specific drawing controller;
- persistence writes caused by resize/zoom.

If a genuine RED exposes state loss that cannot be fixed through existing presentation/focus ownership, implementation stops and reports the exact failing contract. JavaScript resize ownership is not authorized.

## Preserve board-first interaction

Every supported desktop size remains:

```text
board
→ centered NoteEditorOverlay for create/edit
→ close/save
→ same board context
```

Do not introduce a permanent editor pane, list/editor route split, back button, drawer, bottom navigation, or off-canvas mobile navigation.

## Supported evidence matrix

Automated reference viewports:

- `1024×768`
- `1280×720`
- `1440×900`

Supplemental narrow-layout stress:

- `720×450` CSS viewport

The supplemental viewport is not native zoom proof.

Required native evidence:

- Windows desktop Chrome at native browser zoom 200%;
- Windows desktop Edge at native browser zoom 200%.

Record browser version, OS version, window/viewport dimensions, workflow, and result. If unavailable, record `UNKNOWN — REQUIRES VALIDATION`.

## Root/shell contract

At each automated viewport:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth
```

The application shell remains within the CSS viewport. Vertical pressure is absorbed by existing bounded panels/transient surfaces rather than root horizontal scrolling.

## Board contract

- board columns adapt to available width;
- long English/Japanese/unbroken code-like text cannot widen a card beyond its column;
- active note identity remains stable through resize;
- board query remains stable;
- board scroll position remains stable through overlay resize except unavoidable browser clamping when available scroll range genuinely shrinks;
- focus return after overlay close remains deterministic.

## Note overlay contract

- remains centered and fully bounded by viewport;
- title/body/save state/pin/close/overflow actions remain reachable;
- constrained height uses existing internal scrolling rather than root overflow;
- exact visible draft survives resize;
- `#contentInput` retains logical focus when it remains available;
- closing returns focus to the logical opener.

## Drawing contract

- zero drawings consume no permanent drawing region;
- one/multiple drawings remain directly above title/body using existing bounded disclosure;
- title/body remain reachable;
- Edit/Delete controls remain reachable;
- resize/zoom does not create, update, delete, reorder, or re-persist canonical drawing records;
- drawing vectors/base64 never enter note content for layout purposes.

Before/after canonical drawing snapshots must be equal for a resize-only test.

## Transient-surface contract

Note actions, Details/inspector, command palette, Japanese create menu, and review dialog must stay within the viewport.

Static containment is necessary but not sufficient. At least one regression must exercise:

```text
open transient surface
→ focus a real control
→ resize while it remains open
→ surface remains visible and contained
→ logical focus remains in the same surface/control when still valid
```

The command palette must also be exercised through open → resize → preserve where existing command ownership permits it without new state.

Hidden/collapsed surfaces cannot retain active focus.

## Japanese state contract

Resize must not clear/reinitialize:

- Japanese workspace;
- text query;
- Filter A/advanced filter state;
- active Japanese note;
- review session/reveal state.

Filter presets/chips may wrap. Existing narrow grid stacking is allowed. Review/create surfaces use internal scrolling when constrained.

## Long-content contract

Automated coverage includes:

- long English prose;
- long Japanese text without convenient spaces;
- an unbroken ASCII/code-like token of at least 256 characters;
- mixed code/Markdown punctuation.

Expected result: root horizontal overflow remains absent and title/body/card/transient surfaces remain reachable.

## Allowed files

Runtime only if genuine RED requires it:

- `styles.css`
- `editor.css`
- `japanese.css`
- `index.html` only for strictly necessary semantic containment/accessibility

Tests:

- create/extend `tests/e2e/desktop-resilience.spec.mjs` as the cross-surface #71 evidence owner;
- existing focused overlay/drawing/visual/Japanese tests only for regressions owned by those suites.

## Forbidden runtime files/boundaries

Without an accepted design amendment do not modify:

- `app.js`;
- `japaneseApp.js`;
- state/workspace controllers;
- autosave/actions/lifecycle;
- command registry/stack;
- search worker/client;
- parser/model;
- storage/schema/migrations;
- study scheduler/review persistence;
- Kanji persistence/controller/application modules;
- package dependencies.

## RED/regression contract

Create evidence before runtime fixes for:

1. all three reference viewport containment;
2. live resize preserving active note, exact draft, query, logical focus, overlay mode, and non-zero board scroll context;
3. long-content/root overflow;
4. drawing projection and canonical before/after equality;
5. note actions/Details/command palette containment;
6. open-transient-surface resize preservation;
7. Japanese filter/create/review state preservation;
8. supplemental 720×450 stress.

If these assertions are already GREEN, do not manufacture CSS changes.

## Failure/recovery

Resize itself is never a persistence trigger. Existing autosave may persist actual user edits according to its own contract.

A test or environment failure outside #71 is reported separately and does not authorize unrelated runtime changes.

## Security/privacy

- no new network/data path;
- synthetic test content only;
- no note body, drawing stroke dump, review payload, or database dump in diagnostics/artifacts;
- no new credential/trust boundary.

## Performance/resources

Resize adds no polling, persistent timer, listener, observer, viewport store, persistence call, full search rebuild, or drawing rebuild.

A test-only implementation has zero runtime cost.

## Accessibility

- title/body/actions remain keyboard reachable;
- logical focus survives resize when the focused control remains valid;
- closing transient/overlay surfaces retains existing deterministic focus return;
- no hover-only core action is introduced;
- native 200% zoom receives no PASS credit without direct evidence.

## Compatibility

M2 supports desktop browser behavior only. Mobile/tablet, touch-first, virtual keyboard, Android/iOS browser, orientation, native/PWA wrapper, and stylus guarantees remain outside this issue.

Unsupported environments are explicit unknowns.

## Focused verification

```sh
npx playwright test tests/e2e/desktop-resilience.spec.mjs
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
npx playwright test tests/e2e/visual-system.spec.mjs
npx playwright test tests/e2e/japanese-progressive-disclosure.spec.mjs
npx playwright test tests/e2e/japanese-filters.spec.mjs
```

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

## Acceptance criteria

- reference viewport matrix has no root horizontal overflow;
- board-first/centered-overlay interaction remains intact;
- live resize preserves active note, exact draft, query, overlay mode, focus, and board scroll context;
- open transient surfaces remain visible/contained/logically focused through resize;
- long English/Japanese/code-like content is contained;
- drawings remain directly above title/body and canonical drawing data is unchanged by layout;
- Japanese filter/create/review state survives resize;
- no forbidden runtime owner is added;
- 720×450 is described only as supplemental stress;
- native Chrome/Edge 200% is directly evidenced or remains unknown;
- complete repository verification is green before review status.

## Rollback

One revert of #71 test/presentation changes. No schema/data downgrade or migration is required.

## Stop conditions

Stop if satisfying the contract requires unauthorized JavaScript state/controller ownership, drawing persistence changes, learning/scheduler changes, mobile navigation, or another subsystem's unrelated repair.

## Completion rule

The implementation pull request targets `dev` and remains unmerged for owner/reviewer review. #71 stays `status/in-progress` until the complete current-head gate is green, then may move to `status/review`. #72 remains blocked until #71 is accepted/integrated.
