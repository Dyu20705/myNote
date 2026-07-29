# M1 Atomic Legacy Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing `my-note-v2` localStorage-to-IndexedDB v1 migration atomic, deterministic, retry-safe, explicitly classified, and covered by checked-in synthetic compatibility fixtures.

**Architecture:** Keep migration ownership in `core/storage.js`. Read and classify the exact legacy string before any write, normalize every candidate once through the existing #39 contract, reject the whole set on invalid records or duplicate normalized IDs, commit valid records in one IndexedDB transaction, and remove the source only after commit. Preserve the current two-argument bootstrap call and expose only bounded status/count/error-code outcomes.

**Tech Stack:** Node.js 22.20.0, npm 11.7.0, ECMAScript modules, IndexedDB v1, `fake-indexeddb` 6.2.5, `node:test`, `node:assert/strict`, ESLint 10.8.0, Playwright 1.62.0.

## Global Constraints

- Work only on issue #43 in branch `agent/m1-43-atomic-legacy-migration` based on `main@fb342989300e00e96d0012acfe6317f639e0e608`.
- Keep `DB_NAME = "myNoteDB"`, `DB_VERSION = 1`, store `notes`, and the existing indexes unchanged.
- Preserve `migrateLegacyStorageIfNeeded(db, normalizeNote)` call compatibility; `app.js` may continue ignoring the returned outcome.
- Use the merged `normalizeNote` contract; do not add a second schema validator or reinterpret caller-owned fields.
- Never import a valid subset from an invalid source and never merge automatically into non-empty IndexedDB.
- Never return or log legacy JSON, notes, IDs, titles, content, tags, links, checksums, or database dumps.
- Add no dependency, staging store, schema version, UI, export/restore flow, search/worker change, polling, or retry daemon.
- Run Node test-runner and Playwright commands outside the Windows sandbox because sandboxed Node child-process creation reproducibly fails with `spawn EPERM`.
- Keep the draft PR unmerged and close only #43 with `Closes #43`.

---

### Task 1: Check in the compatibility fixture matrix and observe explicit-outcome RED

**Files:**
- Create: `tests/fixtures/storage/legacy-v2-valid-multi.json`
- Create: `tests/fixtures/storage/legacy-v2-empty.json`
- Create: `tests/fixtures/storage/legacy-v2-malformed.txt`
- Create: `tests/fixtures/storage/legacy-v2-non-array.json`
- Create: `tests/fixtures/storage/legacy-v2-mixed-invalid.json`
- Create: `tests/fixtures/storage/legacy-v2-duplicate-ids.json`
- Create: `tests/fixtures/storage/legacy-v2-non-string-fields.json`
- Create: `tests/integration/storage.migration.test.mjs`

**Interfaces:**
- Consumes: current `openDatabase`, `listNotesFromDb`, `migrateLegacyStorageIfNeeded`, and `normalizeNote` exports.
- Produces: serial integration-test helpers and the first failing public-outcome contract.

- [ ] **Step 1: Create exact synthetic fixture categories**

Use fixed IDs, timestamps, and non-empty fixed block arrays in the valid multi-note fixture so normalization does not create random IDs. Use these category-defining payloads:

`legacy-v2-valid-multi.json`:

```json
[
  {
    "id": "legacy-alpha",
    "title": "  Alpha  ",
    "content": "Alpha body #one [[Beta]]",
    "blocks": [{ "id": "block-alpha", "type": "paragraph", "content": "Alpha body #one [[Beta]]", "meta": {} }],
    "tags": ["Manual"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z",
    "version": 1
  },
  {
    "id": "legacy-beta",
    "title": "Beta",
    "content": "Beta body",
    "blocks": [{ "id": "block-beta", "type": "paragraph", "content": "Beta body", "meta": {} }],
    "createdAt": "2024-02-01T00:00:00.000Z",
    "updatedAt": "2024-02-02T00:00:00.000Z",
    "pinned": true,
    "version": 1
  }
]
```

`legacy-v2-empty.json`:

```json
[]
```

`legacy-v2-malformed.txt` contains exactly:

```text
[{"id":"broken"}
```

`legacy-v2-non-array.json`:

```json
{"id":"not-an-array"}
```

`legacy-v2-mixed-invalid.json`:

```json
[
  {
    "id": "legacy-mixed-valid",
    "title": "Mixed valid",
    "content": "Synthetic mixed fixture",
    "blocks": [{ "id": "block-mixed", "type": "paragraph", "content": "Synthetic mixed fixture", "meta": {} }],
    "createdAt": "2024-03-01T00:00:00.000Z",
    "updatedAt": "2024-03-02T00:00:00.000Z",
    "version": 1
  },
  null
]
```

