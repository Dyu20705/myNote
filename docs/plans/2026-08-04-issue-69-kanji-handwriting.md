# Issue #69 Kanji Handwriting MVP Implementation Plan

> Execute tasks in order. Every production change starts from a focused failing assertion and remains independently reviewable.

**Goal:** Deliver one real offline Kanji handwriting workflow that recognizes a disclosed bounded character set, requires explicit candidate confirmation, persists versioned vector entries under note-owned lifecycle, and remains recoverable under every failure state.

**Architecture:** Add a pure validated ink-entry model, a project-owned geometric recognizer, a persist-before-state controller, and an additive IndexedDB v3 store. Compose one modal UI through `app.js`, register commands through #74, expose summaries through the #68 supplementary Details slot, and keep vector strokes outside Markdown, AST, blocks, canonical search material, and note export text.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Pointer Events, Canvas 2D, IndexedDB v3, Node.js 22.20.0, npm 11.7.0, Playwright 1.62.0.

## Global Constraints

- Base exactly on `main@7c3967082cba422cbeea2ddca4d1cd9462de393c`.
- Implement only #69 on `ux/69-kanji-handwriting`.
- Preserve `UI → Actions → State → Core → Persistence` and the #74 single command owner.
- Preserve #68 editor/list ownership; extend only the documented supplementary placement.
- Add no runtime network request, third-party recognizer, model, font, framework, canvas library, schema downgrade, or base64 image persistence.
- Recognizer support is exactly `人 入 八 大 犬 火 木 本` for M2 and must be disclosed in UI/docs.
- Candidate count is at most eight; no candidate is auto-selected or auto-saved.
- Drawing is stored only as bounded normalized vector strokes.
- Persist succeeds before application state, search projection, history, and UI report success.
- Dirty close requires explicit confirmation; clean cancel preserves the selected note without prompt.
- Physical Windows mouse certification remains a #73 release gate unless evidence is produced there.

---

## File Structure

- Create `core/kanjiInkEntry.js`: versioned entry validation, defensive cloning, bounds, import/export validation.
- Create `core/kanjiRecognizer.js`: local templates, normalization, deterministic scoring, metrics, no network.
- Create `core/kanjiInkController.js`: draft state machine, request tokens, stale suppression, save/edit/delete recovery.
- Modify `core/storage.js`: additive DB v3 store and atomic note/review/ink lifecycle helpers.
- Modify `core/searchClient.js` and `core/search.worker.js`: derived confirmed-character projection only.
- Modify `app.js`: state bootstrap, atomic delete/restore capture, augmented search/export, one Kanji app composition.
- Create `kanjiApp.js`: dialog/pointer/canvas UI adapter and command registration.
- Modify `index.html`: Kanji dialog, discard confirmation, error/retry, compact summary host.
- Create `kanji.css`; extend static-server allowlist/tests.
- Add unit, integration, browser, performance, and zero-network tests.
- Create `docs/KANJI_HANDWRITING_CONTRACT.md` and update README/export docs.

## Task 1: Intentional RED — entry, recognizer, controller

- [ ] Add unit tests for entry shape/version, Unicode character, normalized finite points, 32-stroke/256-point/4096-total bounds, hostile getters/prototypes, defensive cloning, invalid isolation, import/export validation, and exact round-trip.
- [ ] Add recognizer fixtures for all eight supported characters, related distractors, stable ordering, max-eight, malformed input, no-result threshold, latency, payload size, and zero network dependency.
- [ ] Add controller tests for stroke capture, Undo, Clear, recognition loading/error/retry, request-token stale suppression, explicit selection, stale selection invalidation, dirty-close confirmation, save/edit/delete/undo, and focus-return intent.
- [ ] Register suites and verify RED is caused only by absent modules.

## Task 2: GREEN — pure model and recognizer

- [ ] Implement `validateKanjiInkEntry`, `createKanjiInkEntry`, `serializeKanjiInkEntry`, `validateKanjiImportBundle`, and exported literal limits.
- [ ] Implement normalized templates, resampling, geometry features, deterministic scoring, confidence threshold, max-eight output, recognizer identity, and metrics.
- [ ] Prove all focused model/recognizer tests GREEN before storage or DOM changes.

