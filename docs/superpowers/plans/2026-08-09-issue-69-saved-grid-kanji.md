# Issue #69 Saved-Grid Kanji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace recognition-era Kanji input with an owner-approved saved-grid vector canvas while preserving legacy V1 records losslessly.

**Architecture:** Keep `kanjiInkEntries`, the note action, application service, and atomic note-dependent lifecycle. Dispatch entity behavior by record schema version; new writes are strict V2, legacy V1 stays lossless and read-only in the new editor. The controller owns bounded edit history and persistence state; the UI adapts pointer events and renders accepted Figma node `43:343`.

**Tech Stack:** Vanilla JavaScript ES modules, HTML dialog/canvas, CSS custom properties, IndexedDB, Node test runner, Playwright.

## Global Constraints

- Preserve `UI -> Actions -> State -> Core -> Persistence` and keep UI storage-agnostic.
- Keep `app.js` as the shared runtime composition root; do not introduce a framework or component library.
- Canonical persistence succeeds before state/history/success presentation.
- Do not bump or downgrade IndexedDB version 3.
- Preserve all readable legacy V1 data and cloneable unknown own fields; never upgrade V1 on read.
- New V2 writes contain no recognized character, recognizer provenance, candidate data, vector/base64 Markdown, or parser metadata.
- Exact bounds: 32 strokes, 256 points per stroke, 4,096 total points, 262,144 serialized bytes, 600,000 ms per stroke, 100 undo states, 64 rendered entries.
- Exact V2 widths: Pen `0.008`; Marker `0.024`; paper style `grid`.
- Accepted Figma implementation node: `43:343`; supported desktop checks: `1024x768`, `1280x720`, `1440x900`, and 200% browser zoom.
- One issue, one branch, one PR; maximum eight commits; no unrelated refactor.

---

### Task 1: Versioned entity and lossless projection contracts

**Files:**
- Modify: `core/kanjiInkEntry.js`
- Modify: `core/kanjiInkProjection.js`
- Modify: `tests/unit/kanji-ink-entry.test.mjs`
- Modify: `tests/unit/kanji-ink-projection.test.mjs`

**Interfaces:**
- Produces: `validateKanjiInkEntry(input)`, `createKanjiInkEntryV2(input)`, `validateKanjiInkEntryV1(input)`, `validateKanjiInkEntryV2(input)`, `KANJI_INK_LIMITS`, `KANJI_INK_WIDTHS`.
- Produces: schema-4 mixed export/import, schema-3 legacy import, V1-only text search projection, version-aware SVG/Markdown rendering.

- [ ] **Step 1: Write RED entity tests**

Add literal fixtures proving that a V1 record with `legacyVendorField: { raw: "keep" }` round-trips unchanged, and that this exact V2 is accepted defensively:

```js
{
  id: "ink-v2",
  noteId: "note-1",
  strokes: [{
    tool: "pen",
    width: 0.008,
    points: [{ x: 0.1, y: 0.2, t: 0 }, { x: 0.2, y: 0.3, t: 12 }],
  }],
  paperStyle: "grid",
  createdAt: "2026-08-09T00:00:00.000Z",
  updatedAt: "2026-08-09T00:00:00.000Z",
  schemaVersion: 2,
}
```

Add literal rejection cases for wrong tool, unsupported width, decreasing/negative/over-600000 time, extra V2 keys, zero strokes, point/stroke/total/byte bounds, hostile getter, and caller mutation.

- [ ] **Step 2: Run entity RED**

Run:

```sh
node --test tests/unit/kanji-ink-entry.test.mjs
```

Expected: failures because schema 2 and V1 unknown-field preservation are not implemented.

- [ ] **Step 3: Implement the record union minimally**

Dispatch on `schemaVersion`. Validate required V1 historical fields without reconstructing the object; return a defensive clone preserving unknown own data fields. Validate V2 exact keys and clone exact tool/width/time points. Keep errors content-free as `KANJI_INK_ENTRY_INVALID` or `KANJI_INK_ENTRY_LIMIT`.