`legacy-v2-duplicate-ids.json`:

```json
[
  {
    "id": "legacy-duplicate",
    "title": "Duplicate first",
    "content": "First synthetic duplicate",
    "blocks": [{ "id": "block-duplicate-first", "type": "paragraph", "content": "First synthetic duplicate", "meta": {} }],
    "createdAt": "2024-04-01T00:00:00.000Z",
    "updatedAt": "2024-04-02T00:00:00.000Z",
    "version": 1
  },
  {
    "id": "legacy-duplicate",
    "title": "Duplicate second",
    "content": "Second synthetic duplicate",
    "blocks": [{ "id": "block-duplicate-second", "type": "paragraph", "content": "Second synthetic duplicate", "meta": {} }],
    "createdAt": "2024-04-03T00:00:00.000Z",
    "updatedAt": "2024-04-04T00:00:00.000Z",
    "version": 1
  }
]
```

`legacy-v2-non-string-fields.json`:

```json
[
  {
    "id": "legacy-non-string-fields",
    "title": 42,
    "content": { "synthetic": true },
    "blocks": [{ "id": "block-non-string", "type": "paragraph", "content": "Caller block survives", "meta": {} }],
    "createdAt": "2024-05-01T00:00:00.000Z",
    "updatedAt": "2024-05-02T00:00:00.000Z",
    "links": ["stale-link"],
    "ast": [{ "type": "stale" }],
    "checksum": "stale-checksum",
    "searchBlob": "stale-search",
    "version": 1
  }
]
```

Do not include personal text or URLs in any fixture.

- [ ] **Step 2: Build a serial fake IndexedDB/localStorage harness**

At the top of `storage.migration.test.mjs`, import `fake-indexeddb/auto`, load fixtures with `readFile(new URL(..., import.meta.url), "utf8")`, and install a Map-backed stub whose `getItem` returns `null` only when a key is absent:

```js
function createLocalStorageStub() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
}
```

Use `beforeEach`/`afterEach` to close every database handle, delete `myNoteDB`, replace `globalThis.localStorage`, and restore the previous global. Keep the suite `{ concurrency: false }`.

- [ ] **Step 3: Write the first failing absent-outcome test**

Add one test that calls migration with no legacy key and asserts this literal result and no extra keys:

```js
assert.deepEqual(await migrateLegacyStorageIfNeeded(db, normalizeNote), {
  status: "absent",
  count: 0,
});
```

Assert `Object.keys(outcome)` is exactly `["status", "count"]` and IndexedDB remains empty.

- [ ] **Step 4: Run focused RED and record it**

Run:

```bash
node --test --test-concurrency=1 tests/integration/storage.migration.test.mjs
```

Expected baseline RED: exit 1; the assertion reports actual `undefined` instead of `{ status: "absent", count: 0 }`. Confirm the failure is behavioral, not fixture/import/setup syntax.

- [ ] **Step 5: Commit the observed RED contract**

```bash
git add tests/fixtures/storage tests/integration/storage.migration.test.mjs
git commit -m "test: capture explicit legacy migration outcomes"
```

### Task 2: Return compatible outcomes for absent and valid migrations

**Files:**
- Modify: `core/storage.js`
- Test: `tests/integration/storage.migration.test.mjs`

**Interfaces:**
- Consumes: exact `localStorage.getItem("my-note-v2")`, existing IndexedDB handle, and `normalizeNote(note)`.
- Produces: public absent/migrated `{ status, count }` outcome objects without changing the two-argument function signature.

- [ ] **Step 1: Add the bounded outcome helper and absent branch**

Add a private helper that omits `errorCode` when not supplied. Read the raw source once and return absent only when it is `null`:

```js
function createMigrationOutcome(status, count, errorCode) {
  return errorCode === undefined ? { status, count } : { status, count, errorCode };
}
```

- [ ] **Step 2: Run absent GREEN**

Run only the absent test. Expected: PASS with no IndexedDB access beyond test verification and no source mutation.

- [ ] **Step 3: Add and run valid-migration RED**

Add a separate test that installs the valid fixture and asserts:

```js
assert.deepEqual(await migrateLegacyStorageIfNeeded(db, normalizeNote), {
  status: "migrated",
  count: 2,
});
```

Compare persisted notes to `fixture.map(normalizeNote)`, assert the source key is absent after commit, and assert serialized outcome text does not contain `Alpha`, `Beta`, fixture IDs, or body text. Expected RED: records migrate, but the actual return is `undefined`.

