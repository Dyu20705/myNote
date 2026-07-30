# Japanese Study Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `myNoteDB` additively to version 2 and provide validated, atomic persistence for Japanese study review metadata without rewriting or enrolling any existing note.

**Architecture:** `core/studyReview.js` owns the exact persisted review-record contract and returns defensive copies. `core/storage.js` owns the v1-to-v2 schema upgrade and all IndexedDB transactions; the upgrade creates only `studyReviews`, while paired note/review mutations share one readwrite transaction. No state, scheduler, parser, or UI behavior changes in this work package.

**Tech Stack:** Browser IndexedDB, ES modules, Node.js 22.20.0, npm 11.7.0, `node:test`, `fake-indexeddb` 6.2.5, ESLint 10.8.0, Playwright 1.62.0.

## Global Constraints

- Keep database name exactly `myNoteDB`; change the schema version from exactly `1` to exactly `2`.
- Keep the `notes` object store name, key path `id`, and indexes `updatedAt`, `pinned`, and `archived` unchanged.
- Create `studyReviews` with key path `noteId` and exactly the indexes `nextReviewAt`, `notebookType`, and `status`.
- The `oldVersion < 2` upgrade branch must not enumerate, read, normalize, update, copy, or rewrite existing notes.
- Existing notes are never automatically enrolled and bootstrap creates no review records.
- Only synthetic fixture data may appear in tests; errors and diagnostics must not include note or review content.
- Preserve the dependency direction `UI -> Actions -> State -> Core services -> Persistence` and add no runtime dependency.
- Keep legacy localStorage migration behavior compatible and preserve its transaction/error identity invariants.
- Use one IndexedDB transaction for every operation that durably changes both `notes` and `studyReviews`.
- Work package #47 must not implement templates, scheduling, parser tasks, dashboard derivation, state/actions, or UI.

---

### Task 1: Lock the study-review record contract with RED tests

**Files:**
- Create: `core/studyReview.js`
- Create: `tests/unit/study-review.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: no application modules.
- Produces: `STUDY_NOTEBOOK_TYPES`, `STUDY_REVIEW_STATUSES`, and `validateStudyReview(review)` returning a new exact-shape record or throwing a content-free `TypeError` with code `INVALID_STUDY_REVIEW`.

- [ ] **Step 1: Add the unit suite to the public unit command**

Insert `tests/unit/study-review.test.mjs` into `scripts.test:unit` in `package.json` so local and CI full verification cannot omit the new contract.

- [ ] **Step 2: Write the failing validation tests**

Create `tests/unit/study-review.test.mjs` with a canonical record:

```js
const VALID_REVIEW = Object.freeze({
  noteId: "note-study-1",
  notebookType: "vocabulary",
  status: "new",
  lastReviewedAt: null,
  nextReviewAt: "2026-07-30T00:00:00.000Z",
  interval: 0,
  ease: 2.5,
});
```

Cover exact defensive-copy output and table-driven rejection of: null/non-object/array values, empty/non-string `noteId`, unknown `notebookType`, unknown `status`, invalid/non-string `nextReviewAt`, invalid non-null `lastReviewedAt`, negative/fractional/non-number `interval`, and `ease` outside `[1.3, 3.0]`. Assert every failure has `name === "TypeError"`, `code === "INVALID_STUDY_REVIEW"`, and a message that does not contain `noteId` or timestamps.

- [ ] **Step 3: Run RED and record the missing-module failure**

Run:

```bash
node --test tests/unit/study-review.test.mjs
```

Expected: exit 1 because `core/studyReview.js` does not exist. Record command, exit code, failing test/module error, actual result, and expected result in the eventual PR evidence.

- [ ] **Step 4: Implement the minimal pure record validator**

Create `core/studyReview.js` with frozen literal enums, strict field checks, a canonical UTC timestamp predicate, and an exact-shape copy:

```js
export const STUDY_NOTEBOOK_TYPES = Object.freeze([
  "vocabulary",
  "kanji",
  "grammar",
  "output",
  "planner",
]);
export const STUDY_REVIEW_STATUSES = Object.freeze(["new", "learning", "review", "suspended"]);

