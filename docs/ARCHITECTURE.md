# myNote Architecture Baseline

This document defines the required architecture for the current application. Changes that violate these boundaries require an explicit architecture decision and matching tests.

## 1. System baseline

myNote currently contains these core capabilities:

- **Persistence:** IndexedDB with a bounded legacy localStorage migration.
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
- Core services own parsing, indexing, backlinks, autosave, patches, and history.
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

- Owns IndexedDB schema, transactions, migration, and database I/O.
- Never mutates UI or application state directly.

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

## 5. Change gate

Every material change must answer:

1. Does it preserve the required dependency direction?
2. Does it avoid duplicate parsing or metadata ownership?
3. Does it keep canonical persistence ahead of in-memory/history success?
4. Does it avoid unbounded memory, cache, history, or listener growth?
5. Does it keep heavy parsing and indexing off the main thread where required?
6. Are transaction, failure, recovery, and rollback boundaries explicit?
7. Do tests cover the changed invariant?