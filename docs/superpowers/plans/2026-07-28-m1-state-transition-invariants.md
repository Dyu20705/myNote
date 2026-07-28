# M1 State Transition Invariants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing state, note-patch, command-stack, and history primitives executable, deterministic, failure-safe, and isolated from caller mutation for issue #41.

**Architecture:** Preserve all four public factories and current call sites. Add focused contracts first, restore rejected undo/redo commands to their source stack, and deep-clone bounded history values on ingress and egress; change store or patch production code only if their dedicated tests expose a defect.

**Tech Stack:** Node.js 22.20.0, npm 11.7.0, ECMAScript modules, `node:test`, `node:assert/strict`, ESLint 10.8.0, Playwright 1.62.0.

## Global Constraints

- Base all work on merged `main` SHA `c02391c7500a95848283bdce47c035b76e6c3461` in branch `agent/m1-41-transition-invariants`.
- Preserve `UI -> Actions -> State -> Core -> Persistence` and all public factory names/signatures.
- Preserve command LIFO ordering, default command/operation bound 300, snapshot bound 30, and newest-full-patch bound 120.
- Add no dependency, schema change, migration, persistence, autosave, application/UI, worker, search, backlinks, export, recovery, or async-subscriber change.
- Use synthetic fixtures and do not log note bodies, titles, patches, snapshots, or database payloads.
- No production code change may precede an observed behavioral RED test for that correction.

---

### Task 1: Add the four executable transition contracts and capture RED

**Files:**
- Create: `tests/unit/state.test.mjs`
- Create: `tests/unit/note-patch.test.mjs`
- Create: `tests/unit/command-stack.test.mjs`
- Create: `tests/unit/history.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `createStore(initialState)`, `createNotePatch(previous, next)`, `invertNotePatch(patch)`, `applyNotePatch(note, patch)`, `createCommandStack(limit?)`, and `createHistory(maxEntries?)`.
- Produces: named behavioral tests that distinguish already-correct store/patch behavior from the required command/history defects.

- [ ] **Step 1: Write the store contract**

Use fixed objects and assert literal states:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createStore } from "../../core/state.js";

test("store copies initial state and shallow-merges object and functional patches in order", () => {
  const initial = { count: 1, stable: "kept" };
  const store = createStore(initial);
  initial.count = 99;
  assert.deepEqual(store.getState(), { count: 1, stable: "kept" });
  store.setState({ count: 2 });
  store.setState((state) => ({ count: state.count + 3, added: true }));
  assert.deepEqual(initial, { count: 99, stable: "kept" });
  assert.deepEqual(store.getState(), { count: 5, stable: "kept", added: true });
});

test("store notifies each active subscriber once with committed state and honors unsubscribe", () => {
  const store = createStore({ count: 0 });
  const seen = [];
  const unsubscribe = store.subscribe((state) => seen.push(state.count));
  store.setState({ count: 1 });
  unsubscribe();
  store.setState({ count: 2 });
  assert.deepEqual(seen, [1]);
});
```

- [ ] **Step 2: Write the note-patch contract**

Create fully specified synthetic previous/next notes with a nested `tags` or `blocks` value and an unknown `localOnly` field. Add separate tests proving:

```js
const patch = createNotePatch(previous, next);
assert.deepEqual(applyNotePatch(previous, patch).tags, next.tags);
assert.equal(applyNotePatch(previous, patch).localOnly, previous.localOnly);
assert.deepEqual(applyNotePatch(applyNotePatch(previous, patch), invertNotePatch(patch)).tags, previous.tags);
assert.deepEqual(createNotePatch(previous, previous), []);
```

After creating a patch, mutate nested values in both input notes and assert the patch stays unchanged. After applying or inverting, mutate the returned nested value and assert a fresh application/inversion still matches the original fixed expectation. Reapply the same patch twice and assert structural equality.

