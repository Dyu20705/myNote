# PR #91 Deep-Review Fix Implementation Plan

> **For implementation workers:** Use the repository's subtask-driven workflow and complete each task with RED/GREEN evidence before moving on.

**Goal:** Resolve every actionable finding in the latest PR #91 deep review while preserving V1 losslessly, keeping V2 canvas-only, and leaving the PR unmerged for another external review.

**Architecture:** Keep `app.js` as the composition root and preserve `UI → Actions → State → Core → Persistence`. The controller owns canonical draft transitions; the UI owns pointer-session cleanup and bounded presentation; one pure paper-pattern contract supplies equivalent Canvas2D and SVG geometry; pagination remains a presentation concern over the existing validated note context.

**Tech stack:** Vanilla HTML/CSS/ES modules, Node.js `>=22.13 <23`, npm `11.7.0`, IndexedDB v3, Node test runner, Playwright Chromium.

## Global constraints

- Work only on `ux/69-saved-grid-canvas`, the existing PR #91 branch.
- Do not merge PR #91 or close #69.
- Do not add recognition, OCR, AI, model, dataset, telemetry, UI framework, or schema migration.
- Preserve every supported V1 record and keep V1 read-only.
- Keep V2 exact-key, canvas-only, `paperStyle: "grid"`, and character-free.
- Keep the database at version 3 and preserve persist-before-success ordering.
- Canonical Figma node `43:343` defines `Header → Toolbar → Canvas → Footer`; node `120:313` defines repeated horizontal paper rules.
- Native browser 200% zoom, OS display scaling, physical pen, and unsupported browser/device combinations remain `UNKNOWN — REQUIRES VALIDATION` unless directly measured.
- Every behavior change starts with a focused failing test and records the expected failure.

---

### Task 1: Pointer lifecycle, stroke limit, and dirty active gesture

**Files:**

- Modify: `core/kanjiInkController.js`
- Modify: `ui/kanjiInkView.js`
- Test: `tests/unit/kanji-ink-controller.test.mjs`
- Test: `tests/e2e/kanji-handwriting.spec.mjs`
- Test: `tests/e2e/kanji-resource.spec.mjs`

**Interfaces:**

- Controller snapshots continue to expose the existing fields and add no persisted state.
- `requestClose()` finalizes a meaningful active pen/marker gesture before dirty comparison; it deterministically applies or cancels eraser according to the same `endGesture()` transition.
- UI pointer cleanup always clears `activePointerId`, `liveStroke`, capture state, and temporary fallback listeners even when domain finalization throws.

- [ ] **Step 1: Add controller RED coverage**

Add a unit test that begins and appends a meaningful first gesture, calls `requestClose()`, and expects confirmation with the committed gesture preserved through `keepDrawing()`. Add a max-stroke assertion that the rejected 33rd gesture leaves the controller usable for Undo, Eraser, Clear, Save, and another gesture after capacity is freed.

- [ ] **Step 2: Run controller RED**

Run:

```sh
node --test tests/unit/kanji-ink-controller.test.mjs
```

Expected: the active-gesture close expectation fails because `requestClose()` currently clears the gesture.

- [ ] **Step 3: Add browser RED coverage**

Add Playwright cases for:

```text
32 committed strokes → rejected stroke 33 → bounded status → Undo → valid stroke → Save
pointerdown + meaningful pointermove → Escape → Keep drawing → continue → Save
forced setPointerCapture failure → release outside canvas → next stroke succeeds
```

Assert canonical stored stroke counts and absence of leaked global fallback behavior after repeated dialog close.

- [ ] **Step 4: Run browser RED**

Run:

```sh
npx --no-install playwright test tests/e2e/kanji-handwriting.spec.mjs tests/e2e/kanji-resource.spec.mjs --project=chromium
```

Expected: resource-limit status/recovery, mid-gesture confirmation, and capture-failure fallback assertions fail on the current UI.

- [ ] **Step 5: Implement minimal controller and pointer cleanup**

Use a single finalization path with `try/catch/finally`. Catch only bounded Kanji entry-limit errors for user presentation; rethrow unexpected errors after cleanup. Install document-level `pointerup`/`pointercancel` fallback listeners only during an active pointer session and remove them on completion, cancellation, close, and destroy. Pen/Marker preflight may reject when 32 strokes are already committed, but Eraser, Undo, Redo, Clear, Save, and Close stay available.