- [ ] **Step 4: Run entity GREEN**

Run the command from Step 2. Expected: all entity tests pass.

- [ ] **Step 5: Write RED projection/export tests**

Assert with literal mixed fixtures:

```js
assert.equal(buildKanjiSearchProjection([legacyV1, canvasV2]), "人");
assert.equal(createKanjiExportBundle([note], [legacyV1, canvasV2], { exportedAt }).schemaVersion, 4);
```

Assert V1 unknown fields survive schema-4 export/import, the old exact schema-3 bundle remains accepted, V2 SVG includes the grid and tool widths, and V2 Markdown contains `Kanji drawing` but no invented character or recognizer attribution.

- [ ] **Step 6: Run projection RED**

Run:

```sh
node --test tests/unit/kanji-ink-projection.test.mjs
```

Expected: failures because projection/export are recognition-only.

- [ ] **Step 7: Implement mixed projection/export minimally**

Emit schema 4 for new bundles; retain a separate strict schema-3 validator. Search only legacy `character`. Render grid and each persisted stroke's width/tool for V2; keep legacy output loss-aware.

- [ ] **Step 8: Run Task 1 GREEN and commit**

Run:

```sh
node --test tests/unit/kanji-ink-entry.test.mjs tests/unit/kanji-ink-projection.test.mjs
```

Commit: `feat(kanji): add lossless v1 and canvas v2 contracts`

### Task 2: Bounded canvas edit controller

**Files:**
- Modify: `core/kanjiInkController.js`
- Modify: `tests/unit/kanji-ink-controller.test.mjs`

**Interfaces:**
- Consumes: strict V2 creation/validation from Task 1.
- Produces: `createKanjiInkController({ persist, createId, now, initialEntry })` with `selectTool`, `beginGesture`, `appendGesture`, `endGesture`, `undo`, `redo`, `clear`, `requestClose`, `keepDrawing`, `discardDraft`, `save`, `retrySave`, and `snapshot`.

- [ ] **Step 1: Write RED controller tests**

Use literal points/times to prove Pen is default, Marker persists width `0.024`, Eraser removes intersecting strokes without persisting eraser events, Undo/Redo restore exact drafts, a new edit clears redo, Clear is undoable, history stops at 100 states, and an untouched V2 edit closes without discard.

Also assert:

```js
await assert.rejects(controller.save({ noteId: "note-1" }), { code: "KANJI_STROKES_REQUIRED" });
```

and prove failed persistence retains strokes/tool/history and retry saves one schema-2 entry before clearing dirty state.

- [ ] **Step 2: Run controller RED**

Run:

```sh
node --test tests/unit/kanji-ink-controller.test.mjs
```

Expected: failures because recognition/candidate APIs still own the controller.

- [ ] **Step 3: Implement minimal edit history and save state**

Use bounded immutable draft snapshots. Commit one history state per completed pen/marker/eraser gesture and one for Clear. Eraser hit-testing uses a fixed normalized radius and removes intersecting persisted strokes. Build V2 only at save; keep save single-flight and block mutation while pending.

- [ ] **Step 4: Run controller GREEN and commit**

Run the command from Step 2. Expected: all controller tests pass.

Commit: `feat(kanji): add bounded saved-grid editing`

### Task 3: Application, storage, import, and lifecycle union

**Files:**
- Modify: `core/kanjiInkApplication.js`
- Modify: `core/kanjiInkImport.js`
- Modify: `core/storage.js`
- Modify: `tests/unit/kanji-ink-application.test.mjs`
- Modify: `tests/integration/storage.kanji-ink.test.mjs`
- Modify: `tests/integration/storage.kanji-import.test.mjs`