Pass a crafted patch containing one allowed `title` operation plus disallowed `id` and `localOnly` operations directly to `applyNotePatch`. Assert only `title` changes. Pass allowed and disallowed operations directly to `invertNotePatch` and assert the inverse contains only the allowed operation. These cases must fail on the baseline before any `notePatch.js` edit.

- [ ] **Step 3: Write command-stack success, bound, and failure contracts**

Use controlled async commands whose `do` and `undo` append literal labels to a log. Cover empty undo/redo returning `false`, successful execute/undo/redo order, new execute invalidating redo, and `createCommandStack(2)` evicting the oldest command so the observed undo log is exactly `['undo-c', 'undo-b']`.

Add the two mandatory retry tests with controlled one-time rejection:

```js
test("undo rejection preserves retryability", async () => {
  const stack = createCommandStack();
  let attempts = 0;
  await stack.execute({ do: async () => {}, undo: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("synthetic undo failure");
  } });
  await assert.rejects(stack.undo(), /synthetic undo failure/);
  assert.equal(stack.canUndo(), true);
  assert.equal(stack.canRedo(), false);
  assert.equal(await stack.undo(), true);
  assert.equal(stack.canRedo(), true);
});

test("redo rejection preserves retryability", async () => {
  const stack = createCommandStack();
  let doAttempts = 0;
  const command = { do: async () => {
    doAttempts += 1;
    if (doAttempts === 2) throw new Error("synthetic redo failure");
  }, undo: async () => {} };
  await stack.execute(command);
  await stack.undo();
  await assert.rejects(stack.redo(), /synthetic redo failure/);
  assert.equal(stack.canUndo(), false);
  assert.equal(stack.canRedo(), true);
  assert.equal(await stack.redo(), true);
  assert.equal(stack.canUndo(), true);
});
```

Also prepare a redo stack, reject a different command's `execute`, and assert both `canUndo()` and `canRedo()` remain exactly as before.

Strengthen undo and redo rejection with three named commands so both source and opposite stacks contain entries. Assert the rejection predicate receives the exact original `Error` object, retry the failed command, then drain the opposite stack and compare the complete literal do/undo log. This must fail if restoration uses the wrong end of either stack, replaces a command, mutates the opposite stack, or wraps the error.

- [ ] **Step 4: Write history isolation, bounds, and compaction contracts**

Record an operation containing both nested non-patch metadata and a nested patch object, mutate the original, and assert retained data is unchanged. Snapshot `{ notes: [{ meta: { version: 1 } }] }`, mutate it, and assert retained snapshot state is unchanged. Mutate nested metadata, patch, and snapshot values from both getters and assert a second getter call returns the retained originals.

Use `createHistory(3)` to record IDs 1 through 4 and assert retained IDs are `[2, 3, 4]`. Add 31 snapshots and assert 30 remain with the first retained marker equal to `2` and the last equal to `31`. Use `createHistory(150)` with 121 one-op patches and assert the oldest patch is `null`, its `patchSize` is `1`, and all newest 120 patches remain arrays.

- [ ] **Step 5: Add all four files explicitly to `test:unit`**

Keep every existing suite and insert:

```json
"test:unit": "node --test tests/governance.contract.test.mjs tests/unit/command-stack.test.mjs tests/unit/history.test.mjs tests/unit/model.normalization.test.mjs tests/unit/note-patch.test.mjs tests/unit/parser.invariant.node.test.mjs tests/unit/parser.metadata.test.mjs tests/unit/state.test.mjs tests/unit/static-server.test.mjs"
```

- [ ] **Step 6: Run and record focused RED outside the Windows sandbox**

Run each exact command:

```bash
node --test tests/unit/state.test.mjs
node --test tests/unit/note-patch.test.mjs
node --test tests/unit/command-stack.test.mjs
node --test tests/unit/history.test.mjs
```

Expected: state passes. Note-patch passes its generated-patch contracts and fails only the two direct crafted-patch whitelist assertions. Command-stack fails only the undo/redo rejection retryability assertions. History fails only ingress/egress nested isolation assertions. Record command, exit code, test name, pass/fail/skip counts, actual/expected result, and duration.