- [ ] **Step 6: Run focused GREEN and commit**

Run the commands from Steps 2 and 4, then `npm run lint` and `git diff --check`. Commit as:

```text
fix(kanji): recover bounded pointer sessions
```

### Task 2: Bounded newest-first drawing pagination

**Files:**

- Modify: `ui/kanjiInkView.js`
- Modify: `kanji-ink.css`
- Test: `tests/e2e/kanji-handwriting.spec.mjs`
- Test: `tests/e2e/kanji-resource.spec.mjs`

**Interfaces:**

- Storage ordering remains unchanged for existing consumers.
- Presentation sorts valid entries by `updatedAt` descending and then `id` deterministically.
- Initial window is 64 cards; a visible `Show older drawings` control advances the bounded window without duplicates until all valid entries are reachable.

- [ ] **Step 1: Add 65-entry RED tests**

Preload 65 valid V2 entries with literal stable IDs/timestamps. Assert the newest card is initially rendered, the oldest is absent, the total count is 65, the load-more control is reachable, activating it exposes the oldest card, and Edit/Delete work on loaded cards. Start with 64 entries, save entry 65, and assert the new entry appears immediately while the older-access path remains.

- [ ] **Step 2: Run pagination RED**

Run:

```sh
npx --no-install playwright test tests/e2e/kanji-handwriting.spec.mjs tests/e2e/kanji-resource.spec.mjs --project=chromium
```

Expected: newest visibility and older-access assertions fail because the current UI renders only `slice(0, 64)`.

- [ ] **Step 3: Implement presentation-owned pagination**

Track the visible count per active note, reset it on note change, retain or expand it during same-note synchronization, and ensure a fresh save is visible. Keep the complete list bounded to the current validated application result and render at most the requested window. Restore focus to the load-more control or the relevant refreshed card deterministically.

- [ ] **Step 4: Run focused GREEN and commit**

Run the Step 2 command, `npm run lint`, and `git diff --check`. Commit as:

```text
fix(kanji): keep every saved drawing reachable
```

### Task 3: Canonical ruled paper and accepted dialog hierarchy

**Files:**

- Create: `core/kanjiPaper.js`
- Modify: `core/kanjiInkProjection.js`
- Modify: `ui/kanjiInkView.js`
- Modify: `kanji-ink.css`
- Test: `tests/unit/kanji-paper.test.mjs`
- Test: `tests/unit/kanji-ink-projection.test.mjs`
- Test: `tests/e2e/kanji-handwriting.spec.mjs`
- Test: `tests/e2e/kanji-resource.spec.mjs`

**Interfaces:**

- `core/kanjiPaper.js` exports immutable semantic constants for the accepted repeated horizontal rules and pure geometry helpers for a bounded width/height.
- Canvas and SVG adapters consume the same spacing/orientation/color semantics; grid geometry remains derived and never enters V2 strokes.
- Dialog DOM order is Header, Toolbar, Canvas, Footer, Status/confirmation.

- [ ] **Step 1: Add pure renderer and SVG RED tests**

Use hand-derived expected horizontal rule positions for 160×160 and 860×430 surfaces. Assert SVG contains repeated horizontal rules, no vertical grid lines, and the existing safe path/tool-width contract.

- [ ] **Step 2: Run unit RED**

Run:

```sh
node --test tests/unit/kanji-paper.test.mjs tests/unit/kanji-ink-projection.test.mjs
```

Expected: missing helper and current square SVG pattern fail.

- [ ] **Step 3: Add browser structural RED tests**

Assert toolbar precedes canvas, footer follows canvas, the live and saved-preview canvases expose the same repeated-rule count through a stable semantic hook, and the layout remains bounded at `1024×768`, `1280×720`, `1440×900`, and equivalent `720×450` responsive evidence.

- [ ] **Step 4: Run browser RED**

Run:

```sh
npx --no-install playwright test tests/e2e/kanji-handwriting.spec.mjs tests/e2e/kanji-resource.spec.mjs --project=chromium
```

