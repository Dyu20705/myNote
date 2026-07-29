# M1 Failure-Safe Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make canonical note mutations durable before memory/history success and serialize autosave without losing queued editor work.

**Architecture:** Add a narrow lifecycle coordinator for `IndexedDB → memory → derived indexes`; keep DOM orchestration in `app.js`. Replace timer-only autosave with one in-flight promise plus one trailing-work signal while preserving `{ queue, flush }`.

**Tech Stack:** Node.js 22, npm 11, ECMAScript modules, `node:test`, `node:assert/strict`, IndexedDB, existing state/command/history/search/backlink boundaries, ESLint, Playwright.

## Global Constraints

- Preserve `UI → Actions → State → Core → Persistence`.
- Canonical IndexedDB persistence is the mutation commit point.
- Add no dependency, schema version, migration, retry daemon, service worker, sync, or general notification framework.
- Keep `createAutosave({ delayMs, onSave })` and returned `{ queue, flush }` compatible.
- Derived-index failure must not roll back a successful canonical write.
- Use synthetic fixtures and never expose note title/body in errors or diagnostics.
- Draft PR closes only #42 and remains unmerged.

---

### Task 1: Lock autosave concurrency behavior

**Files:**
- Create: `tests/unit/autosave.test.mjs`
- Modify: `core/autosave.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createAutosave({ delayMs, onSave, scheduler? })`.
- Produces: compatible `{ queue(), flush() }` with serialized saves.

- [ ] Write a fake scheduler with deterministic timer/idle execution and controlled promises.
- [ ] Add RED tests proving repeated queue coalescing and that current `flush()` overlaps an in-flight save.
- [ ] Run `node --test tests/unit/autosave.test.mjs`; record the expected overlap failure.
- [ ] Implement one timer, one idle task, one `inFlight` promise, and one `pending` signal.
- [ ] Attach internal rejection handlers without swallowing rejection from awaited `flush()`.
- [ ] Prove work queued during the trailing save remains scheduled.
- [ ] Run focused GREEN and add the file explicitly to `test:unit`.

### Task 2: Enforce canonical persist-before-commit ordering

**Files:**
- Create: `core/noteLifecycle.js`
- Create: `tests/integration/note-lifecycle.failure.test.mjs`
- Modify: `app.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: injected `persistUpsert`, `persistRemove`, `commitUpsert`, `commitRemove`, `updateDerivedUpsert`, and `updateDerivedRemove` callbacks.
- Produces: `createNoteLifecycle(...).upsert(note, context)` and `.remove(id, context)` returning `{ derivedDegraded }`.

- [ ] Add RED integration tests for rejected upsert, rejected delete, DB-success/index-failure, and successful ordered remove.
- [ ] Implement the minimal coordinator: persist; classify/rethrow canonical failure; commit memory; classify/contain derived failure; report success.
- [ ] Wire `app.js` persistence callbacks to `putNoteToDb`/`deleteNoteFromDb`.
- [ ] Move backlink/search updates after the canonical memory commit.
- [ ] Record history only after lifecycle completion.
- [ ] Set `Storage unavailable` only for canonical failure and `Saved locally; search index unavailable` only for derived failure.
- [ ] Add the integration file explicitly to `test:integration`.

### Task 3: Preserve drafts during in-flight saves

**Files:**
- Modify: `app.js`
- Extend: `tests/unit/autosave.test.mjs`
- Extend: `tests/integration/note-lifecycle.failure.test.mjs` only where coordinator behavior is involved.

**Interfaces:**
- Consumes: existing `saveRevision`, editor dirty state, and autosave trailing behavior.
- Produces: no editor overwrite when a newer revision appears during persistence.

- [ ] Increment the save revision when editor input becomes dirty.
- [ ] Capture, rather than increment, the revision at `saveCurrentNote()` start.
- [ ] After durable commit, preserve editor DOM and `dirty` when the captured revision is stale.
- [ ] Render list/backlinks/status without replacing the newer draft.
- [ ] Confirm a later trailing save uses the committed note plus the current editor draft.

### Task 4: Document, verify, review, and publish

**Files:**
- Modify: `docs/INVARIANTS.md`
- Modify only in-scope files when review finds a defect.

- [ ] Document canonical commit ordering, derived degradation, autosave serialization, and draft preservation.
- [ ] Run `node --test tests/unit/autosave.test.mjs`.
- [ ] Run `node --test --test-concurrency=1 tests/integration/note-lifecycle.failure.test.mjs`.
- [ ] Run `node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs`.
- [ ] Run `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, and `git diff --check` from a clean checkout where dependencies are available.
- [ ] Review the complete base-to-head diff for correctness, privacy, compatibility, and scope.
- [ ] Open a draft PR referencing #16, #2, #3, #4, #20, #41 and `Closes #42`; do not merge.