export function validateStudyReview(review) {
  if (!isValidStudyReview(review)) throw createInvalidStudyReviewError();
  return {
    noteId: review.noteId,
    notebookType: review.notebookType,
    status: review.status,
    lastReviewedAt: review.lastReviewedAt,
    nextReviewAt: review.nextReviewAt,
    interval: review.interval,
    ease: review.ease,
  };
}
```

Use `Number.isInteger(interval) && interval >= 0`, `Number.isFinite(ease) && ease >= 1.3 && ease <= 3`, and an explicit ISO-8601 date-time-with-zone grammar plus a finite `Date.parse(value)` result. Accept `Z` and numeric offsets such as `+07:00`; do not silently canonicalize the caller's valid timestamp. Reject arrays and inherited/coerced values; never include record data in errors.

- [ ] **Step 5: Run focused GREEN**

Run:

```bash
node --test tests/unit/study-review.test.mjs
```

Expected: all study-review tests pass, zero failures.

- [ ] **Step 6: Commit the record contract**

```bash
git add core/studyReview.js tests/unit/study-review.test.mjs package.json
git commit -m "feat: define study review persistence contract"
```

### Task 2: Prove additive v1-to-v2 schema safety

**Files:**
- Modify: `core/storage.js`
- Create: `tests/integration/storage.study-reviews.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `validateStudyReview(review)` from Task 1.
- Produces: `openDatabase()` opening schema version 2, `listStudyReviewsFromDb(db)`, and `getStudyReviewFromDb(db, noteId)`.

- [ ] **Step 1: Add the integration suite to the public integration command**

Insert `tests/integration/storage.study-reviews.test.mjs` into `scripts.test:integration` in `package.json`, preserving `--test-concurrency=1`.

- [ ] **Step 2: Write RED tests for fresh v2 and populated-v1 upgrade**

In `tests/integration/storage.study-reviews.test.mjs`, use `fake-indexeddb/auto`, close every handle in `afterEach`, and delete `myNoteDB` between tests. Add a helper that opens version 1 directly, creates the exact existing `notes` store/indexes, and writes a representative note with nested `tags`, `links`, `blocks`, and `ast` values.

Tests must assert:

```js
assert.equal(database.version, 2);
assert.deepEqual([...database.objectStoreNames], ["notes", "studyReviews"]);
assert.deepEqual([...notesStore.indexNames], ["archived", "pinned", "updatedAt"]);
assert.deepEqual([...reviewsStore.indexNames], ["nextReviewAt", "notebookType", "status"]);
assert.deepEqual(await listNotesFromDb(database), [existingV1Note]);
assert.deepEqual(await listStudyReviewsFromDb(database), []);
```

Snapshot the v1 note with `structuredClone` before closing v1 and compare deep equality after `openDatabase()` upgrades it. Instrument `IDBObjectStore.prototype.get`, `getAll`, `put`, and `openCursor` during `onupgradeneeded`; assert none are called for the `notes` store in the `oldVersion === 1` path.

- [ ] **Step 3: Run schema RED**

Run:

```bash
node --test --test-concurrency=1 tests/integration/storage.study-reviews.test.mjs
```

Expected: exit 1 because the database remains version 1 and the study store/read APIs do not exist.

- [ ] **Step 4: Implement existence-guarded schema creation**

Change `DB_VERSION` to `2`, add `STORE_STUDY_REVIEWS = "studyReviews"`, and make `onupgradeneeded` conditional:

```js
request.onupgradeneeded = (event) => {
  const db = request.result;
  if (event.oldVersion < 1 && !db.objectStoreNames.contains(STORE_NOTES)) {
    const store = db.createObjectStore(STORE_NOTES, { keyPath: "id" });
    store.createIndex("updatedAt", "updatedAt");
    store.createIndex("pinned", "pinned");
    store.createIndex("archived", "archived");
  }
  if (event.oldVersion < 2 && !db.objectStoreNames.contains(STORE_STUDY_REVIEWS)) {
    const store = db.createObjectStore(STORE_STUDY_REVIEWS, { keyPath: "noteId" });
    store.createIndex("nextReviewAt", "nextReviewAt");
    store.createIndex("notebookType", "notebookType");
    store.createIndex("status", "status");
  }
};
```