**Interfaces:**
- Consumes: V1/V2 union, schema-4 bundle, controller from Tasks 1-2.
- Produces: recognizer-free V2 create/edit, read-only legacy edit refusal, mixed-record CRUD/list/delete/restore/import/export, and V1-only search projection.

- [ ] **Step 1: Write RED application/storage tests**

Prove `createEntryController(null)` persists V2 without recognizer metadata; a V2 edit keeps ID/createdAt and changes updatedAt; V1 controller creation returns a bounded `KANJI_LEGACY_ENTRY_READ_ONLY` error; mixed V1/V2 list/delete/note-delete/undo restore exact entries; and raw V1 unknown fields survive every lifecycle.

Add schema-4 import tests with mixed entries and retain the existing exact schema-3 import fixture.

- [ ] **Step 2: Run lifecycle RED**

Run:

```sh
node --test tests/unit/kanji-ink-application.test.mjs tests/integration/storage.kanji-ink.test.mjs tests/integration/storage.kanji-import.test.mjs
```

Expected: failures because application and import still inject recognition and selected rank.

- [ ] **Step 3: Implement recognizer-free lifecycle minimally**

Remove the recognizer dependency from application composition. Pass existing V2 records to the controller, reject V1 editing before opening a controller, preserve V1 clones through storage transactions, and allow exact schema-3 or schema-4 import without a database upgrade.

- [ ] **Step 4: Run lifecycle GREEN and commit**

Run the command from Step 2. Expected: all lifecycle tests pass.

Commit: `feat(kanji): persist mixed legacy and canvas entries`

### Task 4: Accepted Figma dialog and browser lifecycle

**Files:**
- Modify: `ui/kanjiInkView.js`
- Modify: `kanji-ink.css`
- Create: `assets/icons/kanji-close.svg`
- Create: `assets/icons/kanji-pen.svg`
- Create: `assets/icons/kanji-marker.svg`
- Create: `assets/icons/kanji-eraser.svg`
- Create: `assets/icons/kanji-undo.svg`
- Create: `assets/icons/kanji-redo.svg`
- Create: `assets/icons/kanji-clear.svg`
- Create: `assets/icons/kanji-save.svg`
- Modify: `tests/e2e/kanji-handwriting.spec.mjs`
- Modify: `tests/e2e/kanji-resource.spec.mjs`

**Interfaces:**
- Consumes: controller/application contracts from Tasks 2-3 and exact assets exported by Figma node `43:343`.
- Produces: accessible Pen/Marker/Eraser/Undo/Redo/Clear/Save UI, normalized timed pointer gestures, grid previews, read-only V1 cards, and deterministic focus return.

- [ ] **Step 1: Download exact Figma SVG assets**

Download the eight asset URLs returned by `get_design_context(43:343)` into the listed local files. Do not redraw or inline replacement glyphs. Verify every file is SVG and contains no script or remote reference.

- [ ] **Step 2: Write RED browser tests**

Replace recognition assertions with one real browser journey:

```text
open -> Pen draw -> Marker draw -> Eraser -> Undo -> Redo
-> save -> reload -> preview -> edit V2 -> delete/undo -> export
```

Assert Save is disabled when empty; no Recognize/candidate/selected-character surface exists; icon buttons have accessible names and tooltips; dirty close confirms discard; focus returns to the opener; pointercancel/lost capture do not leave an active gesture; resize/DPR preserves normalized geometry; V1 displays read-only and exports; 20 open/close cycles retain one dialog, stylesheet, and command.

- [ ] **Step 3: Run browser RED**

Run:

```sh
npx --no-install playwright test tests/e2e/kanji-handwriting.spec.mjs tests/e2e/kanji-resource.spec.mjs --project=chromium
```

Expected: failures on missing tool buttons/V2 behavior and obsolete recognition UI.

- [ ] **Step 4: Implement the accepted dialog minimally**

