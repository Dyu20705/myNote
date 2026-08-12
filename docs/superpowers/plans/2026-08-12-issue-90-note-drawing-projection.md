# Issue #90 Direct Note Drawing Projection Plan

> **For implementers:** Reuse the complete issue #69 application/controller/storage boundary. This slice moves and bounds presentation; it does not create drawing state in notes.

**Goal:** Project valid note-linked Kanji drawings directly above the note title/body in the shared editor overlay, with immediate save refresh and direct Edit/Delete actions.

**Architecture:** `core/kanjiInkApplication.js` remains the only database-handle and CRUD service used by the UI. `ui/kanjiInkView.js` continues to validate/load entries through that service, but renders its bounded primary projection into `#noteDrawingRegion` instead of Details. `app.js` exposes the active note ID through a read-only composition-root accessor so filtered board DOM never becomes state authority.

**Tech Stack:** Vanilla JavaScript ES modules, native HTML dialogs, Canvas2D previews, CSS custom properties, Playwright Chromium, Node.js 22.

## Constraints

- Do not insert strokes, SVG, canvas pixels, base64, or drawing metadata into note title/content/blocks/tags/AST/search fields.
- Do not add or change IndexedDB schema, entry validation, storage transactions, controller save/retry, import/export, or search projection.
- Reuse command ID `notes.kanji-ink`; present it as `Add drawing` in the note action menu.
- Zero valid drawings consume no overlay space.
- Default multi-drawing presentation shows the newest drawing only; older drawings require a bounded disclosure with internal scrolling.
- V1 drawings remain read-only and losslessly visible; V2 drawings retain Edit/Delete.
- Save/delete failure must retain the previous canonical entry and report a concise error.
- Ordinary and Japanese notes use the same projection and overlay owner.
- Preserve title/body draft, selection, board query/scroll, modal isolation, and deterministic focus return.
- Do not push until the complete issue #90 release gate is green.

## Task 1: Specify the owner correction

- [x] Add RED browser coverage for zero drawing, immediate post-save projection above title/body, reload/reopen, vector-free canonical note content, direct Edit/Delete, and title/body draft preservation.
- [x] Add RED coverage proving multiple drawings default to one newest preview, older entries are disclosed inside a bounded region, and title/body remain reachable at supported desktop/equivalent zoom viewports.
- [x] Add RED coverage proving ordinary and Japanese overlays share the same projection.
- [x] Add RED coverage for save/delete failure retaining the prior canonical drawing and explicit retry/error presentation.

## Task 2: Add the direct projection host

- [x] Place `#noteDrawingRegion` before the overlay header so drawing projection precedes title/body while Pin/Details/More/Close retain their focus order.
- [x] Keep the drawing region hidden and out of layout when no valid/recovery/diagnostic content exists.
- [x] Add a bounded internal scroll owner so expanded drawings cannot make title/body unreachable.
- [x] Expose active note identity from the composition root instead of reconstructing state from visible cards.

## Task 3: Reuse #69 presentation and lifecycle

- [x] Render newest-first entry cards into the direct region through `kanjiInkApplication.loadNoteContext()`.
- [x] Keep one primary entry visible by default and disclose older entries in bounded windows.
- [x] Refresh immediately after create/edit/delete/undo and restore focus to a connected direct-surface control.
- [x] Report delete failure without removing the prior projection or claiming success.
- [x] Rename the visible extension action to `Add drawing` without changing its command ID or lifecycle owner.

## Task 4: Migrate and verify

- [x] Update only superseded Details-only and 64-preview presentation expectations in #69 browser/resource tests.
- [x] Run focused drawing, overlay, editor, Japanese, resource, import, and persistence regressions.
- [x] Run the complete repository release gate and `git diff --check`.
- [x] Update issue #90 docs/evidence, commit locally, and prepare the one consolidated push.

## Focused commands

```sh
npx --no-install playwright test tests/e2e/note-drawing-projection.spec.mjs --project=chromium
npx --no-install playwright test tests/e2e/kanji-handwriting.spec.mjs tests/e2e/kanji-resource.spec.mjs tests/e2e/editor-list-contract.spec.mjs --project=chromium
npm run lint
git diff --check
```