Add readonly `getAll`/`get` APIs that return defensive exact-shape review copies through `validateStudyReview`; an invalid persisted record must reject without rewriting it.

- [ ] **Step 5: Run focused schema GREEN and migration neighbors**

Run:

```bash
node --test --test-concurrency=1 tests/integration/storage.study-reviews.test.mjs
node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.source-change.test.mjs
```

Expected: all tests pass. Existing migration outcomes and exact source-preservation tests remain unchanged except assertions that explicitly inspect database version/schema.

- [ ] **Step 6: Commit the additive schema**

```bash
git add core/storage.js tests/integration/storage.study-reviews.test.mjs package.json
git commit -m "feat: add isolated study review store"
```

### Task 3: Add validated review IO and atomic paired mutations

**Files:**
- Modify: `core/storage.js`
- Modify: `tests/integration/storage.study-reviews.test.mjs`

**Interfaces:**
- Consumes: Task 1 validation and Task 2 store constants/read APIs.
- Produces: `putStudyReviewToDb(db, review)`, `putJapaneseNoteWithReviewToDb(db, note, review)`, `deleteNoteWithReviewFromDb(db, noteId)`, and `restoreNoteWithReviewToDb(db, note, review)`.

- [ ] **Step 1: Write RED tests for valid IO and preflight rejection**

Add tests proving:

- `putJapaneseNoteWithReviewToDb` adds a valid note and exact defensive review copy without overwriting an existing key.
- `getStudyReviewFromDb` returns `undefined` for a missing key.
- `putStudyReviewToDb` updates an existing review but rejects a missing record with a content-free error code `STUDY_REVIEW_NOT_FOUND`; it cannot create an orphan.
- mismatched `note.id`/`review.noteId`, invalid note IDs, and every invalid review category reject before opening a transaction.
- a note-ID or review-ID collision rejects and preserves both pre-existing records exactly.
- caller mutation after `put` and mutation of returned list/get values cannot change the durable record.

- [ ] **Step 2: Run IO RED**

Run the focused integration file. Expected: exit 1 because the write APIs are missing.

- [ ] **Step 3: Implement validated review update and atomic pair creation**

Validate/clone all arguments before `db.transaction`. For single-record rating updates, use a `studyReviews` readwrite transaction, first `get(noteId)`, reject missing records with a bounded error, then `put(validatedReview)`. For pair creation, require a plain note with a non-empty string ID equal to `review.noteId`, then queue both adds in one transaction so a collision aborts instead of overwriting data:

```js
const tx = db.transaction([STORE_NOTES, STORE_STUDY_REVIEWS], "readwrite");
const done = transactionDone(tx);
try {
  tx.objectStore(STORE_NOTES).add(note);
  tx.objectStore(STORE_STUDY_REVIEWS).add(validatedReview);
  await done;
} catch (error) {
  abortTransaction(tx);
  await done.catch(() => {});
  throw error;
}
```

Keep synchronous queue errors and asynchronous request errors content-free and preserve original error identity through `transactionDone`.

- [ ] **Step 4: Run IO GREEN**

Run the focused integration file. Expected: all valid IO, missing-record, validation, defensive-copy, and atomic-create tests pass.

- [ ] **Step 5: Write RED tests for delete/restore and rollback**

Add tests proving:

- enrolled delete returns the exact captured review and removes both records;
- generic delete returns `undefined` and removes only the ordinary note;
- restore writes the exact note/review pair;
- a synchronous failure on the second store operation aborts create, delete, and restore, leaving both stores deep-equal to their before snapshot;
- a scheduled transaction abort after requests are queued rejects only after terminal abort and leaves no partial durable state.

