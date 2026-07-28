# M1 state transition invariants design

## Scope

Issue #41 establishes executable contracts for the existing pure transition primitives in `core/state.js`, `core/notePatch.js`, `core/commandStack.js`, and `core/history.js`. The change adds four focused unit suites, repairs only defects demonstrated by those suites, and documents the resulting invariants. It does not change application orchestration, persistence, schema, autosave, workers, search, backlinks, export, rendering, or recovery UI.

The dependency baseline is merge commit `c02391c7500a95848283bdce47c035b76e6c3461`, where PR #40 is present in `main`, issue #39 is closed, the push CI run is green, and local clean-checkout verification passes.

## Selected approach

Keep the four existing factories and their signatures, and strengthen only their current ownership boundaries.

- `createStore` remains a synchronous shallow-merge store. Tests make initial-state copying, object and functional patch ordering, notification, and unsubscribe behavior explicit.
- `createNotePatch`, `invertNotePatch`, and `applyNotePatch` remain the approved-field transition boundary. Tests lock round trips, inverse behavior, unknown-field preservation, deterministic reapplication, and nested mutation isolation.
- `createCommandStack` continues to own two bounded arrays. A command leaves its source stack before execution, moves to the opposite stack only after success, and is restored to its original source stack if the awaited operation rejects.
- `createHistory` remains an in-memory bounded record. It deep-clones plain structured data on ingress and egress so neither producers nor consumers retain a mutable reference to its internal state.

Two broader alternatives are rejected. A serialized command queue would add concurrency and cancellation semantics outside this child. A JSON-only history representation would silently narrow supported values and alter `undefined` and other structured data semantics. The selected approach uses the platform `structuredClone` behavior with the repository's existing JSON fallback pattern and adds no dependency.

## Command-stack ownership and failure behavior

`execute(command)` awaits `command.do()` before modifying either stack. A rejected execute therefore leaves undo and redo availability unchanged. A successful execute appends the command to undo, clears redo, then evicts the oldest undo entry when the configured bound is exceeded.

`undo()` pops exactly one newest undo command. If no command exists it returns `false`. It awaits `command.undo()` and, on success, appends that command to redo and returns `true`. If the operation rejects, it appends the same command back to undo and rethrows the original error. Redo remains untouched.

`redo()` is symmetric: it pops the newest redo command, awaits `command.do()`, moves it to undo on success, and restores it to redo before rethrowing on failure. Undo remains untouched on rejection.

Restoration uses `push`, not an insertion or reorder operation, because the rejected command was the newest source-stack entry. Public return values, error propagation, LIFO ordering, redo invalidation, and the default limit of 300 remain compatible. A general concurrency guard or queue is not introduced.

## History ownership, compaction, and bounds

History accepts operation and snapshot payloads as plain structured-cloneable data. `record(operation)` first deep-clones the entire operation. Patch compaction operates only on that owned copy, records the full patch length as `patchSize`, appends it, and enforces the configured operation bound.

When retained operations exceed 80 percent of the configured bound, full patch payloads may be removed from entries older than the newest 120. Operation metadata and `patchSize` remain intact. The exact existing compaction threshold and newest-120 behavior remain unchanged.

`snapshot(state)` deep-clones state before retention, adds the existing ISO timestamp, and keeps the newest 30 snapshots. `getOperations()` and `getSnapshots()` deep-clone the complete returned arrays. Mutation of original inputs, prior getter results, nested patches, or nested snapshot values therefore cannot change retained history.

Cloning is bounded to one ingress payload or one bounded getter result. No note content is logged, persisted, serialized to a remote service, or exposed across a new trust boundary.

## Store and note-patch contracts

Store behavior remains deliberately shallow. The initial object is copied without mutating the caller. Each object or functional patch is shallow-merged in call order. Active subscribers are synchronously called once with the committed state for every successful `setState`; unsubscribe removes later notifications. Listener exception isolation and async subscribers remain out of scope.

Patch behavior remains restricted to the existing `PATCH_KEYS`. Patch creation deep-clones changed before/after values and does not mutate either note. Applying a patch creates a new top-level note, deep-clones every assigned value, and preserves fields outside `PATCH_KEYS`. Inversion creates independent swapped values. Empty changes yield an empty patch, inverse application restores approved fields, and reapplication is deterministic. The tests decide whether production changes are needed; no speculative modification to `state.js` or `notePatch.js` is planned.

## Data flow and compatibility

The architecture remains `UI -> Actions -> State -> Core -> Persistence`. This child changes no call site in `app.js`. Existing calls continue to await `execute`, `undo`, and `redo`; rejected command operations continue to propagate errors, but retryability is preserved. Existing history producers continue to pass operation objects and snapshots through the same factory API.

There is no note schema, IndexedDB version, migration, persisted revision log, automatic record rewrite, or worker protocol change. Existing records require no conversion. Public factory names and signatures remain unchanged.

## Test design and TDD seams

Four Node test files provide individually named behavioral contracts:

- `state.test.mjs`: initial ownership, ordered shallow object/functional merges, committed-state notifications, and unsubscribe.
- `note-patch.test.mjs`: empty changes, approved-field round trip and inverse, unknown-field preservation, deterministic reapplication, and ingress/egress mutation isolation.
- `command-stack.test.mjs`: execute success/failure, undo/redo success and rejection retryability, redo invalidation, empty-stack returns, LIFO order, and literal bound behavior.
- `history.test.mjs`: operation and snapshot ingress isolation, getter egress isolation, operation/snapshot bounds, patch size, and newest-120 compaction.

The mandatory RED checkpoint must show exactly the current root causes: rejected undo/redo lose their popped command, and history retains or exposes nested caller references. Store and patch tests are expected to pass on the baseline; they authorize production changes only if a dedicated behavioral assertion fails for a repository defect.

## Security, privacy, performance, and rollback

Fixtures use synthetic identifiers and values only. No note title, body, patch, snapshot, credential, database payload, or browser profile is emitted to diagnostics. Deep cloning adds no dynamic code execution and accepts only the plain structured data already used by history.

Command operations stay O(1), apart from existing oldest-entry eviction. History ingress cloning is linear in one bounded entry, getters are linear in the bounded retained set, operations remain capped at 300 by default, snapshots at 30, and full patches at the newest 120 after compaction. No cache, polling, background work, or dependency is added.

Rollback is a revert of the command/history corrections, tests, script entry, design, plan, and invariant documentation. No data downgrade or migration rollback is required because all changes are in-memory behavior.
