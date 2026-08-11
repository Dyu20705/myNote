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
- Legacy migration owns only the existing `notes` store and indexes. It does not create, update, delete, or inspect `studyReviews`.

### Japanese study persistence: store introduced by schema v2

- `myNoteDB` is currently version 3; its `studyReviews` store was introduced by the forward-only additive v2 branch.
- The `oldVersion < 2` upgrade branch creates only `studyReviews`; it never enumerates, reads, normalizes, writes, copies, or rewrites a record in `notes`.
- `notes` retains store name `notes`, key path `id`, indexes `updatedAt`, `pinned`, and `archived`, and all existing record bytes.
- Bootstrap and upgrade do not automatically enroll existing notes or create review records.
- `studyReviews` uses key path `noteId` and exactly the indexes `nextReviewAt`, `notebookType`, and `status`.
- A review has the exact owned fields `noteId`, `notebookType`, `status`, `lastReviewedAt`, `nextReviewAt`, `interval`, and `ease`.
- `interval` is a non-negative safe integer. `ease` is finite and lies within the persisted contract range.
- The validator rejects malformed data with content-free `INVALID_STUDY_REVIEW` and returns an exact-shape defensive copy.
- Review reads validate and return defensive copies. Invalid persisted records reject without repair or rewrite.
- An orphan review remains readable and durable; storage code does not silently delete it or create a replacement note.
- Updating an existing review uses one `studyReviews` `readwrite` transaction. A missing record rejects with `STUDY_REVIEW_NOT_FOUND` and is not inserted.
- Creating, deleting, or restoring a note/review pair uses one `readwrite` transaction containing both `notes` and `studyReviews`.
- Pair inputs are validated and cloned before a transaction opens, and note/review identifiers must match.
- A collision, synchronous queue failure, request failure, or abort rolls back both stores and settles terminally before rejection.
- The first real IndexedDB request error retains exact object identity. A cancelled request caused by explicit transaction abort does not replace it.
- Application-created validation, missing-record, blocked-upgrade, and abort fallback errors contain no note or review identifier, timestamp, field value, payload, or content.
- Deleting a generic note removes only the note and returns `undefined`.
- Deleting an enrolled note returns a defensive review only after the paired deletion commits.
- Deleting a missing note preserves any orphan review with the same key and returns `undefined`.
- Restore uses `add` for both records and aborts instead of overwriting either existing key.
- A blocked version upgrade rejects with `DATABASE_UPGRADE_BLOCKED`; a connection that succeeds after that rejection is immediately closed.
- Every opened database connection closes itself on `versionchange` so a newer deployment is not indefinitely blocked by this client.
- There is no automatic schema downgrade. Rollback code must understand database v3 and must not delete review data or rewrite notes.

### Kanji saved-grid persistence: schema v3

- The `oldVersion < 3` upgrade branch creates only `kanjiInkEntries` with key path `id` and indexes `noteId` and `updatedAt`; it does not enumerate, read, normalize, write, copy, or rewrite existing `notes` or `studyReviews` records.
- `kanjiInkEntries` accepts only the validated union of historical V1 and saved-grid V2 records. Validation dispatches by the own data property `schemaVersion`.
- V1 is read-only compatibility data. Its required recognition-era fields remain validated; cloneable unknown own fields are preserved across read, delete/restore, structured export, and import. It is never upgraded or rewritten on read.
- V1 remains searchable only by its already-confirmed `character`. V2 contributes no character, recognizer, candidate, or other guessed text to canonical search material.
- V2 has exactly `id`, `noteId`, `strokes`, `paperStyle`, `createdAt`, `updatedAt`, and `schemaVersion`. `paperStyle` is `grid`; a stroke has exactly `tool`, `width`, and `points`; a point has exactly `x`, `y`, and `t`.
- V2 persisted tools are only `pen` and `marker`, with canonical normalized widths `0.008` and `0.024`. Eraser is interaction-only and removes intersecting canonical strokes.
- V2 coordinates are finite and normalized to `[0, 1]`. Each stroke starts at `t: 0`; times are monotonic integers no greater than `600000` ms.
- An entry is bounded to 32 strokes, 256 points per stroke, 4,096 total points, and 262,144 serialized bytes. Controller Undo/Redo retains at most 100 committed draft states.
- Save requires a non-empty valid draft, is single-flight, and reports success only after canonical persistence. Failure preserves the exact draft, selected tool, Undo/Redo state, and retry intent.
- Create and update validate the owning note in the same transaction. Deleting/restoring a note includes its valid handwriting dependents in the same transaction as the note and optional review; collisions or request failure roll back the complete transaction.
- Invalid persisted handwriting is isolated and reported without repair. Handwriting delete/restore and mixed-record import use add-not-overwrite semantics where collision safety is required.
- New structured exports use exact bundle schema 4 and preserve mixed V1/V2 records. Exact historical schema-3 bundles remain importable and may contain only V1 entries.
- Human-readable export derives SVG from normalized vectors. V1 may expose its stored character and historical attribution; V2 is labelled `Kanji drawing` and never invents a character.
- The Kanji path performs no network request and loads no remote recognizer, model, dataset, or telemetry.
- Rollback is code-only and database-v3 aware. It must preserve both V1 and V2 records without deletion, rewrite, or downgrade; unsupported V2 may be presented only as preserved data.

