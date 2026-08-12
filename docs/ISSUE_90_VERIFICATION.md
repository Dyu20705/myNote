# Issue #90 Verification Record

Date: 2026-08-12

Base revision: `be84fc89180b3874506e7c87aa8339a5c187cab8`

Branch: `UX/90` (local worktree branch `ux/90`)

Pull request: `#92`

## Scope verified

- Notes and Japanese Notes render board-first while preserving the upstream search/workspace order through presentation-only `PINNED` and `NOTES` sections.
- Ordinary create, Japanese quick create, card selection, editor focus, and recovery routes use one centered native-dialog editor overlay.
- Overlay close flushes before dismissal and preserves query, board scroll, draft, active note, and deterministic logical focus return.
- Japanese Filter A applies All, Vocabulary, Grammar, and Kanji immediately; Reading remains explicitly unavailable until its canonical model exists; `+ Filter` retains the complete date/type controls and removable chips.
- `Review N` starts or resumes the existing review dialog directly; `Study details` remains optional derived information.
- Valid #69 drawings project directly above title/body, collapse at zero, show one newest entry by default, disclose older entries in bounded windows, and retain direct Edit/Delete/retry behavior without copying vectors into canonical notes.
- Daily guidance moved to `docs/cheatsheet.md`; command IDs, persistence owners, search ranking, scheduling, review state, and IndexedDB schemas are unchanged.

## TDD and focused evidence

The board projection, editor overlay, Japanese filter/review, and drawing projection were introduced through focused RED-to-GREEN slices before the full gate. The final focused drawing regression covered 29 tests, and the overlay/editor/visual subset covered 30 tests. The drawing resource run retained bounded validation, context-load, observer, and 64-entry expanded-window evidence.

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
| `npm run test:unit` | PASS; 227/227 |
| `npm run test:integration` | PASS; 59/59 |
| `npm run test:e2e` | PASS; 89/89 |
| `git diff --check` | PASS |

The final E2E run recorded these #69 resource samples:

- maximum-shape codec/validation: `89.7`, `99.4`, `82.2`, `75.9`, and `80.3 ms`, each below the `1,000 ms` tripwire;
- note-context synchronization: `11.5` and `8.1 ms`, each below the `2,000 ms` tripwire;
- expanded 64-preview render: `193 ms`, below the `5,000 ms` tripwire.

## Viewport and interaction evidence

Automated Chromium coverage passed at `1024×768`, `1280×720`, and `1440×900` with desktop keyboard/mouse semantics, logical focus return, long English/Japanese/mixed/code content, reduced motion, and no horizontal document overflow. A `720×450` CSS viewport also passed as equivalent narrow responsive-layout evidence.

Native browser 200% zoom is `UNKNOWN — REQUIRES MANUAL VALIDATION`. The available in-app browser reported device-pixel ratio `1.5`, inner viewport `1280×720`, outer viewport `1280×800`, and visual scale `1`; its zoom shortcuts did not change those metrics. The `720×450` automated case is not being promoted to native-zoom evidence. Physical pen input, OS-level 200% display scaling, and untested assistive-technology/browser combinations remain unknown for the same reason.

## Publication and review boundary

The implementation is prepared for one consolidated branch push to the existing draft PR #92. The PR must remain unmerged, and issue #90 must remain open, until current-head CI is green and the explicit native 200% manual acceptance item is either recorded or dispositioned by the issue owner. No downstream issue is included in this rollback boundary.
