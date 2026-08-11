# myNote Architecture Baseline

This document defines the required architecture for the current application. Changes that violate these boundaries require an explicit architecture decision and matching tests.

## 1. System baseline

myNote currently contains these core capabilities:

- **Persistence:** IndexedDB schema v3 with bounded legacy localStorage migration and additive `studyReviews` / `kanjiInkEntries` stores.
- **Study metadata:** isolated `studyReviews` records linked to notes only by `noteId`.
- **Japanese study templates:** deterministic note seeds, reserved tags, and enrolled-note duplicate lookup.
- **Study scheduling:** pure caller-clocked review creation, due checks, and rating transitions.
- **Kanji supplementary data:** mixed legacy-V1 and saved-grid-V2 vector entries with no runtime recognition path.
- **Canonical model:** versioned notes with checksums, blocks, tags, links, AST data, and search material.
- **Parser pipeline:** `parseDocument` and related parser functions own derived note metadata.
- **Search:** worker-based querying with incremental index updates and bounded result policies.
- **Workspace coordination:** explicit note-workspace and Japanese-workspace application services.
- **Backlinks:** an incrementally maintained reverse-link index.
- **History:** command-stack undo/redo and patch-based retained history.
- **Rendering:** a virtualized note list.
- **Observability:** bounded runtime metrics surfaced in the UI.
- **Verification:** deterministic unit, integration, contract, and browser tests.

## 2. Required dependency direction

```text
Browser composition and UI adapters
→ application controllers and actions
→ state and core services
→ persistence
```

- `app.js` is the only browser composition entrypoint.
- Browser adapters emit intents and render state; they do not coordinate through synthetic DOM events, element discovery, or programmatic clicks.
- Application controllers own multi-step query, selection, workspace-switch, and refresh workflows.
- Actions are the mutation entry point for canonical writes.
- State transitions are explicit, deterministic, and observable.
- Core services own parsing, indexing, backlinks, autosave, patches, history, Japanese templates, study scheduling, and study-review validation.
- Persistence is called only through action/effect or core lifecycle boundaries.
- Pure template and scheduler modules may be called during action preparation, but they never call persistence, state, or UI code themselves.

## 3. Module ownership

### `app.js`

- Is the single browser composition root.
- Creates the shared store, command stack, history, search client, backlink index, autosave, lifecycle, and workspace controller.
- Injects the shared runtime into `createJapaneseApp`.
- Binds generic Notes DOM events and rendering adapters.
- Does not coordinate Japanese workflows through active-singleton getters or DOM bridges.

### `core/noteWorkspaceController.js`

- Owns text-query refresh, stale-result suppression, active-note selection, keyboard movement, and boundary jumps.
- Flushes an editor draft before an active-note transition.
- Requeries after a flush only when the injected flush boundary reports a canonical mutation.
- Reports render intent explicitly so same-note search refreshes cannot overwrite an in-progress editor draft.
- Depends only on injected state, query, flush, metrics, and render functions; it has no DOM, persistence, or worker construction dependency.

### `core/japaneseWorkspaceCoordinator.js`

- Owns Japanese initialization, per-workspace query and active-note snapshots, workspace switching, quick-create refresh, enrolled deletion refresh, and Japanese slice synchronization.
- Calls the injected note-workspace API directly; it never dispatches synthetic input events, observes list mutations, queries rendered note items, or clicks list controls.
- Owns bounded recovery for invalid persisted review data and resolves initialization into a read-only Japanese state.
- Has no DOM dependency and does not open IndexedDB directly.

### `japaneseApp.js`

- Exports `createJapaneseApp({ runtime, document })` as an injected browser adapter.
- Creates Japanese lifecycle persistence adapters and registers the Japanese search-result policy.
- Binds the Japanese Notes/Review presentation, filter disclosure, registry-backed quick-create action group, dashboard, and review controls to coordinator/action APIs.
- Renders state but does not own workspace refresh sequencing.
- Does not retrieve active runtime singletons or create a second store, command stack, search worker, history, or backlink index.

### `core/parser/`

- Parses Markdown-oriented content, tags, wiki links, code blocks, and tokens.
- Produces deterministic derived metadata.
- Remains the only metadata extraction authority.

### `core/search.worker.js` and `core/searchClient.js`

- Validate worker messages and bound payload sizes.
- Maintain incremental upsert/remove indexing.
- Execute asynchronous search and ranking away from the main thread.
- Apply registered result policies after worker ranking without allowing consumers to replace `query`.

### `core/backlinks.js`

- Maintains reverse note relationships incrementally.
- Has no UI dependency.

### `core/storage.js`

- Owns IndexedDB schema v3, transactions, migration, and database I/O.
- Preserves `notes`; the v2 branch adds `studyReviews` and the v3 branch adds `kanjiInkEntries` without scanning or rewriting existing records.
- Owns atomic cross-store note/review/handwriting-dependent mutations and terminal transaction settlement.
- Rejects a blocked schema upgrade deterministically and closes connections on version changes.
- Never mutates UI or application state directly.

