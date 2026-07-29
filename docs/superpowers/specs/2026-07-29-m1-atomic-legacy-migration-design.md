# M1 atomic legacy migration design

## Scope

Issue #43 hardens the one existing `localStorage["my-note-v2"]` to IndexedDB v1 migration. The work is limited to `core/storage.js`, checked-in synthetic legacy fixtures, one focused integration suite, the integration-test script, and authoritative migration documentation. It does not change `DB_VERSION`, the `notes` store or indexes, the canonical note schema, bootstrap UI, export, restore, search, workers, or persistence ordering established by #42.

The issue body is the human-approved requirements baseline. There is no unresolved product choice or irreversible schema decision.

## Selected approach

Three approaches were considered:

1. Keep a pure legacy decoder/preflight and the migration orchestrator in `core/storage.js`. This is selected because it preserves the existing public entrypoint, keeps all storage ownership in the current module, and requires no dependency or schema change.
2. Extract a new public `core/legacyMigration.js` module. This would isolate parsing, but it adds a public module boundary without a second consumer and makes the storage transaction contract harder to inspect in one place.
3. Add a staging object store or bump the database version. This could support future import/recovery workflows, but it exceeds the current-schema contract and introduces rollback and upgrade risks expressly excluded by #43.

The selected approach introduces no new public factory or runtime dependency. The existing `migrateLegacyStorageIfNeeded(db, normalizeNote)` signature remains valid and now returns a bounded outcome that callers may ignore.

## Migration state machine

The migration follows this deterministic order:

```text
read exact legacy string
-> absent: return without opening an IndexedDB transaction
-> open one readwrite ownership transaction
-> count existing IndexedDB notes inside that transaction
-> existing notes: preserve both stores and return blocked-existing-data
-> confirm the current source still equals the captured string
-> parse JSON once
-> validate top-level array shape
-> normalize candidates in order, fail-fast, at most once each through normalizeNote
-> reject the complete candidate set if any normalized record is invalid
-> reject the complete candidate set if normalized IDs collide
-> queue every normalized record in the same ownership transaction
-> wait for transaction commit
-> confirm the current source still equals the captured string
-> changed source: preserve it and reject with a content-free conflict
-> remove the exact legacy key
-> return migrated
```

The legacy lookup distinguishes a missing key (`null`) from a present empty string. A present empty string is invalid JSON and remains byte-for-byte unchanged. A valid empty JSON array is a successful zero-record migration: an empty readwrite transaction commits, the legacy key is removed, and the result is `migrated` with count zero.

When legacy data exists, the database count is checked before parsing and in the same `readwrite` transaction that conditionally queues writes. IndexedDB serializes that transaction across connections, so only one concurrent tab can observe an empty store and import. Existing canonical data has precedence over source classification: automatic merge is blocked, raw legacy data is untouched, and no note content is loaded merely to determine whether the database is non-empty.

## Pure preflight contract

A private pure helper accepts the exact raw string and the existing `normalizeNote` dependency. It returns either a validated normalized array or a bounded classification. It does not access IndexedDB, `localStorage`, UI state, or logs. Normalization is fail-fast: each candidate reached before the first invalid record or duplicate is normalized exactly once, while later candidates need not be visited.

Classification statuses are:

- `invalid-json`: JSON parsing failed.
- `invalid-shape`: parsed JSON is not an array.
- `invalid-record`: at least one candidate cannot normalize to an object with a string ID under the authoritative #39 contract, including a thrown normalization error.
- `duplicate-id`: two successfully normalized candidates share an ID.
- `ready`: every candidate is valid and IDs are unique; normalized notes remain internal to the migration operation.

No valid subset is returned for an invalid array. Duplicate detection occurs after normalization because the normalized ID is the persisted identity.

## Public outcome contract

`migrateLegacyStorageIfNeeded` returns a fresh plain object containing only:

- `status`: one of `absent`, `blocked-existing-data`, `invalid-json`, `invalid-shape`, `invalid-record`, `duplicate-id`, or `migrated`;
- `count`: a bounded integer relevant to that status (zero for absent/parse-shape failures, existing record count for the blocked state, candidate count for record/duplicate rejection, and committed record count for migration);
- `errorCode`: present only for blocked or invalid data classifications and equal to a stable non-content code.

