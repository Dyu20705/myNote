# Issue #90 Note Editor Overlay Implementation Plan

> **For implementers:** Use the repository's plan-execution workflow and retain RED/GREEN evidence for every behavior change.

**Goal:** Replace the permanently visible editor with one centered create/edit overlay that preserves board query, scroll, and deterministic focus return.

**Architecture:** `app.js` remains the composition root and canonical lifecycle coordinator. A new `ui/noteEditorOverlay.js` module owns only native-dialog presentation state, board scroll snapshots, close serialization, and focus restoration. The existing workspace controller continues to own active selection and query state; autosave continues to own draft flushing; `editorChrome.js` continues to consume the command/action registry.

**Tech Stack:** Vanilla JavaScript ES modules, native HTML dialog, CSS custom properties, Playwright Chromium, Node.js 22.

## Global constraints

- Continue from local commit `871ceb8` on the existing issue #90 worktree and PR branch.
- Do not add state, persistence, search, filter, or review ownership to the overlay module.
- Do not clear text search when create/edit opens or closes.
- Flush the canonical draft before close; keep the overlay open when the flush rejects.
- Use the existing `editor` command scope as the modal scope so shell navigation cannot mutate the board behind the overlay.
- Keep the existing note action boundary; move pin to the visible overlay toolbar and retain rare/destructive actions in overflow.
- Use text nodes, accessible names, native focus isolation, and deterministic focus fallback.
- Do not push this slice until its focused and affected regression gates are green.

## File map

- Create `ui/noteEditorOverlay.js`: dialog lifecycle, context snapshot, and focus return.
- Modify `index.html`: board-first shell, one shared dialog, toolbar controls, and no instructional editor footer.
- Modify `styles.css` and `editor.css`: full-width board plus centered overlay/backdrop and compact controls.
- Modify `ui/list.js`: pass the selected card as the opener without changing selection ownership.
- Modify `app.js`: compose the overlay, preserve query on create, open after canonical create/select, and expose editor modal scope.
- Modify `ui/editorChrome.js`: top-right pin action, rare-action overflow, delete-close handoff, and toolbar synchronization.
- Modify `japaneseApp.js`: open the shared overlay only after canonical quick-create succeeds.
- Add or modify focused E2E contracts and update superseded permanent-editor assertions.

---

### Task 1: Specify board-first and shared overlay behavior

**Files:**
- Create: `tests/e2e/note-editor-overlay.spec.mjs`

- [x] Add a RED test proving the initial healthy Notes surface exposes cards while the note editor dialog and inputs are hidden.
- [x] Add a RED test proving `New note` opens the shared dialog in create mode, the title receives focus, the dialog is centered and bounded, and close returns focus to the create control.
- [x] Add a RED test proving selecting a card opens the same dialog in edit mode and close returns focus to that card.
- [x] Add a RED test proving query, board scroll, and an edited draft survive open, save-on-close, and reopen.
- [x] Add a RED test proving shell navigation shortcuts are isolated while the overlay is modal.
- [x] Run the new file and record failures caused by the permanent editor and missing dialog.

### Task 2: Implement the isolated overlay lifecycle

**Files:**
- Create: `ui/noteEditorOverlay.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `editor.css`

- [x] Implement a validated `createNoteEditorOverlay()` boundary with `open`, `requestClose`, `isOpen`, and `destroy`.
- [x] Capture the nearest notes-panel scroll position and opener/card identity before `showModal()`.
- [x] Prevent native cancel from bypassing the async flush callback.
- [x] On close, restore the exact scroll offset, then focus the connected opener, replacement card, or supplied shell fallback.
- [x] Move the existing editor into one native dialog, add create/edit labeling, close and pin controls, and move the undo notice outside the modal.
- [x] Make the board fill the healthy workspace and add a dimmed/blurred backdrop with bounded 1024/1280/1440 and 200% zoom geometry.

### Task 3: Wire canonical create/edit and action behavior

**Files:**
- Modify: `ui/list.js`
- Modify: `app.js`
- Modify: `ui/editorChrome.js`
- Modify: `japaneseApp.js`

- [x] Pass the selected card node as presentation context while preserving the existing selection callback contract.
- [x] Open edit mode only after workspace selection commits.
- [x] Open create mode only after canonical create commits; bootstrap seeding remains board-only.
- [x] Preserve the existing query through create, close, save, and undo instead of resetting it.
- [x] Map an open note dialog to `modalScope: "editor"` so only editor-scoped shortcuts dispatch.
- [x] Render healthy save state as compact `Saved`, while storage/index failures remain explicit.
- [x] Execute pin through the existing command registry, synchronize its pressed/name state, and remove pin/save from rare-action overflow.
- [x] Close after successful delete and expose the existing recoverable Undo notice on the board.
- [x] Let Japanese quick-create open the same overlay after its atomic note/review pair succeeds.

### Task 4: Reach focused GREEN and migrate superseded contracts

**Files:**
- Modify only affected tests whose permanent-editor assumptions are superseded by issue #90.

- [x] Run the focused overlay test and static checks.
- [x] Run editor-list, editor-shell, command-registry, notes, persistence, Japanese workspace/progressive-disclosure, and visual-system packages.
- [x] Replace only assertions that require a permanently visible editor; preserve behavior, persistence, command, IME, and review isolation coverage.
- [x] Run content, lint, unit, and integration regression packages.
- [x] Review the exact diff and commit locally without pushing.

## Focused commands

```sh
npx --no-install playwright test tests/e2e/note-editor-overlay.spec.mjs --project=chromium
node --check ui/noteEditorOverlay.js
npx --no-install eslint ui/noteEditorOverlay.js app.js ui/list.js ui/editorChrome.js japaneseApp.js tests/e2e/note-editor-overlay.spec.mjs
git diff --check
```

## Affected regression commands

```sh
npx --no-install playwright test tests/e2e/editor-list-contract.spec.mjs tests/e2e/editor-shell.spec.mjs tests/e2e/command-registry-red.spec.mjs tests/e2e/notes-regression.spec.mjs tests/e2e/persistence.spec.mjs tests/e2e/japanese-workspace.spec.mjs tests/e2e/japanese-progressive-disclosure.spec.mjs tests/e2e/visual-system.spec.mjs --project=chromium
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
```

## Handoff

This slice remains part of the single issue #90 PR. Filter A, the compact Review entry, final cheatsheet content, and complete multi-viewport browser evidence remain later bounded work on the same branch.
