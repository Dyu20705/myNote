# myNote Architecture Baseline

This document defines the required architecture for the current application. Changes that violate these boundaries require an explicit architecture decision and matching tests.

## 1. System baseline

myNote currently contains these core capabilities:

- **Persistence:** IndexedDB schema v2 with a bounded legacy localStorage migration.
- **Study metadata:** isolated `studyReviews` records linked to notes only by `noteId`.
- **Japanese study templates:** deterministic note seeds, reserved tags, and enrolled-note duplicate lookup.
- **Study scheduling:** pure caller-clocked review creation, due checks, and rating transitions.
- **Canonical model:** versioned notes with checksums, blocks, tags, links, AST data, and search material.
- **Parser pipeline:** `parseDocument` and related parser functions own derived note metadata.
- **Search:** worker-based querying with incremental index updates.
- **Backlinks:** an incrementally maintained reverse-link index.
- **History:** command-stack undo/redo and patch-based retained history.
- **Rendering:** a virtualized note list.
- **Observability:** bounded runtime metrics surfaced in the UI.
- **Verification:** deterministic unit, integration, contract, and browser tests.

## 2. Required dependency direction

```text
UI → Actions → State → Core services → Persistence
```

- UI modules emit events and render state; they do not access persistence directly.
- Actions are the application entry point for canonical mutations.
- State transitions are explicit, deterministic, and observable.
- Core services own parsing, indexing, backlinks, autosave, patches, history, Japanese templates, study scheduling, and study-review validation.
- Persistence is called only through action/effect or core lifecycle boundaries.
- Pure template and scheduler modules may be called during action preparation, but they never call persistence, state, or UI code themselves.

## 3. Module ownership

### `app.js`

- Bootstraps dependencies and application state.
- Routes UI events to actions.
- Coordinates effects without reimplementing parser, search, or storage logic.

### `core/parser/`

- Parses Markdown-oriented content, tags, wiki links, code blocks, and tokens.
- Produces deterministic derived metadata.
- Remains the only metadata extraction authority.

### `core/search.worker.js` and `core/searchClient.js`

- Validate worker messages and bound payload sizes.
- Maintain incremental upsert/remove indexing.
- Execute asynchronous search and ranking away from the main thread.

### `core/backlinks.js`

- Maintains reverse note relationships incrementally.
- Has no UI dependency.

### `core/storage.js`

- Owns IndexedDB schema v2, transactions, migration, and database I/O.
- Preserves the existing `notes` store and adds `studyReviews` without scanning or rewriting notes.
- Owns atomic cross-store note/review mutations and terminal transaction settlement.
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

### `core/commandStack.js`, `core/notePatch.js`, and `core/history.js`

- Execute, undo, and redo within explicit command boundaries.
- Preserve bounded, reversible patch/history behavior.

### `ui/`

- Owns rendering and interaction behavior only.
- Does not parse canonical metadata or call storage directly.

## 4. Mutation lifecycle

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

The schema-v2 persistence package adds no automatic scheduler, parser behavior, state transition, enrollment, or UI. Any operation that changes both a note and its review uses one cross-store transaction. Existing notes remain byte-for-byte untouched during the v1-to-v2 upgrade.

The template and scheduler modules in the current package are preparation boundaries only. They return values to their caller; a later action is responsible for normalization, canonical persistence, state commit, and derived updates.

## 5. Japanese study core flows

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

## 6. Compatibility and rollback

- Schema v2 is forward-only and additive.
- A v1 client cannot open a database already upgraded to v2 by requesting version 1.
- Rollback must deploy code that understands schema v2; it must not delete `studyReviews`, rewrite notes, or attempt an automatic downgrade.
- A blocked upgrade rejects with `DATABASE_UPGRADE_BLOCKED`; the user can close other tabs and retry without data mutation.
- Template and scheduler rollback is code-only: revert their modules, tests, and documentation. They perform no migration and leave stored notes and reviews unchanged.

## 7. Change gate

Every material change must answer:

1. Does it preserve the required dependency direction?
2. Does it avoid duplicate parsing or metadata ownership?
3. Does it keep canonical persistence ahead of in-memory/history success?
4. Does it avoid unbounded memory, cache, history, or listener growth?
5. Does it keep heavy parsing and indexing off the main thread where required?
6. Are transaction, failure, recovery, and rollback boundaries explicit?
7. Does a schema upgrade preserve existing note records and avoid automatic enrollment?
8. Do paired note/review mutations use one cross-store transaction with terminal rollback?
9. Are template and scheduler calculations explicit, caller-clocked, immutable, and independent of persistence/UI?
10. Do application-created errors remain bounded and content-free while invalid persisted reviews retain their canonical provenance?
11. Do tests cover the changed invariant?