### `core/studyReview.js`

- Owns the exact persisted study-review shape, enums, validation, and defensive copies.
- Rejects malformed or unsafe metadata with bounded content-free errors.
- Does not own note content, scheduling behavior, application state, or UI lifecycle.

### `core/japaneseTemplates.js`

- Owns deterministic Japanese template seeds, reserved-template tags, and enrolled duplicate lookup.
- Exposes the persisted notebook-type enum, reserved-tag lookup, exact template creation, and duplicate lookup for output and planner notes.
- Reuses the canonical `extractTags` parser boundary and `validateStudyReview` persistence boundary; it does not duplicate tag parsing or review-schema rules.
- Duplicate lookup requires an existing note, a valid matching review, an exact template title, and the canonical reserved tag before it returns the lexicographically smallest matching note ID.
- Does not persist notes or reviews, orchestrate parsing, mutate caller data, schedule reviews, access application state or the DOM, use a clock, or perform network I/O.

### `core/studyScheduler.js`

- Owns pure, caller-clocked initial-review, due-check, and rating-transition calculations.
- Reuses `validateStudyReview` as the canonical persisted review-shape and timestamp boundary.
- Compares timestamps by instant, adds exact 24-hour day intervals, preserves caller timestamp spelling where required, and emits computed review times in UTC.
- Rejects suspended rating, unsafe interval arithmetic, and computed timestamps outside the persisted four-digit-year contract.
- Does not persist reviews, orchestrate parsing, mutate caller data, access application state or the DOM, use an ambient clock, or perform network I/O.

### Kanji saved-grid modules

- `core/kanjiInkEntry.js` owns the persisted V1/V2 union, strict saved-grid shape, lossless clone-safe V1 compatibility, and resource bounds.
- `core/kanjiInkController.js` owns Pen/Marker/Eraser interaction, normalized geometry, at most 100 committed Undo/Redo states, dirty/discard behavior, and single-flight save/retry.
- `core/kanjiInkApplication.js` owns database-handle lifetime and composes CRUD, note context, search projection, and export/import without injecting or calling a recognizer.
- `core/kanjiInkProjection.js` projects only confirmed legacy V1 characters into search, emits schema-4 mixed exports, accepts exact historical schema-3 V1 exports, and renders vector-backed SVG without inventing V2 Unicode.
- `ui/kanjiInkView.js` adapts pointer coordinates/times and renders the accepted node `43:343`; it does not open IndexedDB or own canonical drawing state.

### `core/commandStack.js`, `core/notePatch.js`, and `core/history.js`

- Execute, undo, and redo within explicit command boundaries.
- Preserve bounded, reversible patch/history behavior.

### `ui/`

- Owns rendering and local interaction behavior only.
- Command providers own their own availability rules.
- Does not parse canonical metadata, call storage directly, retrieve active application singletons, or trigger workspace refresh through synthetic DOM events.

## 4. Query and workspace refresh lifecycle

```text
UI intent
→ NoteWorkspaceController.refresh(...)
→ worker-backed search query
→ registered result policies
→ optional draft flush before active-note transition
→ optional requery after canonical mutation
→ state commit
→ render intent
```

A same-active-note refresh updates the search field, list, counts, and metrics without rewriting editor fields. An active-note transition flushes the current draft first. Derived-index refresh is suppressed while that flush is nested inside a controller refresh; the controller performs the authoritative post-flush query instead.

Japanese switching uses the same lifecycle:

```text
workspace control
→ JapaneseWorkspaceCoordinator.switchWorkspace(...)
→ restore workspace query and preferred active note
→ NoteWorkspaceController.refresh(...)
→ shared state and list render
```

The coordinator never treats rendered DOM as application state.

## 5. Mutation lifecycle

```text
UI event
→ action validation
→ normalized mutation preparation
→ canonical persistence
→ canonical in-memory commit
→ derived index/backlink update
→ history success
→ incremental render and metrics update
```

Canonical persistence failure stops the mutation before in-memory state and history report success. Derived index failure after canonical persistence is treated as a visible, rebuildable degradation.

The schema-v2 study persistence branch adds no automatic scheduler, parser behavior, state transition, enrollment, or UI. Any operation that changes both a note and its review uses one cross-store transaction. Existing notes remain byte-for-byte untouched during the v1-to-v2 upgrade.

The schema-v3 branch adds only `kanjiInkEntries`. Kanji create/update validates the note relationship before writing. Note deletion and restore include valid handwriting dependents in the same atomic transaction as the note and optional review. No database upgrade is required to store saved-grid V2 records in the existing v3 store.

The template and scheduler modules in the current package are preparation boundaries only. They return values to their caller; a later action is responsible for normalization, canonical persistence, state commit, and derived updates.

## 6. Japanese study core flows

### Template creation

```text
explicit notebook type + exact options
→ bounded option validation
→ exact deterministic template seed
→ fresh { title, content }
```