Outcomes never contain a raw source string, normalized note, ID, title, content, tag, link, checksum, database dump, or underlying parser/storage error. Operational IndexedDB or `localStorage` failures continue to reject so the existing bootstrap safe-mode path remains compatible; they are not converted into a successful-looking data classification. A detected source-identity conflict also rejects, using only the stable content-free code `LEGACY_SOURCE_CHANGED`.

## Transaction and cleanup ownership

The decisive `count()` and all validated note writes share one `readwrite` transaction. This is the cross-connection exclusion boundary: a later tab's transaction observes the first committed import and returns `blocked-existing-data`. Request failures abort the transaction by IndexedDB semantics. A synchronous queueing failure is caught, the transaction is explicitly aborted, completion is observed, and the original failure is rethrown. Therefore no prefix of the candidate set can commit.

The captured source is compared with the current `localStorage` value before queueing writes and again after the transaction `complete` event. A mismatch preserves the current value and rejects with a content-free error carrying `LEGACY_SOURCE_CHANGED`. The legacy key is removed only after the post-commit comparison succeeds. If the transaction rejects or aborts, no cleanup is attempted and the exact source remains available for retry.

IndexedDB and `localStorage` cannot participate in one cross-store transaction, and Web Storage offers no atomic compare-and-remove primitive. A source change detected after IndexedDB commits therefore leaves the committed old notes and the newer source intact, then rejects; `removeItem` failure has the same recoverable pair. A retry observes non-empty IndexedDB and returns `blocked-existing-data`; it never imports duplicates or deletes the source automatically. A source change in the irreducible interval between the final comparison and `removeItem` cannot be made atomic without a new coordination mechanism, so this remains an explicit platform limitation.

## Fixtures and test design

Checked-in files under `tests/fixtures/storage/` cover:

- a valid two-note legacy array with fixed IDs, timestamps, and block IDs;
- an empty array;
- malformed JSON text;
- valid non-array JSON;
- a mixed valid/invalid array;
- duplicate normalized IDs;
- non-string title/content normalization.

`tests/integration/storage.migration.test.mjs` uses `fake-indexeddb`, an isolated Map-backed `localStorage` stub, fixed synthetic records, and serial database cleanup. It exercises the public migration function and real `normalizeNote` unless a deliberately injected normalization result is required to force a synchronous IndexedDB clone failure.

Required RED evidence proves that the baseline:

1. imports the valid subset of a mixed array and deletes the full source;
2. collapses duplicate IDs through `put` and deletes the source;
3. returns `undefined` instead of a completed or blocked outcome;
4. can commit a queued prefix when a later synchronous `put` fails unless the transaction is explicitly aborted.

Independent-review RED evidence additionally proves that separate readonly-count and write transactions let two connections both import, and that unconditional post-commit cleanup deletes a newer source written at the commit boundary.

GREEN coverage additionally proves valid and empty migrations, exact malformed/non-array preservation, existing-data blocking, deterministic retry after blocked/failure outcomes, retry-after-success no-op, canonical normalization/derived-field rebuilding, cross-connection serialization, source-conflict preservation, synchronous error identity, asynchronous abort settlement, transaction rollback, bounded outcome keys, and bootstrap call compatibility.

## Compatibility, security, and performance

The database remains `myNoteDB` version 1 with the existing `notes` store and indexes. Valid historical records still flow through the merged #39 normalization contract. No current note is rewritten, no automatic merge occurs, and the application may continue ignoring the migration return value.

Fixtures are synthetic and contain no personal content or URLs. Raw legacy strings and normalized notes are never logged or returned. JSON is parsed as inert data and no dynamic code path is introduced.

Work is O(number of legacy records plus serialized legacy size) and runs only when the legacy key exists and the deciding IndexedDB transaction observes an empty store. The source is parsed once and candidates are normalized fail-fast, at most once each. Existing-data detection uses `count()` rather than loading note bodies. No cache, polling, background retry, or full-database rewrite is added.

## Documentation and rollback

`docs/INVARIANTS.md` will define preflight rejection, one-transaction writes, post-commit cleanup, explicit outcomes, existing-data blocking, and retry behavior. The change has no accessibility or visible UI effect.

Rollback is one PR revert with no database downgrade. Sources preserved by the hardened behavior remain readable by the old code, but rolling back before resolving malformed or ambiguous legacy data restores the prior partial-import/data-loss risk. Successfully migrated v1 notes remain schema-compatible.