- [ ] **Step 7: Commit the RED contract**

```bash
git add package.json tests/unit/state.test.mjs tests/unit/note-patch.test.mjs tests/unit/command-stack.test.mjs tests/unit/history.test.mjs
git commit -m test:define-transition-invariant-contracts
```

### Task 1A: Enforce the approved note-patch key boundary

**Files:**
- Modify: `core/notePatch.js`
- Test: `tests/unit/note-patch.test.mjs`

**Interfaces:**
- Consumes: the existing private `PATCH_KEYS` list and public `applyNotePatch`/`invertNotePatch` signatures.
- Produces: crafted patches cannot change or invert fields outside the approved key list.

- [ ] **Step 1: Observe crafted-patch RED**

Run `node --test tests/unit/note-patch.test.mjs`. Expected: the direct crafted-patch tests fail because `id` becomes `forged-id` and the inverse retains `localOnly`; all generated-patch contracts pass.

- [ ] **Step 2: Reuse the existing whitelist for apply and invert**

Create `const PATCH_KEY_SET = new Set(PATCH_KEYS)`. Filter inverse operations with `PATCH_KEY_SET.has(op.key)` and skip disallowed operations in the apply loop before assigning `next[op.key]`. Do not export or expand the list.

- [ ] **Step 3: Run focused GREEN**

Run `node --test tests/unit/note-patch.test.mjs`. Expected: all eight tests pass, including the two crafted-patch boundary cases.

- [ ] **Step 4: Commit the bounded review correction**

```bash
git add core/notePatch.js tests/unit/state.test.mjs tests/unit/note-patch.test.mjs tests/unit/command-stack.test.mjs tests/unit/history.test.mjs docs/superpowers/plans/2026-07-28-m1-state-transition-invariants.md
git commit -m fix:enforce-approved-transition-boundaries
```

### Task 2: Preserve command retryability on undo and redo rejection

**Files:**
- Modify: `core/commandStack.js`
- Test: `tests/unit/command-stack.test.mjs`

**Interfaces:**
- Consumes: existing async command shape `{ do(): Promise<void>, undo(): Promise<void> }`.
- Produces: unchanged `execute/undo/redo/canUndo/canRedo` API with source-stack restoration and original-error propagation.

- [ ] **Step 1: Add minimal source-stack restoration**

Wrap only the awaited undo/redo operation:

```js
try {
  await command.undo();
} catch (error) {
  undoStack.push(command);
  throw error;
}
```

Use the symmetric `redoStack.push(command)` around `await command.do()` in `redo`. Do not catch `execute`, change success ordering, add a queue, or alter limits.

- [ ] **Step 2: Run focused GREEN and neighboring command assertions**

Run `node --test tests/unit/command-stack.test.mjs` outside the sandbox. Expected: every command-stack test passes, including both retry attempts and literal LIFO/bound assertions.

- [ ] **Step 3: Commit the command correction**

```bash
git add core/commandStack.js
git commit -m fix:preserve-command-retryability
```

### Task 3: Isolate retained history at ingress and egress

**Files:**
- Modify: `core/history.js`
- Test: `tests/unit/history.test.mjs`

**Interfaces:**
- Consumes: plain structured-cloneable operation and snapshot values.
- Produces: the existing `record/snapshot/getOperations/getSnapshots` API with owned internal values and cloned return values.

- [ ] **Step 1: Add the bounded clone helper and ingress ownership**

Use the same platform/fallback pattern as `core/notePatch.js`:

```js
function deepClone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
```

Change `record` to `const next = deepClone(operation);`. Change snapshot retention to `state: deepClone(state)`. Keep compaction and bounds unchanged.

- [ ] **Step 2: Clone complete getter results**

Return `deepClone(operations)` and `deepClone(snapshots)` instead of shallow array copies. Do not expose a new helper or change timestamps.

- [ ] **Step 3: Run focused GREEN and combined transition suites**

Run:

```bash
node --test tests/unit/history.test.mjs
node --test tests/unit/command-stack.test.mjs
node --test tests/unit/state.test.mjs
node --test tests/unit/note-patch.test.mjs
```

Expected: all tests pass; compaction retains exactly 120 newest full patches, operation metadata/`patchSize` remain intact, and no store/patch production edit is required unless its suite failed earlier.

- [ ] **Step 4: Commit the history correction**

```bash
git add core/history.js
git commit -m fix:isolate-retained-history
```

### Task 4: Document, verify, review, and publish the #41 checkpoint

**Files:**
- Modify: `docs/INVARIANTS.md`
- Modify only previously listed files if review reveals an in-scope defect.

**Interfaces:**
- Consumes: the approved design, RED/GREEN evidence, and final base-to-head diff.
- Produces: authoritative invariant documentation, fresh verification, independent review, dedicated commits, a pushed branch, and one unmerged draft PR closing only #41.

- [ ] **Step 1: Document the authoritative transition/history rules**

Under State Transition and Memory invariants, state that rejected execute does not change either stack; rejected undo/redo restores the command to its source stack and rethrows; successful operations preserve LIFO and bounds; patches preserve non-approved fields and clone nested transition values; history clones on ingress/egress and remains bounded to 300 operations, 30 snapshots, and newest 120 full patches. Do not claim persistence failure safety, concurrency serialization, or listener isolation is solved.

- [ ] **Step 2: Run fresh complete verification outside the sandbox where subprocess creation is required**

```bash
npm ci
node --test tests/unit/state.test.mjs
node --test tests/unit/note-patch.test.mjs
node --test tests/unit/command-stack.test.mjs
node --test tests/unit/history.test.mjs
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
git diff --check origin/main...HEAD
```

Record Node/npm/Playwright/Chromium versions, exact exit codes, pass/fail/skip counts, durations, new versus pre-existing failures, current HEAD, changed files, generated artifacts, and worktree status.

- [ ] **Step 3: Inspect the complete change and self-review**

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD
git log --oneline origin/main..HEAD
rg -n "TO[D]O|TB[D]|UNKNOWN — REQUIRES VALIDATION" core tests docs package.json
```

Classify findings P0-P3 across correctness, mutation isolation, failure atomicity, ordering, retry semantics, compatibility, error propagation, privacy, bounded memory, rollback, and mutation-sensitive tests. Fix every P0/P1 and bounded in-scope P2/P3 one at a time through a new RED/GREEN cycle.

- [ ] **Step 4: Commit documentation or scoped review corrections**

```bash
git add docs/INVARIANTS.md
git commit -m docs:define-transition-and-history-invariants
```

After any production/test correction, rerun affected focused tests and all full verification before committing.

- [ ] **Step 5: Request independent code review**

Invoke `superpowers:requesting-code-review` with issue #41, design path, plan path, base SHA `c02391c7500a95848283bdce47c035b76e6c3461`, current head SHA, and the complete diff. Require P0-P3 findings. Validate each finding against repository evidence, apply valid findings one at a time with TDD, rerun focused/full verification, and leave no unresolved P0/P1.

- [ ] **Step 6: Publish one draft PR with `github:yeet`**

Confirm only issue-owned files are staged/committed, push `agent/m1-41-transition-invariants`, and open a draft PR against `main` titled `Define state transition and history invariants`. The body must use `Closes #41`, reference #16, #2, #20, #39 and PR #40, and report problem, design/ownership decisions, file changes, exact RED/GREEN/full evidence, review findings, no-migration behavior, rollback, security/privacy, performance/memory, accessibility impact, limitations, and #42 as the blocked follow-up.

- [ ] **Step 7: Verify current-head Actions and move #41 to review**

Inspect every CI workflow job/step on the pushed head, confirm install/lint/unit/integration/Chromium/E2E success and that failure diagnostics were not uploaded. Only then replace `status/in-progress` with `status/review`, post an implementation checkpoint on #41, keep the PR draft and unmerged, leave #42/#43 blocked, and stop.