Output templates require an explicit real calendar date. Planner templates require an explicit real ISO week. Static templates accept only an empty plain options object. No locale, timezone, or ambient date is consulted.

### Enrolled duplicate lookup

```text
notes snapshot + reviews snapshot + explicit date/week
→ exact query-boundary validation
→ exact title candidate set
→ canonical parser tag extraction
→ canonical study-review validation
→ lexicographically smallest matching noteId or undefined
```

A reserved tag alone never proves enrollment. Tags inside fenced code are excluded because lookup uses the canonical parser. Invalid notes or review records are ignored as candidates; a malformed top-level query rejects with a fresh content-free template error.

### Review scheduling

```text
validated review + rating + explicit nowIso
→ deterministic transition formula
→ exact instant arithmetic
→ canonical persisted-review validation
→ fresh review record
```

`createInitialReview` preserves the supplied timestamp spelling as `nextReviewAt`. Rating preserves it as `lastReviewedAt`; computed `nextReviewAt` values are UTC and retain supplied fractional-second precision. `isDue` compares instants rather than string spellings. No scheduler function reads the system clock.

### Complexity and retained state

| Operation | Time | Retained state |
|---|---:|---:|
| Template creation or reserved-tag lookup | O(1) | None |
| Enrolled duplicate lookup | O(notes + reviews) | One bounded call-local set |
| Initial review, due check, or rating transition | O(1) for bounded timestamp records | None |
| Workspace refresh | O(search results) after worker query | One request-local ID array |
| Japanese slice synchronization | O(notes + reviews) | Bounded derived state |

## 7. Kanji saved-grid flow

```text
pointer intent
→ bounded normalized Pen/Marker draft or Eraser mutation
→ Undo/Redo/Clear and strict V2 validation
→ canonical IndexedDB add/put
→ saved baseline and success presentation
```

V2 has the exact fields `id`, `noteId`, `strokes`, `paperStyle`, `createdAt`, `updatedAt`, and `schemaVersion`. Each persisted stroke has `tool`, canonical tool `width`, and `{ x, y, t }` points; `paperStyle` is exactly `grid`. It contains no character, recognizer, candidates, image/base64 data, parser metadata, or Markdown vector payload.

Legacy V1 remains readable, renderable, searchable by its confirmed character, deletable/restorable, and losslessly exportable/importable. Cloneable unknown V1 own fields survive those lifecycles. V1 is read-only in the V2 editor and is never upgraded on read.

Bounds are 32 strokes, 256 points per stroke, 4,096 total points, 600,000 ms per stroke, 262,144 serialized bytes per entry, and 100 committed draft-history states. Failed persistence retains the exact draft, tool, history, and retry intent. Search projects only V1 characters. New structured exports use schema 4 for mixed records; exact historical schema-3 V1 bundles remain importable.

## 8. Failure, compatibility, and rollback

- Schema v3 is forward-only and additive.
- A client requesting an older version cannot open a database already upgraded to v3.
- Rollback must deploy code that understands schema v3; it must not delete `studyReviews` or `kanjiInkEntries`, rewrite either V1 or V2 records, rewrite notes, or attempt an automatic downgrade.
- A blocked upgrade rejects with `DATABASE_UPGRADE_BLOCKED`; the user can close other tabs and retry without data mutation.
- Invalid persisted study reviews produce bounded `study-data-unavailable` state. Japanese quick-create and review actions remain disabled while ordinary Notes stays operational.
- Workspace-controller rollback is code-only: restore the prior composition, controller/coordinator modules, tests, and documentation. It performs no migration or data rewrite.
- Template and scheduler rollback is code-only: revert their modules, tests, and documentation. They perform no migration and leave stored notes and reviews unchanged.
- Kanji rollback is code-only. A rollback client may render V2 as unsupported preserved data, but it must retain both record versions and never claim success before persistence completes.

## 9. Change gate

Every material change must answer:

1. Does it preserve the required dependency direction?
2. Does it avoid using rendered DOM as an application coordination channel?
3. Does it avoid duplicate parsing or metadata ownership?
4. Does it keep canonical persistence ahead of in-memory/history success?
5. Does it avoid unbounded memory, cache, history, listener, or policy growth?
6. Does it keep heavy parsing and indexing off the main thread where required?
7. Are transaction, failure, recovery, and rollback boundaries explicit?
8. Does a schema upgrade preserve existing note records and avoid automatic enrollment?
9. Do paired note/review mutations use one cross-store transaction with terminal rollback?
10. Are template and scheduler calculations explicit, caller-clocked, immutable, and independent of persistence/UI?
11. Do application-created errors remain bounded and content-free while invalid persisted reviews retain their canonical provenance?
12. Do tests cover the changed invariant, including asynchronous stale-result and draft-preservation behavior?
13. Do Kanji changes preserve V1 losslessly, keep V2 recognizer-free, and avoid inventing searchable Unicode?
