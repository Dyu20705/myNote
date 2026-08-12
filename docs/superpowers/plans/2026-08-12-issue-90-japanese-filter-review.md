# Issue #90 Japanese Filter and Review Implementation Plan

> **For implementers:** Preserve the existing Japanese filter, review-session, scheduler, and persistence owners while adapting only their presentation.

**Owner reconciliation:** Reading remains visible but disabled for M2 until Japanese V2 defines canonical semantics. Enabled common controls resolve through the canonical M2 type set; native browser 200% zoom is deferred to #71, not this package.

**Goal:** Match the accepted Japanese board with instant common filters, advanced canonical filter disclosure, and one-action Review entry.

**Architecture:** `JapaneseNoteFilter` remains the only structured-filter state and application owner. `ui/japanese-filters.js` adds presentation adapters for common type buttons without adding a query path. `japaneseApp.js` keeps review orchestration and opens the existing review dialog directly from the board entry. The dashboard remains a derived-state source for counts and repair diagnostics, but is no longer a mandatory review route.

**Tech Stack:** Vanilla JavaScript ES modules, semantic HTML, CSS custom properties, Playwright Chromium, Node.js 22.

## Global constraints

- Continue from local commit `1885bc3` on the existing issue #90 worktree and PR branch.
- Do not push until all remaining issue #90 behavior and repository verification are complete.
- Do not add notebook types, review schema, scheduler rules, resource packs, or content-query logic.
- Common filter controls must write through `JapaneseNoteFilter.update()` and request the existing workspace refresh.
- Text search must remain independent and must survive common, advanced, remove-chip, and clear operations.
- The accepted Reading shortcut cannot invent an M2 canonical type; expose its unavailability explicitly until its owning model exists.
- Review entry must start or resume the existing review session in one action and return focus to the same board control.
- Keep repair diagnostics accessible without forcing a dashboard ceremony into the normal review path.

## File map

- Modify `index.html`: Filter A controls, compact board Review entry, and diagnostic disclosure.
- Modify `ui/japanese-filters.js`: common-filter presentation adapter, pressed state, canonical update path, and focus return.
- Modify `japaneseApp.js`: direct Review entry, due count/availability, diagnostic disclosure, and deterministic focus return.
- Modify `japanese.css`: accepted board toolbar hierarchy, pill filters, compact Review button, and bounded diagnostic panel.
- Modify affected Japanese E2E contracts and retain scheduler/persistence/failure coverage.
- Create `docs/cheatsheet.md` in the final guidance slice after presentation behavior is green.

---

### Task 1: Specify Filter A and direct Review behavior

**Files:**
- Modify: `tests/e2e/japanese-progressive-disclosure.spec.mjs`
- Modify: `tests/e2e/japanese-filters.spec.mjs`

- [x] Add RED coverage for visible `All`, `Vocabulary`, `Grammar`, `Kanji`, `Reading`, and `+ Filter` controls on Japanese Notes.
- [x] Prove common canonical type controls update immediately, expose pressed state, and preserve text search.
- [x] Prove Reading communicates an explicit unavailable reason without mutating filter state.
- [x] Prove `+ Filter` opens date/type controls with no Apply button and active values remain removable chips.
- [x] Prove `Review N` starts/resumes the existing modal in one action and closes back to that entry.
- [x] Prove zero-due and unavailable states remain explicit with programmatically associated reasons.

### Task 2: Implement Filter A through the current owner

**Files:**
- Modify: `index.html`
- Modify: `ui/japanese-filters.js`
- Modify: `japaneseApp.js`
- Modify: `japanese.css`

- [x] Add semantic common-filter buttons with canonical values and accessible pressed state.
- [x] Route canonical buttons through `filter.update({ notebookType })`, sync advanced controls, render, and refresh.
- [x] Keep Reading disabled with a bounded M2 ownership reason and no state mutation.
- [x] Rename the existing disclosure trigger to `+ Filter` and keep date/type controls instant.
- [x] Preserve removable chips, validation state, busy state, and clear behavior.
- [x] Style the toolbar as accepted compact pills while retaining visible focus and responsive wrapping.

### Task 3: Make Review one intentional board action

**Files:**
- Modify: `index.html`
- Modify: `japaneseApp.js`
- Modify: `japanese.css`

- [x] Replace the Notes/Review subview ceremony and summary card with one compact `Review N` board control.
- [x] Start or resume the existing review dialog directly from that control.
- [x] Return focus to the Review entry on ordinary close and to a valid Japanese shell fallback after completion.
- [x] Keep repair and derived metric diagnostics behind explicit disclosure rather than deleting their presentation.
- [x] Preserve rating failure, resume, completion, missing/archived skip, and modal shortcut isolation behavior.

### Task 4: Verify and commit locally

- [x] Run focused Japanese filter/progressive/release/workspace/delete/degraded tests.
- [x] Run command-registry and editor-shell modal/workspace regressions.
- [x] Run content, lint, unit, integration, and complete E2E gates.
- [x] Review exact diff and commit locally without pushing.

## Focused commands

```sh
npx --no-install playwright test tests/e2e/japanese-filters.spec.mjs tests/e2e/japanese-progressive-disclosure.spec.mjs --project=chromium
npx --no-install playwright test tests/e2e/japanese-workspace.spec.mjs tests/e2e/japanese-release-gate.spec.mjs tests/e2e/japanese-delete.spec.mjs tests/e2e/japanese-degraded-mode.spec.mjs --project=chromium
npx --no-install eslint japaneseApp.js ui/japanese-filters.js tests/e2e/japanese-filters.spec.mjs tests/e2e/japanese-progressive-disclosure.spec.mjs
git diff --check
```

## Handoff

This slice remains part of the single issue #90 PR. After it is green and committed locally, create the cheatsheet, update superseded documentation, capture final runtime viewport evidence, run the repository installation/release gate, then perform one consolidated push to the existing draft PR.
