# Issue #66 editor-first shell implementation plan

**Base:** `0015fc650de90eb50d6f81d6361494a4b66c9d28`
**Branch:** `ux/66-editor-first-shell`
**Issue:** #66 only

## Accepted input

- Repository authority: `docs/UX_QUALITY_BASELINE.md`, `docs/UX_DESIGN_HANDOFF.md`, and `docs/UX_ISSUE_EXECUTION.md`.
- Figma file: `mzhDU5IwWbd3n3P7oRf88q`.
- Required Figma reads passed for `13:2`, `18:2`, `39:2`, `50:2`, `50:92`, `51:351`, `51:466`, `55:2`, and `66:2`.
- The repository manifest decides whether design evidence is Accepted. Figma supplies layout and component evidence; it does not independently authorize downstream runtime behavior.

## Scope boundary

Issue #66 may change the semantic application shell, minimum desktop layout CSS, composition wiring for shell controls, focused tests, and this interaction contract. It must reuse the existing store, `NoteWorkspaceController`, `JapaneseWorkspaceCoordinator`, search client, history, backlinks index, autosave, and persistence authorities.

The branch will not implement the visual system (#67), command registry (#74), note-card/editor lifecycle redesign (#68), Kanji input (#69), Japanese Notes/Review redesign (#70), full responsive package (#71), recovery-state system (#72), or release gate (#73).

## Implementation sequence

1. **RED — composition contract**
   - Extend `tests/unit/application-composition.test.mjs`.
   - Require one application header, one workspace navigation owner, one labelled note-navigation region, and one main editor region.
   - Require stable shell control IDs and reject normal telemetry markup, duplicate runtime construction, page reload reconciliation, synthetic input/click coordination, and hidden DOM discovery.
   - Run the focused composition test and record the intended failure.

2. **RED — browser shell contract**
   - Add `tests/e2e/editor-shell.spec.mjs`.
   - Prove title/body visibility at 1440×900, 1280×720, and 1024×768 in Notes and 日本語, no horizontal document overflow, bounded secondary scrolling, coherent selected states, deterministic tab order, and absence of telemetry.
   - Prove search, ordinary Create, Japanese quick-create, explicit save, workspace switching, note selection, refresh, and palette remain functional.
   - Prove per-workspace query/selection/draft preservation during normal and rapid switching with pending autosave.
   - Run only this Playwright spec and record the intended failure.

3. **GREEN — semantic shell**
   - Restructure `index.html` so the header owns identity, workspace navigation, search, concise save status, current valid Create action, and explicit controller-backed refresh.
   - Give the note navigation and editor stable labelled landmarks.
   - Move existing Japanese secondary surfaces into the bounded note-navigation shell region without changing their lifecycle, dashboard derivation, filters, or quick-create behavior.
   - Remove normal telemetry markup while retaining measurement state and test instrumentation.

4. **GREEN — minimum shell wiring**
   - Update `app.js` only for the refresh control and shell presentation labels.
   - Reconcile through the existing autosave and workspace controller; do not reload, create services, access IndexedDB from UI, synthesize events, or click rendered nodes.
   - Update `japaneseApp.js` only if required to present the active workspace and current valid creation path without changing coordinator ownership.

5. **GREEN — bounded desktop layout**
   - Update `styles.css` and, only where the existing Japanese surfaces require it, `japanese.css`.
   - Keep a two-column desktop shell at 1024 CSS pixels and above, bound the note-navigation region and editor to the initial viewport, make secondary content scroll internally, and prevent horizontal document overflow.
   - Do not add mobile/off-canvas navigation or broad visual-system work.

6. **Contract documentation**
   - Add an Issue #66 implementation record to `docs/UX_QUALITY_BASELINE.md` covering stable IDs, ownership, Figma/repository reconciliation, unsupported environments, and rollback.

7. **Verification and evidence**
   - Run focused tests, relevant regressions, then the full repository gate.
   - Capture repository-safe screenshots at Notes and 日本語 for 1440×900 and 1024×768 plus a 200% zoom smoke check.
   - Record keyboard-only and rapid-switch evidence without personal note data.
   - Self-review the current-main diff for ownership, stale completion, draft/query/selection/focus loss, dead controls, overflow, synthetic coordination, and downstream scope creep.

## Rollback

Revert the single Issue #66 pull request. The rollback removes only shell HTML/CSS/wiring/tests/docs and preserves canonical notes, `studyReviews`, IndexedDB schema, persistence, search, history, backlinks, command behavior, export, and migration behavior.
