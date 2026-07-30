# myNote Technical Invariants

These rules are mandatory. A change that violates an invariant must be rejected or accompanied by an explicitly approved contract change and matching regression coverage.

## 1. Dependency direction

```text
UI → Actions → State → Core → Persistence
```

Forbidden:

- UI modules calling IndexedDB directly.
- Parser functions mutating application state.
- Workers mutating the DOM.
- Commands bypassing the state and lifecycle boundaries.

## 2. Parser ownership

Tags, links, code blocks, tokens, AST data, checksums, and search material are derived through the canonical parser/model pipeline.

- Tags and wiki links are extracted only outside fenced code, including an unclosed fence.
- A closed fenced block appears once as a code node and is not duplicated as paragraphs.
- Tokenization includes code content so code remains searchable.
- UI, history, and search orchestration must not duplicate metadata extraction.

### Canonical note normalization

- `id`, `title`, `content`, `createdAt`, `updatedAt`, `pinned`, `archived`, and `version` are canonical caller-owned fields.
- `normalizeNote` canonicalizes `title` and `content`, then parses `content` exactly once.
- `links` and `ast` are always rebuilt from the current parser result.
- `checksum` is rebuilt from canonical `title`, one newline, and exact `content`.
- `searchBlob` is rebuilt last from the normalized note.
- Caller-supplied `links`, `ast`, `checksum`, and `searchBlob` are never trusted.
- Incoming tags are merged with parsed tags because the current schema has no tag-provenance field.
- Existing non-empty blocks and block IDs are preserved. Missing or empty blocks may be generated with random UUIDs.
- The checksum is a deterministic, non-cryptographic change detector. It does not provide authenticity or collision resistance.
- Normalization does not by itself authorize a stored-data migration or rewrite.

## 3. State, patches, commands, and history

- Every state mutation follows an explicit action path.
- Shared objects are not mutated directly.
- Equal inputs produce equal deterministic transitions, except fields explicitly documented as generated identifiers or timestamps.
- Store updates shallow-merge object or functional patches in order and notify each active subscriber once after a successful update.
- Note patches modify only approved fields, preserve fields outside the patch boundary, and deep-clone nested transition values on creation, application, and inversion.
- Failed command execution does not change the undo or redo stack.
- Failed undo or redo restores the command to its original source stack, leaves the opposite stack unchanged, and rethrows the original error.
- Successful execute, undo, and redo preserve LIFO ordering, redo invalidation, and configured bounds.

## 4. Canonical persistence ordering

```text
prepare normalized mutation
→ persist canonical IndexedDB upsert/delete
→ commit canonical in-memory state
→ update rebuildable backlinks/search projections
→ commit command/history success
```

Required:

- IndexedDB mutation is the canonical commit point for create, edit, pin/archive, delete, undo, and redo.
- Canonical persistence succeeds before a note is inserted, replaced, or removed in memory.
- Canonical failure propagates through the action/command boundary. Failed commands are not added to undo or retained history.
- Failed edits preserve the current editor draft and `dirty: true`.
- Failed deletes keep the note visible and selected.
- Failed creates do not insert an undurable note.
- Error callbacks receive bounded operation/subsystem metadata and the error object; they never receive note title or content.
- Backlink/search failure after canonical commit is a derived degradation. It does not roll back canonical data or command/history success and must expose `Saved locally; search index unavailable` or an equivalent bounded status.
- Bootstrap can rebuild backlinks and search from canonical notes.
- History is recorded only after the canonical lifecycle completes.

### Autosave

- `createAutosave` keeps at most one in-flight `onSave()` promise and one pending trailing-work signal.
- Repeated `queue()` calls coalesce and never run two saves concurrently.
- `flush()` cancels timer/idle callbacks, awaits the in-flight save, and runs at most one required trailing save.
- Work queued during the trailing save remains scheduled.
- Internally started promises have rejection handlers; awaited `flush()` still rejects so callers can block navigation or a later mutation.
- Editor input advances the save revision before queueing. A newer revision created during a save must not be overwritten or marked clean by the older durable revision.

### Legacy migration

- `localStorage["my-note-v2"]` is absent only when `getItem` returns `null`; an empty string is invalid JSON and is preserved exactly.
- The IndexedDB emptiness check and conditional writes occur in one `readwrite` transaction to serialize competing tabs.
- A non-empty IndexedDB store returns `blocked-existing-data` without parsing, normalizing, merging, or changing either store.
- An eligible source is parsed once. Candidates are normalized fail-fast in order, and each visited candidate passes through authoritative `normalizeNote` at most once.
- Malformed JSON, non-array JSON, any invalid record, or duplicate normalized IDs reject the complete candidate set before any write.
- Valid arrays, including an empty array, are queued in the deciding transaction. A synchronous queue failure aborts and rethrows the original error.
- Request errors are recorded; the caller receives rejection after terminal abort with the original request error or a content-free `AbortError`.
- The exact legacy key is removed only after transaction completion and only when its current value still equals the captured source.
- Source mismatch preserves the current source and rejects with content-free `LEGACY_SOURCE_CHANGED`.
- Persistence failure preserves the source for retry. Retry after success is an `absent` no-op.
- Migration outcomes contain only bounded `status`, `count`, and optional safe `errorCode` fields.
- Migration never returns or logs raw source data, note data, identifiers, titles, content, tags, links, checksums, or database dumps.
- The current migration keeps `myNoteDB` version 1 and the current `notes` store/indexes until a separately approved schema change is implemented.

Forbidden:

- Recording history before canonical persistence.
- Undo/redo that skips persistence.
- Treating canonical storage failure and derived-index failure as the same error path.
- Adding polling, background retry loops, optimistic queues, or schema changes inside the autosave boundary.

## 5. Search and backlink consistency

For each note update:

- Remove old search material.
- Add new search material.
- Incremental query results remain equivalent to a rebuild from canonical state.
- Backlinks update incrementally on upsert and removal.
- Reverse edges remain correct after rename, retitle, deletion, and restore.

Normal editing must not trigger a full index rebuild. Any mismatch must expose a rebuildable degraded state.

## 6. Rendering and resource bounds

- Large note lists use virtualization.
- Editing does not rerender the complete list for each keypress.
- Event listeners have explicit lifecycle cleanup.
- Undo, command, operation, snapshot, cache, and index structures are bounded.
- Default command and operation history bounds are 300; snapshot history retains at most 30 entries.
- History deep-clones operation, nested patch, and snapshot values on ingress and egress.
- Above 80% of the configured operation-history bound, older patch payloads may compact to `null`, while metadata and `patchSize` remain and the newest 120 entries retain full patches.
- Index structures provide remove or compaction paths.
- Unbounded caches without eviction are forbidden.

## 7. Security

- Note content is never rendered as raw HTML.
- Wiki-link output is escaped or represented through safe text nodes.
- Worker messages are shape-validated and size-bounded.
- Heavy parsing and indexing do not run synchronously on the main thread.
- Search queries run asynchronously through the worker boundary.
- Development metrics remain available for critical paths.

## 8. Verification

Changes to parser, model, index, backlinks, state, history, persistence, migration, or autosave require focused regression tests covering the affected contract, including as applicable:

- Deterministic parsing and normalization.
- Reversible patch and index transitions.
- Undo/redo without state drift.
- Persist-before-memory ordering and injected failure.
- Autosave coalescing, serialization, flushing, trailing work, and rejection handling.
- Migration atomicity, compatibility, retry behavior, and bounded diagnostics.