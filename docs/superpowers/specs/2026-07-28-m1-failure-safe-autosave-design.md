# M1 failure-safe autosave and durable mutation design

## Scope

Issue #42 changes only durable note mutation ordering and autosave concurrency. It covers `core/autosave.js`, one focused lifecycle coordinator, bounded `app.js` wiring, unit/integration tests, package scripts, and invariant documentation. It does not change the IndexedDB schema, migrations, export, worker protocol, search ranking, backlink algorithms, sync, service workers, or general UI architecture.

## Commit point

Canonical IndexedDB mutation is the commit point:

```text
editor intent or command
→ prepare normalized note mutation
→ persist IndexedDB upsert/delete
→ commit canonical in-memory state
→ update backlinks and search projections
→ record command/history success
```

A rejected IndexedDB operation occurs before the canonical in-memory collection changes. The action rejects to the command stack, so the failed command is not added to undo history and no operation-history record is created.

## Canonical failure contract

- Failed create does not insert an undurable note.
- Failed edit leaves the editor draft visible and `dirty: true`.
- Failed delete leaves the note visible and selected.
- The visible status becomes `Storage unavailable`.
- Failure callbacks identify only operation and subsystem; they never receive note title or body.
- Callers may retry through the existing dirty state and autosave API.

## Derived-index degradation contract

Backlinks and search are rebuildable projections. After a successful IndexedDB commit:

- canonical in-memory state is committed;
- projection failure does not reject or roll back the canonical action;
- command/history success remains valid;
- the visible status becomes `Saved locally; search index unavailable`;
- bootstrap continues to rebuild search and backlinks from canonical notes.

No background retry loop or full rebuild is introduced in this work package.

## Autosave state machine

`createAutosave({ delayMs, onSave })` preserves its public `{ queue, flush }` API and accepts an optional scheduler seam for deterministic tests.

Internal state is bounded to:

- one debounce timer;
- one idle callback;
- one `inFlight` promise;
- one `pending` trailing-work signal.

`queue()` coalesces repeated edits. If a save is already running, queued work becomes one trailing save rather than a concurrent save. `flush()` cancels scheduled callbacks, waits for the current save, and runs at most one required trailing save. Work queued during that trailing save remains scheduled for a later run. Every internally started promise has a rejection handler, while `flush()` still rejects to awaiting callers.

## Draft preservation during successful in-flight saves

Editor input increments the existing save revision before queueing. A save captures the current revision. If newer input arrives while persistence is running, the durable older revision is committed to the note collection without re-rendering the editor or clearing `dirty`; the trailing save then applies the newer draft. This prevents a completed older write from overwriting text typed during the write.

## Implementation boundary

A new `core/noteLifecycle.js` coordinator owns only stage ordering and failure classification. It receives injected callbacks for canonical persistence, memory commit, derived updates, and bounded status reporting. It stores no notes and introduces no transaction framework.

`app.js` remains the orchestration boundary. It provides IndexedDB functions, in-memory mutation functions, search/backlink updates, status callbacks, revision checks, rendering, and history recording.

## Test design

- `tests/unit/autosave.test.mjs` uses a deterministic fake scheduler and controlled promises to prove coalescing, serialization, flush behavior, trailing-work retention, and handled rejection/retry.
- `tests/integration/note-lifecycle.failure.test.mjs` uses synthetic notes and injected failures to prove canonical persist-before-commit ordering, delete preservation, derived degradation, success ordering, and redacted failure context.
- Existing storage lifecycle, command-stack, history, E2E, and bootstrap behavior remain regression coverage.

## Compatibility and rollback

There is no schema or stored-record change. Existing records remain readable. Rollback is a code revert of the coordinator, autosave state machine, app wiring, tests, scripts, and invariant documentation; no data downgrade is required.

## Security, privacy, performance, and accessibility

Tests use synthetic data only. No note title, body, patch, raw database value, credential, or provider data is logged. Autosave keeps at most one running promise and one trailing signal, adds no polling, and preserves one canonical transaction per mutation. Save/degraded/error copy remains in the existing visible status region and introduces no focus or keyboard change.