- [ ] **Step 4: Preserve current valid-array behavior while returning migrated**

For this task only, parse the already-read `raw` string with `JSON.parse(raw)`, normalize the valid array, write it with the existing transaction helper, remove the key after `transactionDone`, and return `{ status: "migrated", count: notes.length }`. Task 3 replaces this temporary valid-only parsing path with the complete classifier before any invalid fixture is accepted.

- [ ] **Step 5: Run focused GREEN for both outcome contracts**

Run the focused migration suite. Expected: the one Task 1 test passes with two bounded outcomes, two canonical records, and no source remaining after successful commit.

- [ ] **Step 6: Commit the minimal outcome implementation**

```bash
git add core/storage.js tests/integration/storage.migration.test.mjs
git commit -m "feat: return bounded legacy migration outcomes"
```

### Task 3: Reject malformed, wrong-shape, and mixed-record sources before writes

**Files:**
- Modify: `tests/integration/storage.migration.test.mjs`
- Modify: `core/storage.js`

**Interfaces:**
- Consumes: exact raw fixture text and authoritative `normalizeNote`.
- Produces: private all-or-nothing preflight classifications for invalid JSON, shape, and records.

- [ ] **Step 1: Add four mutation-sensitive tests one at a time**

Add tests that install the malformed, non-array, mixed, and empty fixtures. For invalid sources, assert zero IndexedDB notes and exact raw source preservation. Assert these outcomes:

```js
{ status: "invalid-json", count: 0, errorCode: "LEGACY_INVALID_JSON" }
{ status: "invalid-shape", count: 0, errorCode: "LEGACY_INVALID_SHAPE" }
{ status: "invalid-record", count: 2, errorCode: "LEGACY_INVALID_RECORD" }
```

For the mixed fixture, invoke migration twice and assert the same outcome, zero durable records, and byte-for-byte identical source after both attempts.

For the valid empty array, assert `{ status: "migrated", count: 0 }`, zero durable records, and removal of the exact legacy key after the empty write transaction completes.

- [ ] **Step 2: Observe RED for each new behavior**

Run the exact focused test name after adding each test. Expected: malformed and non-array cases fail because the Task 2 valid-only parser throws or does not distinguish their outcomes; mixed input fails because the baseline-style filter imports the valid record and removes the source; the empty array fails because the Task 2 path does not yet classify it as a successful zero-record migration.

- [ ] **Step 3: Replace the lossy loader with a pure preflight helper**

Implement one private pass:

```js
function preflightLegacyNotes(raw, normalizeNote) {
  let candidates;
  try {
    candidates = JSON.parse(raw);
  } catch {
    return { outcome: createMigrationOutcome("invalid-json", 0, "LEGACY_INVALID_JSON") };
  }
  if (!Array.isArray(candidates)) {
    return { outcome: createMigrationOutcome("invalid-shape", 0, "LEGACY_INVALID_SHAPE") };
  }

  const notes = [];
  for (const candidate of candidates) {
    let note;
    try {
      note = normalizeNote(candidate);
    } catch {
      return { outcome: createMigrationOutcome("invalid-record", candidates.length, "LEGACY_INVALID_RECORD") };
    }
    if (!note || typeof note !== "object" || typeof note.id !== "string") {
      return { outcome: createMigrationOutcome("invalid-record", candidates.length, "LEGACY_INVALID_RECORD") };
    }
    notes.push(note);
  }
  return { notes };
}
```

Do not return candidates or notes in a public outcome. In the public function, return `preflight.outcome` when present; otherwise write `preflight.notes`.

- [ ] **Step 4: Run focused GREEN and neighboring storage lifecycle**

Run the migration suite and `node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs`. Expected: all current migration tests pass and existing storage lifecycle remains 2/2.

- [ ] **Step 5: Commit invalid-source preflight**

```bash
git add core/storage.js tests/integration/storage.migration.test.mjs
git commit -m "fix: reject invalid legacy sources before writes"
```

### Task 4: Reject duplicate normalized identities as one atomic unit

**Files:**
- Modify: `tests/integration/storage.migration.test.mjs`
- Modify: `core/storage.js`

**Interfaces:**
- Consumes: the normalized note list built by preflight.
- Produces: deterministic duplicate-ID rejection before any IndexedDB transaction starts.

- [ ] **Step 1: Add duplicate-ID RED**

Load the duplicate fixture and assert:

```js
assert.deepEqual(outcome, {
  status: "duplicate-id",
  count: 2,
  errorCode: "LEGACY_DUPLICATE_ID",
});
assert.deepEqual(await listNotesFromDb(db), []);
assert.equal(localStorage.getItem(LEGACY_STORAGE_KEY), raw);
```

- [ ] **Step 2: Run focused RED**

Run only the duplicate test. Expected: exit 1 because two `put` calls collapse to one durable record and the source is removed.

- [ ] **Step 3: Detect collisions during the same normalization pass**

Maintain `const ids = new Set()` inside `preflightLegacyNotes`. Before pushing each normalized note, return the duplicate outcome if `ids.has(note.id)`; otherwise add the ID. Do not trim, case-fold, generate, or reinterpret IDs beyond `normalizeNote`.

- [ ] **Step 4: Run focused and combined GREEN**

Run the duplicate test, then the complete migration suite. Expected: duplicate input writes zero notes and preserves the exact source; all earlier classifications remain green.

- [ ] **Step 5: Commit duplicate protection**

```bash
git add core/storage.js tests/integration/storage.migration.test.mjs
git commit -m "fix: reject duplicate normalized legacy identities"
```

### Task 5: Abort the write transaction on synchronous queue failure

**Files:**
- Modify: `tests/integration/storage.migration.test.mjs`
- Modify: `core/storage.js`

**Interfaces:**
- Consumes: one validated normalized array and the existing `putNotesToDb(db, notes)` helper.
- Produces: all-or-nothing behavior even when a later `store.put` throws before creating an IDB request.

- [ ] **Step 1: Add transaction-prefix RED with an injected clone failure**

Call migration with the valid two-record fixture and a test normalizer that delegates to `normalizeNote`, then adds a function-valued property only to the second returned record. Assert migration rejects with `DataCloneError`, wait for transaction settlement, reopen the database, and assert zero notes plus the exact source still present.

- [ ] **Step 2: Run focused RED**

Expected baseline RED: the second `put` throws, but the first queued request commits because no explicit abort occurs; reopening shows one durable record.

- [ ] **Step 3: Observe completion and abort on queueing exceptions**

Create the completion promise before queueing. If a synchronous `put` throws, call `transaction.abort()`, await the completion rejection with a local catch to avoid an unhandled promise, and rethrow the original queue error:

```js
async function putNotesToDb(db, notes) {
  const tx = db.transaction(STORE_NOTES, "readwrite");
  const done = transactionDone(tx);
  const store = tx.objectStore(STORE_NOTES);
  try {
    for (const note of notes) store.put(note);
  } catch (error) {
    tx.abort();
    await done.catch(() => {});
    throw error;
  }
  await done;
}
```

Do not wrap, stringify, log, or replace the original exception.

- [ ] **Step 4: Run focused and combined GREEN**

Run the queue-failure test, complete migration suite, and storage lifecycle suite. Expected: zero partial writes, original rejection identity/type preserved, source retained, and all neighboring tests green.

- [ ] **Step 5: Commit explicit abort behavior**

```bash
git add core/storage.js tests/integration/storage.migration.test.mjs
git commit -m "fix: abort legacy migration queue failures"
```

### Task 6: Complete compatibility, retry, and test-runner coverage

