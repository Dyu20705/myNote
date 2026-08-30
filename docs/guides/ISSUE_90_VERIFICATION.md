# Issue #90 Verification Record

Date: 2026-08-12

Base revision: `be84fc89180b3874506e7c87aa8339a5c187cab8`

Branch: `UX/90` (local worktree branch `ux/90`)

Pull request: `#92`

## Scope verified

- Notes and Japanese Notes render board-first while preserving the upstream search/workspace order through presentation-only `PINNED` and `NOTES` sections.
- Ordinary create, Japanese quick create, card selection, editor focus, and recovery routes use one centered native-dialog editor overlay.
- Overlay close flushes before dismissal and preserves query, board scroll, draft, active note, and deterministic logical focus return.
- Japanese Filter A applies All, Vocabulary, Grammar, and Kanji immediately through `resolveJapaneseCommonFilter()`; Reading remains explicitly unavailable until its canonical model exists; `+ Filter` retains the complete date/type controls and removable chips.
- `Review N` starts or resumes the existing review dialog directly; `Study details` remains optional derived information.
- Valid #69 drawings project directly above title/body, collapse at zero, show one newest entry by default, disclose older entries in bounded windows, and retain direct Edit/Delete/retry behavior without copying vectors into canonical notes.
- Daily guidance moved to `docs/cheatsheet.md`; command IDs, persistence owners, search ranking, scheduling, review state, and IndexedDB schemas are unchanged.

## Owner and design reconciliation

- Issue #90 explicitly keeps Reading visible but disabled in M2 with the exact reason `Reading filters require the Japanese V2 learning model`. It forbids aliasing Reading to another type or inferring a UI-local predicate.
- Accepted Figma board `126:344` matches that decision: `Filter / Reading / Disabled` retains the original Filter A position and uses the accepted disabled surface, text, and border variables with a dashed border and `0.55` opacity.
- All, Vocabulary, Grammar, and Kanji remain the only enabled common controls. The resolver accepts `all` and every existing canonical M2 notebook type while rejecting Reading and unknown values without mutating `JapaneseNoteFilter`.
- Native browser 200% zoom is owned by issue #71. It is not claimed as verified by this package and is not an issue #90 merge blocker after the owner disposition.

## TDD and focused evidence

The board projection, editor overlay, Japanese filter/review, and drawing projection were introduced through focused RED-to-GREEN slices before the full gate. The final filter-capability slice recorded the expected missing-export RED, then passed 8/8 focused unit tests and 11/11 focused Chromium tests after integration. Independent review required and verified explicit coverage for every canonical M2 notebook type and Reading non-mutation. The final focused drawing regression covered 29 tests, and the overlay/editor/visual subset covered 30 tests. The drawing resource run retained bounded validation, context-load, observer, and 64-entry expanded-window evidence.

Direct drawing coverage includes:

- zero, one, and multiple saved drawings;
- immediate save projection, close/reopen, and reload;
- ordinary/Japanese parity;
- title/body reachability and no horizontal document overflow at all required desktop viewports;
- save and delete transaction failure with canonical-data retention and explicit recovery state;
- vector-free note title/content/tags/AST ownership;
- legacy V1 read-only visibility and V2 edit/delete/undo behavior.

## Complete automated release gate

All required commands completed successfully from the isolated issue #90 worktree:

| Command | Result |
| --- | --- |
| `npm ci` | PASS; 73 packages installed, npm reported one existing high-severity audit advisory |
| `npx --no-install playwright install --with-deps chromium` | PASS |
| `npm run test:content` | PASS; 3/3 |
| `npm run lint` | PASS |
| `npm run test:unit` | PASS; 229/229 |
| `npm run test:integration` | PASS; 59/59 |
| `npm run test:e2e` | PASS; 89/89 |
| `git diff --check` | PASS |

The final E2E run recorded these #69 resource samples:

- maximum-shape codec/validation: `105.4`, `104.6`, `87.9`, `93.3`, and `105.8 ms`, each below the `1,000 ms` tripwire;
- note-context synchronization: `4.9` and `5.0 ms`, each below the `2,000 ms` tripwire;
- expanded 64-preview render: `175 ms`, below the `5,000 ms` tripwire.

## Viewport and interaction evidence

Automated Chromium coverage passed at `1024×768`, `1280×720`, and `1440×900` with desktop keyboard/mouse semantics, logical focus return, long English/Japanese/mixed/code content, reduced motion, and no horizontal document overflow. A `720×450` CSS viewport also passed as equivalent narrow responsive-layout evidence.

Native browser 200% zoom remains `UNKNOWN — REQUIRES MANUAL VALIDATION` in this environment. The available in-app browser reported device-pixel ratio `1.5`, inner viewport `1280×720`, outer viewport `1280×800`, and visual scale `1`; its zoom shortcuts did not change those metrics. The `720×450` automated case is not being promoted to native-zoom evidence. The issue owner assigned native browser 200% zoom acceptance to #71, so this explicit unknown is not an issue #90 merge blocker. Physical pen input, OS-level 200% display scaling, and untested assistive-technology/browser combinations remain unknown for the same reason.

## Publication and review boundary

The owner authorized two coordinated pushes to the existing `UX/90` branch and sole draft PR #92. Push 1 published the reviewed runtime/test capability at `181471179818d18834fefa8d91d0f0bb5feed6e0`. Push 2 contains the authority, design-handoff, historical-plan, and refreshed verification records after the complete local gate. A third push requires new owner authority.

The PR remains draft and unmerged until current-head CI and fresh review are available. Issue #90 remains open until the accepted package is merged and green. No downstream issue is included in this rollback boundary.
