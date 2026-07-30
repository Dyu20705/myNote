# myNote Architecture Baseline

This document defines the required architecture for the current application. Changes that violate these boundaries require an explicit architecture decision and matching tests.

## 1. System baseline

myNote currently contains these core capabilities:

- **Persistence:** IndexedDB schema v2 with a bounded legacy localStorage migration.
- **Study metadata:** isolated `studyReviews` records linked to notes only by `noteId`.
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
- Core services own parsing, indexing, backlinks, autosave, patches, history, and study-review validation.
- Persistence is called only through action/effect or core lifecycle boundaries.

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
- Reuses the canonical `extractTags` parser boundary and `validateStudyReview` persistence boundary; it does not duplicate tag parsing or review-schema rules.
- Duplicate lookup requires an existing note, a valid matching review, an exact template title, and the canonical reserved tag before it returns the lexicographically smallest matching note ID.
- Does not persist notes or reviews, orchestrate parsing, mutate caller data, schedule reviews, access application state or the DOM, use a clock, or perform network I/O.

### `core/studyScheduler.js`

- Owns pure, caller-clocked initial-review, due-check, and rating-transition calculations.
- Reuses `validateStudyReview` as the canonical persisted review-shape and timestamp boundary.
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

Study-review persistence in this work package adds no scheduler, parser behavior, state transition, automatic enrollment, or UI. Any operation that changes both a note and its review uses one cross-store transaction. Existing notes remain byte-for-byte untouched during the v1-to-v2 upgrade.

## 5. Compatibility and rollback

- Schema v2 is forward-only and additive.
- A v1 client cannot open a database already upgraded to v2 by requesting version 1.
- Rollback must deploy code that understands schema v2; it must not delete `studyReviews`, rewrite notes, or attempt an automatic downgrade.
- A blocked upgrade rejects with `DATABASE_UPGRADE_BLOCKED`; the user can close other tabs and retry without data mutation.

## 6. Change gate

Every material change must answer:

1. Does it preserve the required dependency direction?
2. Does it avoid duplicate parsing or metadata ownership?
3. Does it keep canonical persistence ahead of in-memory/history success?
4. Does it avoid unbounded memory, cache, history, or listener growth?
5. Does it keep heavy parsing and indexing off the main thread where required?
6. Are transaction, failure, recovery, and rollback boundaries explicit?
7. Does a schema upgrade preserve existing note records and avoid automatic enrollment?
8. Do paired note/review mutations use one cross-store transaction with terminal rollback?
9. Do tests cover the changed invariant?