### Japanese templates and deterministic scheduling

#### Template boundary

- `japaneseTemplates` accepts only the five persisted notebook types and returns fresh exact-shape template objects.
- Vocabulary, kanji, and grammar seeds accept only an empty plain options object. Output requires exactly one valid calendar date; planner requires exactly one valid ISO week.
- Each template owns one exact reserved tag.
- Enrolled output and planner lookup succeeds only when an existing note, a valid matching review, an exact expected title, and the canonical parser-extracted reserved tag all agree.
- A tag inside fenced code is not enrollment metadata because lookup delegates to the canonical parser.
- Lookup returns the lexicographically smallest matching note ID, never classifies a note from its tag alone, and does not sort or mutate caller arrays.
- Template creation and duplicate lookup reject malformed, inherited, unknown, or hostile top-level boundaries with fresh content-free errors.

#### Scheduler boundary

- `studyScheduler` is caller-clocked and pure: it has no persistence, parser orchestration, dashboard, state/action, DOM, network, or ambient-clock responsibility.
- Initial reviews have status `new`, interval `0`, ease `2.5`, no last-reviewed time, and a next-review time equal to the supplied valid timestamp spelling.
- Every rating preserves the supplied valid `nowIso` spelling as `lastReviewedAt`.
- Day scheduling adds exact 24-hour multiples to the represented instant; it does not use calendar-day or daylight-saving transitions.
- Computed `nextReviewAt` values are canonical UTC timestamps. A supplied fractional-second sequence is retained exactly; a supplied timestamp without a fractional part produces `.000` in computed output.
- Due comparison is by instant rather than timestamp spelling. Suspended reviews are never due and cannot be rated.

| Rating | Status | Interval | Ease | Next review |
|---|---|---|---|---|
| `again` | `learning` | `0` | `max(1.3, round2(ease - 0.20))` | 10 minutes |
| `hard` | `learning` when previous interval is `0`, otherwise `review` | `ceil(max(previous, 1) × 1.20)` | `max(1.3, round2(ease - 0.15))` | Exact interval days |
| `good` | `review` | `1` from `0`; `3` from `1`; otherwise `max(previous + 1, round(previous × ease))` | Unchanged | Exact interval days |
| `easy` | `review` | `4` from `0`; otherwise `max(previous + 1, round(previous × ease × 1.30))` | `min(3.0, round2(ease + 0.15))` | Exact interval days |

`round2` means deterministic rounding to two decimal places after the rating adjustment. Every calculated interval remains a non-negative safe integer, and every calculated timestamp remains within the persisted four-digit-year contract.

- Scheduler transitions return fresh validated records and never mutate the caller.
- Invalid persisted reviews retain `INVALID_STUDY_REVIEW` provenance.
- Application-created template and scheduler errors are fresh, bounded, and content-free.

Forbidden:

- Recording history before canonical persistence.
- Undo/redo that skips persistence.
- Treating canonical storage failure and derived-index failure as the same error path.
- Adding polling, background retry loops, optimistic queues, or schema changes inside the autosave boundary.
- Reading the system clock, locale, timezone, persistence, state, DOM, or network from template or scheduler modules.
- Treating a reserved tag without a valid matching review as enrollment.

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

Changes to parser, model, index, backlinks, state, history, persistence, migration, autosave, study-review metadata, Japanese templates, or study scheduling require focused regression tests covering the affected contract, including as applicable:

- Deterministic parsing and normalization.
- Reversible patch and index transitions.
- Undo/redo without state drift.
- Persist-before-memory ordering and injected failure.
- Autosave coalescing, serialization, flushing, trailing work, and rejection handling.
- Migration atomicity, compatibility, retry behavior, and bounded diagnostics.
- Schema upgrades, blocked upgrades, cross-store rollback, collision handling, orphan preservation, and defensive validation.
- Exact template titles, bodies, tags, date/week validation, hostile boundaries, parser-owned tag semantics, duplicate tie-breaking, and caller immutability.
- Initial review values, due comparisons across equivalent timestamp spellings, suspension behavior, all rating branches, ease normalization and caps, safe-integer overflow, timestamp-range overflow, error provenance, and caller immutability.