Patch `IDBObjectStore.prototype.put`/`delete` only inside `try/finally`, discriminate with `this.name`, and always restore prototypes before assertions that reopen the database.

- [ ] **Step 6: Run atomicity RED**

Run the focused integration file. Expected: delete/restore exports are missing and rollback assertions fail.

- [ ] **Step 7: Implement delete capture and exact restore in one transaction**

For delete, request the review from `studyReviews`, clone it if present, queue deletion from both stores, await transaction completion, then return the captured copy. For restore, validate IDs/review before starting the transaction and queue exact note/review puts in the shared transaction. Centralize only the small abort-and-settle pattern; do not build a generic repository abstraction.

- [ ] **Step 8: Run atomicity GREEN and all storage neighbors**

Run:

```bash
node --test --test-concurrency=1 tests/integration/storage.study-reviews.test.mjs
node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.source-change.test.mjs
```

Expected: every test passes, with zero partial records after injected failures.

- [ ] **Step 9: Commit atomic persistence**

```bash
git add core/storage.js tests/integration/storage.study-reviews.test.mjs
git commit -m "feat: persist study note pairs atomically"
```

### Task 4: Align invariants and run complete verification

**Files:**
- Modify: `docs/INVARIANTS.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/superpowers/plans/2026-07-30-japanese-study-persistence.md`

**Interfaces:**
- Consumes: final Task 1–3 behavior.
- Produces: authoritative schema/data-safety/rollback documentation and recorded plan completion.

- [ ] **Step 1: Update persistence invariants**

Replace the obsolete invariant that fixes the database at version 1 with exact v2 rules: additive-only upgrade, unchanged `notes` schema/records, no bootstrap enrollment, strict review validation, single-store review updates, paired cross-store atomicity, orphan-preserving reads, and rollback/old-code forward-data boundary. Update architecture ownership to name `studyReviews` as isolated metadata linked only by `noteId`.

- [ ] **Step 2: Run focused and full verification outside the process-restricted sandbox**

Run exactly:

```bash
npm ci
node --test tests/unit/study-review.test.mjs
node --test --test-concurrency=1 tests/integration/storage.study-reviews.test.mjs
node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.test.mjs
node --test --test-concurrency=1 tests/integration/storage.migration.source-change.test.mjs
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
git diff --check origin/main...HEAD
```

Expected: every command exits 0; record exact counts/durations, Node/npm/Playwright/Chromium versions, and distinguish the already-diagnosed sandbox-only `spawn EPERM` from repository results.

- [ ] **Step 3: Inspect scope and cleanliness**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
git log --oneline origin/main..HEAD
```

Expected: only #47 plan/docs, `core/studyReview.js`, `core/storage.js`, `package.json`, and the two new/updated focused tests are changed; no generated browser artifacts or note-content fixtures remain.

- [ ] **Step 4: Self-review the plan and implementation**

Check spec coverage, placeholder scan, signature consistency, schema/index exactness, upgrade no-read/no-write proof, transaction terminal settlement, error identity, defensive copies, malformed persisted data, privacy, performance, rollback, and no accidental #48 behavior. Fix each valid finding with a focused RED test before production changes.

- [ ] **Step 5: Commit documentation and verification record**

```bash
git add docs/INVARIANTS.md docs/ARCHITECTURE.md docs/superpowers/plans/2026-07-30-japanese-study-persistence.md
git commit -m "docs: define Japanese study persistence invariants"
```

- [ ] **Step 6: Hand the verified branch back for independent review**

Report issue #47, approved design, this plan, base SHA `8ea579d95d8d57a0b470c3c9ae58e1f772a97b7b`, final head SHA, complete verification, and concerns to the controller. The controller owns independent whole-branch review, any reviewed fix wave, final re-verification, and publication through `github:yeet`. The controller will publish branch `codex/japanese-47-study-persistence` as one draft PR containing `Closes #47`, keep #48–#52 blocked, and stop after current-head CI succeeds and #47 moves to `status/review`.