Expected: DOM order and paper-semantics assertions fail.

- [ ] **Step 5: Implement the shared ruled-paper contract**

Translate the accepted Figma context into vanilla DOM/CSS and Canvas2D/SVG without adding Tailwind or React. Reuse existing local icon assets and semantic color tokens. Preserve accessible names, titles, `aria-pressed`, keyboard reachability, empty-save disabled state, and focus return.

- [ ] **Step 6: Run focused GREEN and commit**

Run the commands from Steps 2 and 4, `npm run lint`, and `git diff --check`. Commit as:

```text
fix(kanji): align ruled paper with accepted design
```

### Task 4: Evidence-accurate performance, zoom, and repository contracts

**Files:**

- Modify: `tests/e2e/kanji-resource.spec.mjs`
- Modify: `docs/architecture/KANJI_HANDWRITING.md`
- Modify: `docs/PERFORMANCE_BUDGET.md`
- Modify narrowly: `docs/UX_DESIGN_HANDOFF.md`
- Modify narrowly: `docs/UX_ISSUE_EXECUTION.md`

**Interfaces:**

- The 720×450 case is named equivalent responsive-layout evidence, not native browser zoom.
- Performance evidence uses bounded fixtures, stable operation counts, payload limits, and conservative timing thresholds only where CI variance is acceptable.

- [ ] **Step 1: Define drawing budgets and tests**

Record fixture sizes and thresholds for validating/serializing one maximum-shape entry, loading/reloading a note context, and rendering the bounded 64-preview window. Prefer deterministic counts and generous measured thresholds; record environment limitations and keep physical/native behavior unknown.

- [ ] **Step 2: Run focused resource evidence**

Run:

```sh
npx --no-install playwright test tests/e2e/kanji-resource.spec.mjs --project=chromium
node --test tests/unit/kanji-ink-entry.test.mjs tests/unit/kanji-ink-projection.test.mjs
```

Record fixture, method, threshold, and result.

- [ ] **Step 3: Reconcile stale repository prose narrowly**

Replace only the obsolete #69 recognition/candidate sections in the two UX handoff/execution documents. Preserve historical node records where explicitly labeled superseded and make accepted node `43:343` plus owner issue #69 the current authority.

- [ ] **Step 4: Run content/lint/diff checks and commit**

Run:

```sh
npm run test:content
npm run lint
git diff --check
```

Commit as:

```text
docs(kanji): record bounded drawing evidence
```

### Task 5: Reconcile GitHub roadmap issue bodies

**External targets:** `#15`, `#20`, `#63`, `#64`, `#73`, `#75`; inspect-only guard: `#90`.

- [ ] **Step 1: Prepare narrow body patches**

For each target, replace recognition/candidate/confirmed-Unicode requirements with saved-grid V2 canvas + `paperStyle: "grid"`, retain V1 compatibility language, keep KanjiInkEntry separate from Japanese review/mastery state, and preserve unrelated history/dependencies.

- [ ] **Step 2: Validate before write**

Re-read each proposed body, confirm the target number/title, compare against #69 and #90, and ensure no issue is closed or relabeled.

- [ ] **Step 3: Apply and verify GitHub updates**

Update only the six issue bodies, then read them back and verify the saved-grid contract. Do not modify #90.

### Task 6: Full gate, review, push, and PR fix report

**Files:** Any focused fixes required by verification or independent review remain within this PR's approved boundaries.

- [ ] **Step 1: Run the clean full gate**

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

- [ ] **Step 2: Run an independent whole-branch review**

Review the complete `origin/main...HEAD` diff against #69, Figma `43:343`/`120:313`, the deep-review findings, data integrity, accessibility, resources, and rollback. Fix every P0/P1 with focused RED/GREEN coverage and re-review the fix diff.

- [ ] **Step 3: Push the existing branch**

Push `ux/69-saved-grid-canvas`; do not create a replacement PR and do not merge.

- [ ] **Step 4: Add the PR fix report**

Post `## Fix report after deep review` to PR #91 with root cause, files, behavior, focused tests, exact full-gate results, remaining unknowns, and this exact closing sentence:

```text
Implementation fixes are complete and the PR is ready for another external review. No merge was performed.
```