## Task 3: GREEN — controller state machine

- [ ] Implement immutable snapshots with statuses `idle`, `drawing`, `recognizing`, `candidates`, `selected`, `error`, `confirm-discard`, and `saving`.
- [ ] Keep one monotonic recognition token; ignore every stale resolution or rejection.
- [ ] Invalidate candidates/selection on any stroke mutation.
- [ ] Require explicit selected candidate before save.
- [ ] Call injected persistence before commit; preserve draft and expose retry on failure.
- [ ] Return deterministic focus targets without querying DOM.
- [ ] Prove controller tests GREEN.

## Task 4: IndexedDB v3 and note-owned lifecycle

- [ ] Create `kanjiInkEntries` with key `id`, indexes `noteId` and `updatedAt` during v2→v3 upgrade without rewriting notes/reviews.
- [ ] Add validated list/get/add/update/delete functions.
- [ ] Add atomic note+review+ink delete capture and exact restore helpers.
- [ ] Isolate invalid stored entries into diagnostics while valid notes continue to load.
- [ ] Add integration tests for v1/v2→v3 exact preservation, CRUD, duplicate conflict, abort, cascade delete, undo restore, invalid isolation, and no orphan creation.

## Task 5: Search and export projections

- [ ] Add an ephemeral `supplementalSearchText` worker payload built from confirmed characters only.
- [ ] Never write strokes, SVG, or base64 into note content, AST, blocks, checksum, or canonical `searchBlob`.
- [ ] Re-index only affected notes after ink entry mutation.
- [ ] JSON export uses a versioned bundle containing complete entries.
- [ ] Markdown export includes confirmed characters plus deterministic inline SVG generated from vector strokes.
- [ ] Validate imported bundles without committing invalid entries; preserve previous valid records.

## Task 6: Figma-aligned modal and supplementary summary

- [ ] Compose one 720px exclusive-focus dialog with 300×300 canvas, max-eight candidate row, Undo stroke, Clear, Recognize, selected preview, Cancel, and Save to note.
- [ ] Implement pointer capture, local coordinate normalization, resize-safe redraw, mouse/pen/touch support, and no global gesture leakage.
- [ ] Render loading, empty, error/retry, selected, stale-selection, saving, and dirty-discard confirmation states.
- [ ] Trap focus, close with Escape only through clean-cancel/confirmation rules, and restore focus to the invoking control.
- [ ] Add a compact bounded summary in Details and complete entry list with View/Edit/Delete actions.
- [ ] Register `kanji.add-handwriting` and contextual edit/delete commands through #74; no permanent unrelated shell clutter.

## Task 7: Recovery, performance, and cross-platform automation

- [ ] Use command-stack closures for saved-entry delete and exact restore.
- [ ] Verify note deletion captures/restores associated entries atomically for ordinary and Japanese notes.
- [ ] Add browser tests for cancel, dirty discard, stale recognition, recognition retry, save failure retry, edit, delete undo, focus return, IME/modal isolation, rapid note/workspace switching, resize, 200% zoom proxy, and no horizontal overflow.
- [ ] Add a focused Windows GitHub Actions job for mouse pointer drawing, modal focus, and resize persistence; record physical manual Windows validation as outstanding for #73.
- [ ] Enforce budgets: template payload ≤64 KiB, initialization ≤50 ms in Node fixture, canonical recognition fixture p95 ≤50 ms, entry serialized size ≤256 KiB.

## Task 8: Documentation, self-review, and merge gate

- [ ] Document model, lifecycle sequence, recognizer identity/coverage, provenance ADR, storage v3, search/export boundary, states, commands, failure recovery, performance results, Windows automation, manual limits, and rollback.
- [ ] Run full Linux CI, focused Windows CI, static server/security contract, and `git diff --check`.
- [ ] Self-review for direct UI persistence, stale tokens, auto-selection, vector leakage, invalid-entry blockage, non-atomic delete, hidden destructive actions, focus loss, network access, unsupported claims, and #70/#71/#72 scope creep.
- [ ] Merge only after final-head CI is green, no unresolved P0/P1 blocker remains, and all non-manual acceptance evidence is recorded.