**Files:**
- Modify: `tests/integration/storage.migration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: all migration classifications and fixtures from Tasks 1-5.
- Produces: complete acceptance-criteria coverage in the public integration command.

- [ ] **Step 1: Add the remaining fixture-driven assertions**

Add separate tests proving:

- non-string title/content migrates to the exact result of authoritative `normalizeNote` with canonical `title: "Untitled"` and `content: ""`; caller-supplied links, AST, checksum, and search material are replaced by rebuilt values;
- a second call after successful migration returns `{ status: "absent", count: 0 }` and leaves the two durable records unchanged;
- every returned outcome has only `status`, `count`, and optional `errorCode`, with no fixture content in its serialization;
- the existing bootstrap-compatible two-argument call resolves when callers ignore its return value.

- [ ] **Step 2: Add existing-data RED**

Seed one canonical IndexedDB note, install the valid legacy source, and pass a normalizer that throws if called. Assert migration does not call it, changes neither store, preserves the exact source, and returns:

```js
{ status: "blocked-existing-data", count: 1, errorCode: "LEGACY_EXISTING_DATA" }
```

Run only this test. Expected RED: the current implementation preserves both stores but returns `undefined`.

- [ ] **Step 3: Add count-only readiness and blocked outcome**

Implement a private count helper without loading note bodies:

```js
function countNotesInDb(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NOTES, "readonly").objectStore(STORE_NOTES).count();
    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error);
  });
}
```

After confirming the raw key exists and before preflight parsing, return `{ status: "blocked-existing-data", count: existingCount, errorCode: "LEGACY_EXISTING_DATA" }` when the count is positive.

- [ ] **Step 4: Run existing-data GREEN and remaining compatibility coverage**

Run the existing-data test first. The other compatibility tests should already be GREEN because they lock behavior established by Tasks 2-5. Record those as regression/acceptance coverage rather than claiming fabricated RED. If any fails, invoke `superpowers:systematic-debugging` before changing production code and add a dedicated RED for the identified root cause.

- [ ] **Step 5: Add the migration suite explicitly to integration verification**

Set the script to:

```json
"test:integration": "node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs tests/integration/storage.migration.test.mjs tests/integration/note-lifecycle.failure.test.mjs"
```

- [ ] **Step 6: Run focused and full integration GREEN**

Run the focused migration command and `npm run test:integration`. Record exact tests/suites/pass/fail/skip counts and duration.

- [ ] **Step 7: Commit the complete compatibility matrix**

```bash
git add package.json tests/integration/storage.migration.test.mjs tests/fixtures/storage
git commit -m "test: define legacy migration compatibility matrix"
```

### Task 7: Document, verify, independently review, and publish #43

**Files:**
- Modify: `docs/INVARIANTS.md`
- Modify only issue-owned files if verified review findings require corrections.

**Interfaces:**
- Consumes: design, plan, RED/GREEN records, base SHA `fb342989300e00e96d0012acfe6317f639e0e608`, and final head SHA.
- Produces: authoritative migration invariants, fresh verification, no unresolved P0/P1, and one unmerged draft PR closing only #43.

- [ ] **Step 1: Add the authoritative migration invariant**

Document exact raw-source preservation, absent-versus-invalid distinction, existing-data precedence, one-pass normalization, duplicate rejection, one readwrite transaction, explicit abort on queue errors, post-commit cleanup, bounded outcomes, deterministic retries, `DB_VERSION = 1`, and the cross-store cleanup-failure boundary. Do not claim backup/restore UI, schema upgrades, automatic merge, or cross-store atomicity.

- [ ] **Step 2: Commit invariant documentation**

```bash
git add docs/INVARIANTS.md
git commit -m "docs: define atomic legacy migration invariants"
```

- [ ] **Step 3: Run fresh required verification from current head**

Run outside the sandbox where Node spawns child processes:

```bash
npm ci
node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.test.mjs
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
git diff --check origin/main...HEAD
```

Also record `node --version`, `npm --version`, `npx --no-install playwright --version`, fixture byte sizes, command exit codes, pass/fail/skip counts, durations, new versus pre-existing failures, generated artifacts, and current head SHA.

- [ ] **Step 4: Inspect the complete base-to-head change**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
git log --oneline origin/main..HEAD
rg -n "TO[D]O|TB[D]|UNKNOWN — REQUIRES VALIDATION" core tests docs package.json
```

Self-review correctness, atomicity, retry determinism, canonical normalization, error propagation, API/schema compatibility, privacy, performance/memory, rollback, test mutation sensitivity, and fixture safety. Fix valid findings one at a time through fresh RED/GREEN cycles.

- [ ] **Step 5: Request independent code review**

Invoke `superpowers:requesting-code-review` with issue #43, the design and plan paths, base SHA, current head SHA, and complete diff. Require findings by P0-P3. Validate each finding against repository evidence, use `superpowers:receiving-code-review` before applying suggestions, and leave no unresolved P0/P1.

- [ ] **Step 6: Re-run verification after any review correction**

Run the affected focused test first, then every command from Step 3. Commit each valid correction with a message naming the invariant it protects.

- [ ] **Step 7: Publish one draft PR through `github:yeet`**

Confirm all issue-owned changes are committed, push `agent/m1-43-atomic-legacy-migration`, and open a draft PR against `main` using `Closes #43`. Reference #16, #2, #9, #20, and #42. Include problem, design, file changes, exact RED/GREEN/full evidence, CI head, review findings, compatibility/migration behavior, rollback warning, privacy/security, performance/memory, accessibility (none), limitations, and follow-up boundary. Do not merge.

- [ ] **Step 8: Verify current-head GitHub Actions and post the checkpoint**

Inspect every CI job/step on the pushed head. Confirm locked install, lint, unit, integration, Chromium install, and E2E success; confirm failure diagnostics are skipped and no artifact is uploaded. Only then replace `status/in-progress` with `status/review`, post an implementation checkpoint on #43, keep the PR draft/unmerged, and stop the run.