Match the Figma hierarchy using existing CSS variables: bounded 900x594 dialog, 860x430 grid canvas, 36px icon toolbar controls, Pen selected by default, 40px primary Save. Map pointer timestamps to per-stroke monotonic `t`; render Pen/Marker opacity/width and grid previews; keep actionable failures visible and healthy status compact.

- [ ] **Step 5: Run browser GREEN and viewport checks**

Run the command from Step 3, then run the same file at `1024x768`, `1280x720`, `1440x900`, and browser zoom 200% using the existing Playwright viewport helpers. Assert `document.documentElement.scrollWidth === document.documentElement.clientWidth` and logical focus return.

- [ ] **Step 6: Commit UI and browser evidence**

Commit: `feat(kanji): replace recognition dialog with saved grid canvas`

### Task 5: Remove dead recognizer runtime and reconcile issue-owned docs/tests

**Files:**
- Delete: `core/kanjiRecognizer.js`
- Delete: `tests/unit/kanji-recognizer.test.mjs`
- Delete: `tests/unit/kanji-recognizer-metrics.test.mjs`
- Modify: `package.json`
- Modify: `docs/architecture/KANJI_HANDWRITING.md`
- Modify: `docs/adr/2026-08-04-kanji-recognizer-source.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/INVARIANTS.md`

**Interfaces:**
- Consumes: verified absence of runtime recognizer consumers.
- Produces: current-tree docs for database v3, V1 compatibility, V2 saved-grid ownership, resource bounds, recovery, and rollback.

- [ ] **Step 1: Prove the recognizer has no runtime consumer**

Run:

```sh
rg -n "kanjiRecognizer|recognizeKanji|candidate|selectedCharacter|selectedRank" app.js core ui tests package.json
```

Expected: only explicit legacy fixtures/compatibility assertions remain; no runtime import/call remains.

- [ ] **Step 2: Remove dead runtime/tests and update the unit script**

Delete the recognizer module and recognition metric/unit tests only after Step 1. Retain legacy record fixtures in entity/storage/export tests.

- [ ] **Step 3: Reconcile issue-owned documentation**

Mark the old recognizer ADR superseded by the 2026-08-09 owner decision, document V1 preservation and V2 no-recognition ownership, correct database version/store facts, bounds, failure behavior, export/import versions, and rollback. Do not rewrite unrelated #90 presentation docs in this issue.

- [ ] **Step 4: Run focused package and commit**

Run:

```sh
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
```

Commit: `docs(kanji): reconcile saved-grid contracts`

### Task 6: Full verification and independent review

**Files:**
- Modify only files needed for validated P0/P1 findings.

**Interfaces:**
- Produces: fresh release-gate evidence and a review package from base `ce6436ef22433b6e6bcd8592534cf0851c475e00` to branch HEAD.

- [ ] **Step 1: Run the fresh full gate once**

Run exactly:

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

- [ ] **Step 2: Verify the acceptance matrix**

Check every #69 acceptance criterion against direct unit/integration/browser/Figma evidence. Record unsupported physical pen/OS combinations as `UNKNOWN — REQUIRES VALIDATION`.

- [ ] **Step 3: Dispatch an independent whole-branch reviewer**

Give the reviewer the full #69 body/comments, node `43:343`, base/head SHAs, review package, changed files, test output, architecture/invariants, and deferred findings. Require P0-P3 severity and explicit spec/data/focus/resource/test verdicts.

- [ ] **Step 4: Fix and re-review blockers once**

Use `superpowers:receiving-code-review`. Fix every validated P0/P1 and safe in-scope P2 through a separate implementer, rerun affected tests, then run one scoped re-review. Re-run the full gate if fixes are material.

- [ ] **Step 5: Prepare the PR and stop**

Push meaningful commits and open one draft PR with the required evidence headings. Do not merge. Report:

```text
ISSUE: #69
PR: <created PR URL>
STATUS: OWNER REVIEW REQUIRED
```

Then stop for explicit owner review.
