# Issue #68 Editor and List Rationalization Implementation Plan

> Execute each checked task in order. Every production change begins from a focused failing assertion and remains independently reviewable.

**Goal:** Make ordinary notes fast to scan, calm to edit, progressively disclosed, and safely recoverable without changing canonical note, search, persistence, or Japanese lifecycle ownership.

**Architecture:** Add one bounded presentation helper for note cards and one bounded presentation-only note-action registry that references command IDs from #74. Recompose existing HTML/CSS into an editor context header, Details inspector, and More actions popover while every save/delete/pin/archive operation continues through the existing command registry and lifecycle owners.

**Tech Stack:** Vanilla HTML, CSS custom properties, ES modules, IndexedDB lifecycle owners, Node.js 22.20.0, npm 11.7.0, Playwright 1.62.0.

## Global Constraints

- Base exactly on `main@7ea7a8333bee51548b3fd48a70703422c7f97822`.
- Implement only #68 on `ux/68-editor-list-rationalization`.
- Preserve `UI → Actions → State → Core → Persistence` and the #74 single command owner.
- Add no dependency, parser authority, search-ranking change, schema, migration, rich-text mode, Japanese IA, responsive one-pane navigation, or Kanji implementation.
- Figma node `42:167` supplies the inspector/action presentation contract; repository status and lifecycle behavior remain authoritative.
- Routine `Saved locally` remains restrained, despite the brighter Figma sample.
- Empty inspector regions stay hidden; inspector and action menu never own persistence.
- Delete remains recoverable through the existing command stack and undo command.

---

## File Structure

- Create `ui/notePresentation.js`: bounded presentation-only Markdown cleanup and card metadata derivation.
- Create `ui/noteActionRegistry.js`: bounded descriptors that reference existing command IDs; no execution closure.
- Modify `ui/list.js`: one selectable card per note, safe preview, semantic selected state, no permanent delete control.
- Modify `index.html`: coherent editor header, one save status owner, Details inspector, More actions popover, bounded undo notice.
- Modify `app.js`: inspector/menu rendering, command invocation by ID, focus return, recovery notice, action extension composition.
- Modify `styles.css`: Figma-aligned card/header/inspector/popover hierarchy.
- Test `tests/unit/note-presentation.test.mjs`, `tests/unit/note-action-registry.test.mjs`, and `tests/e2e/editor-list-contract.spec.mjs`.
- Modify existing browser tests only where the accepted UI contract replaces a permanent Save or delete control.
- Create `docs/EDITOR_LIST_CONTRACT.md`.

## Task 1: Establish intentional RED contracts

- [ ] Add unit tests requiring bounded plain-text preview cleanup, empty output without fabricated copy, deterministic truncation, input immutability, note metadata hierarchy, action descriptor validation, duplicate/limit rejection, command-snapshot resolution, and unregister safety.
- [ ] Register both unit suites in `npm run test:unit`.
- [ ] Add browser tests requiring one editor context header, save status inside it, no permanent dominant Save button, Details focus return, hidden empty backlinks, labelled action menu, no permanent `×`, semantic selected card, delete/undo recovery, and command-palette parity.
- [ ] Open a draft PR and verify unit RED is caused only by absent helper modules and browser RED by the existing UI.

## Task 2: Implement presentation helpers

- [ ] Implement `deriveNotePreview(content, { maxLength = 160, maxScanLength = 8192 })` without importing or replacing the canonical parser.
- [ ] Keep text labels while removing presentation-only Markdown delimiters, fenced delimiters, link destinations, HTML-looking tags, repeated whitespace, and unsafe control characters.
- [ ] Return `""` for empty content; never fabricate `Empty note`.
- [ ] Implement `createNoteCardPresentation(note, { formatDate })` with bounded preview, date, up to four tags, and existing pin/archive state.
- [ ] Implement `createNoteActionRegistry({ maxActions = 16 })`; descriptors contain only `commandId`, `tone`, `order`, and optional placement. `snapshot(commands)` resolves current registry metadata and availability.
- [ ] Run focused unit tests and commit GREEN.

## Task 3: Recompose note cards

- [ ] Remove the sibling `×` button and `onDelete` list callback.
- [ ] Render one native note button with title, metadata row, optional preview, and bounded tags.
- [ ] Set `aria-current="true"` only for the active note and retain the existing non-color selected rail.
- [ ] Preserve virtualization, ordering, active restoration, and keyboard controller ownership.
- [ ] Run list/unit/browser slices and commit.

## Task 4: Build editor context header and progressive disclosure

- [ ] Move the editable title, the sole `#saveState` live-status region, Details, and More actions into one 760px editor header.
- [ ] Remove the top-header save status and permanent primary Save button; keep explicit flush through `editor.save`, `Ctrl/Cmd+Enter`, and More actions.
- [ ] Add `#noteInspector` with Backlinks, Metadata, and a hidden supplementary-entity slot. Hide empty backlink and supplementary sections.
- [ ] Add `#noteActionsPopover` rendered from the note-action registry with Save, Pin/Unpin, Archive, and labelled Delete.
- [ ] Close Details/More with Escape or explicit close and restore focus to the opener.
- [ ] Ensure popover/inspector invoke command IDs only and perform no persistence.
- [ ] Run focused browser tests and commit.

## Task 5: Recoverable delete and stable status

- [ ] After successful delete, show one bounded `#undoNotice` with `Undo` that invokes `history.undo` through the registry; preserve enrolled Japanese atomic delete routing.
- [ ] Return focus to the active note card, editor header, or note navigation region deterministically.
- [ ] Avoid live-region churn: write `Unsaved changes` only on clean→dirty transition and canonical save/failure messages only when state changes.
- [ ] Verify ordinary delete/undo persistence, palette/direct parity, save failure, rapid workspace switching, and selected-note stability.
- [ ] Commit.

## Task 6: Documentation, self-review, and merge gate

- [ ] Document the card presentation boundary, editor status owner, Details inspector, action descriptor extension point for #69, deletion recovery, focus, evidence, limits, and rollback.
- [ ] Update existing tests and documentation that intentionally referenced the removed permanent Save/`×` controls.
- [ ] Run the full repository gate and `git diff --check`.
- [ ] Self-review for canonical-content mutation, duplicate command ownership, hidden destructive actions, stale availability, focus loss, selected-note loss, direct persistence, and #69/#70/#71 scope creep.
- [ ] Merge only after final-head CI is green and no P0/P1 blocker remains.
