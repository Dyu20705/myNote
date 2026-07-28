# M1 Canonical Note Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce issue #39's deterministic note ownership contract by rebuilding stale derived projections from final canonical inputs without changing schema, persistence, parser behavior, or UI.

**Architecture:** `core/model.js::normalizeNote` remains the single aggregation boundary. Each call resolves canonical values, invokes `parseDocument(content)` once, preserves normalized tags and existing blocks, rebuilds links/AST/checksum, then builds search material from the final record.

**Tech Stack:** Node.js 22.20.0, npm 11.7.0, ECMAScript modules, `node:test`, `node:assert/strict`, existing parser/model helpers, ESLint 10.8.0, Playwright 1.62.0.

## Global Constraints

- Preserve `UI → Actions → State → Core → Persistence`.
- Preserve valid string content byte-for-byte, including CRLF or CR line endings.
- Call `parseDocument(content)` exactly once per `normalizeNote` execution.
- Preserve public model helper signatures and the existing `hashText` algorithm.
- Preserve incoming tags and existing non-empty blocks; do not infer tag provenance or regenerate existing block IDs.
- Rebuild `links`, `ast`, `checksum`, and `searchBlob`; caller values cannot override them.
- Do not change persistence, database versions, migration, parser, actions/history, search/backlink workers, export, tasks, or UI.
- Add no dependency and perform no automatic or bulk existing-record rewrite.
- Use synthetic fixtures only; do not log full note objects or note bodies.

---

### Task 1: Define the model normalization contract and capture RED

**Files:**
- Create: `tests/unit/model.normalization.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `normalizeNote(note)`, `hashText(text)`, and `buildSearchBlob(note)` from `core/model.js`; `parseDocument(content)` from `core/parser/index.js`.
- Produces: individually named regression tests and an explicit `test:unit` entry for the new file.

- [ ] **Step 1: Create fixed synthetic fixtures and required failing tests**

Use `node:test` and `node:assert/strict`. Define a fully specified base note with fixed ID, timestamps, version, blocks, tags, canonical content, and stale derived fields:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildSearchBlob, hashText, normalizeNote } from "../../core/model.js";
import { parseDocument } from "../../core/parser/index.js";

const fixedBlock = {
  id: "block-39-fixed",
  type: "paragraph",
  content: "Fixed canonical block",
  meta: { synthetic: true },
};

function fixedNote(overrides = {}) {
  return {
    id: "note-39-fixed",
    title: "Canonical title",
    content: "Synthetic body #ContentTag [[Current Link]]",
    blocks: [fixedBlock],
    tags: [" System ", "system", "Manual"],
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-28T01:00:00.000Z",
    pinned: false,
    archived: false,
    links: ["Stale Link"],
    ast: [{ type: "paragraph", text: "Stale AST" }],
    checksum: "deadbeef",
    searchBlob: "stale-search-material",
    version: 7,
    ...overrides,
  };
}
```

Add separate tests whose production mutation targets are clear:

```js
test("normalizeNote rebuilds stale links and search material from current content", () => {
  const normalized = normalizeNote(fixedNote());
  assert.deepEqual(normalized.links, ["Current Link"]);
  assert.equal(normalized.searchBlob.includes("current link"), true);
  assert.equal(normalized.searchBlob.includes("stale link"), false);
});

test("normalizeNote ignores a stale non-empty AST", () => {
  const note = fixedNote();
  assert.deepEqual(normalizeNote(note).ast, parseDocument(note.content).ast);
});

test("normalizeNote ignores a stale checksum", () => {
  const normalized = normalizeNote(fixedNote());
  assert.equal(normalized.checksum, hashText(`${normalized.title}\n${normalized.content}`));
  assert.notEqual(normalized.checksum, "deadbeef");
});

test("normalizeNote hashes the trimmed final title", () => {
  const normalized = normalizeNote(fixedNote({ title: "  Trimmed title  ", checksum: undefined }));
  assert.equal(normalized.title, "Trimmed title");
  assert.equal(normalized.checksum, hashText(`Trimmed title\n${normalized.content}`));
});

test("normalizeNote hashes the Untitled fallback for a blank title", () => {
  const normalized = normalizeNote(fixedNote({ title: "   ", checksum: undefined }));
  assert.equal(normalized.title, "Untitled");
  assert.equal(normalized.checksum, hashText(`Untitled\n${normalized.content}`));
});

test("normalizeNote ignores caller-supplied searchBlob", () => {
  const normalized = normalizeNote(fixedNote({ searchBlob: "malicious stale projection" }));
  assert.equal(normalized.searchBlob, buildSearchBlob(normalized));
  assert.equal(normalized.searchBlob.includes("malicious stale projection"), false);
});
```

- [ ] **Step 2: Add GREEN contract coverage without relying on generated values**

Add individually named tests for:

```js
test("normalizeNote rejects null-like and non-object inputs", () => {
  for (const value of [null, undefined, false, 0, "note"]) {
    assert.equal(normalizeNote(value), null);
  }
});

test("normalizeNote preserves normalized incoming tags and merges parser tags in order", () => {
  const content = "#Parsed\n```txt\n#Hidden\n```\n#After";
  const normalized = normalizeNote(fixedNote({ content, tags: [" System ", "system", "", null, "Manual"] }));
  assert.deepEqual(normalized.tags, ["system", "manual", "parsed", "after"]);
});

test("normalizeNote preserves existing non-empty blocks and IDs", () => {
  const normalized = normalizeNote(fixedNote());
  assert.deepEqual(normalized.blocks, [fixedBlock]);
});

test("normalizeNote generates bounded blocks only when blocks are absent", () => {
  const normalized = normalizeNote(fixedNote({ blocks: undefined, content: "First block\n\nSecond block" }));
  assert.equal(normalized.blocks.length, 2);
  assert.deepEqual(normalized.blocks.map(({ type, content, meta }) => ({ type, content, meta })), [
    { type: "paragraph", content: "First block", meta: {} },
    { type: "paragraph", content: "Second block", meta: {} },
  ]);
  assert.equal(new Set(normalized.blocks.map((block) => block.id)).size, 2);
  assert.equal(normalized.blocks.every((block) => typeof block.id === "string" && block.id.length > 0), true);
});
```

Use a table-driven version test with literal expected values for `7`, `1`, `0`, `-1`, `1.5`, `"2"`, `null`, and a missing version. Add one canonical-field test that preserves fixed identity/timestamps, verifies current Boolean semantics, preserves a CRLF/CR string exactly, and converts non-string content to `""` in a separate case.

Add a fully specified idempotence test:

```js
test("normalizeNote is idempotent for a fully specified note", () => {
  const once = normalizeNote(fixedNote());
  assert.deepEqual(normalizeNote(once), once);
  assert.deepEqual(normalizeNote(fixedNote()), once);
});
```

Add focused hash behavior:

```js
test("hashText is deterministic and changes for the selected canonical fixture", () => {
  assert.equal(hashText("Canonical title\nSynthetic body"), hashText("Canonical title\nSynthetic body"));
  assert.notEqual(hashText("Canonical title\nSynthetic body"), hashText("Changed title\nSynthetic body"));
});
```

- [ ] **Step 3: Add the new file explicitly to `test:unit`**

Update only the existing script value:

```json
"test:unit": "node --test tests/governance.contract.test.mjs tests/unit/model.normalization.test.mjs tests/unit/parser.invariant.node.test.mjs tests/unit/parser.metadata.test.mjs tests/unit/static-server.test.mjs"
```

- [ ] **Step 4: Run targeted RED outside the restricted sandbox**

Run:

```bash
node --test tests/unit/model.normalization.test.mjs
```

Expected current-production failures:

- stale links survive and flow into search material;
- stale non-empty AST survives;
- stale checksum survives;
- fallback checksum hashes the raw incoming title instead of the trimmed or `Untitled` title.

The command must load correctly and fail only on behavioral assertions. Record exit code, total/pass/fail/skip counts, failing test names, actual/expected values, and duration.

- [ ] **Step 5: Commit the RED contract**

```bash
git add package.json tests/unit/model.normalization.test.mjs
git commit -m test:define-canonical-note-normalization-contract
```

### Task 2: Implement the minimal normalization ownership boundary

**Files:**
- Modify: `core/model.js`
- Modify: `docs/INVARIANTS.md`

**Interfaces:**
- Consumes: the public signatures and RED contract from Task 1; one `parseDocument(content)` result.
- Produces: a normalized note with canonical/defaulted fields, compatibility-preserved tags/blocks, and rebuilt links/AST/checksum/searchBlob.

- [ ] **Step 1: Resolve final canonical values before derived values**

Inside `normalizeNote`, after object validation, calculate:

```js
const timestamp = now();
const updatedAt = typeof note.updatedAt === "string" ? note.updatedAt : timestamp;
const title = typeof note.title === "string" && note.title.trim() ? note.title.trim() : "Untitled";
const content = typeof note.content === "string" ? note.content : "";
const parsed = parseDocument(content);
const mergedTags = [...(Array.isArray(note.tags) ? note.tags : []), ...parsed.tags];
```

Do not normalize stored content line endings and do not call any parser helper after `parseDocument`.

- [ ] **Step 2: Rebuild only the approved derived fields**

Construct the note with the existing ID/timestamp/flag/version/block/tag semantics, but use:

```js
title,
content,
links: parsed.links,
ast: parsed.ast,
checksum: hashText(`${title}\n${content}`),
```

Ignore caller `links`, `ast`, `checksum`, and `searchBlob`. After constructing the nearly final object, keep:

```js
normalized.searchBlob = buildSearchBlob(normalized);
```

- [ ] **Step 3: Run targeted GREEN and preserved parser suites**

Run:

```bash
node --test tests/unit/model.normalization.test.mjs
node --test tests/unit/parser.metadata.test.mjs
node --test tests/unit/parser.invariant.node.test.mjs
npm run lint
npm run test:unit
```

Expected: model tests pass; all 18 parser metadata tests and the unchanged browser-oriented adapter remain active; lint and complete unit suite exit `0`.

- [ ] **Step 4: Document the ownership invariant**

Add one bounded section to `docs/INVARIANTS.md` that lists:

- canonical caller-owned fields and action ownership of edits/timestamps/revisions;
- compatibility-preserved tags and non-empty blocks, including missing provenance and random generated block IDs;
- rebuilt links, AST, checksum, and searchBlob;
- one parser aggregation call per normalization;
- checksum as a non-cryptographic change detector;
- no automatic persisted-record rewrite.

Do not document tag provenance, block schema, migration, or cryptographic integrity as solved.

- [ ] **Step 5: Re-run targeted GREEN after documentation and commit**

```bash
node --test tests/unit/model.normalization.test.mjs
npm run lint
npm run test:unit
git diff --check
git add core/model.js docs/INVARIANTS.md
git commit -m fix:rebuild-derived-note-metadata
```

### Task 3: Verify, review, and publish the draft PR checkpoint

**Files:**
- Modify: only files already listed if review exposes an issue inside #39 scope.

**Interfaces:**
- Consumes: completed contract, design, plan, tests, model implementation, and documentation.
- Produces: fresh local evidence, independent review, a pushed branch, draft PR, green current-head CI, and issue #39 in `status/review`.

- [ ] **Step 1: Remove only this worktree's dependencies and run fresh verification**

Resolve and verify the worktree root before deleting its `node_modules`. Then run:

```bash
rm -rf node_modules
npm ci
node --test tests/unit/model.normalization.test.mjs
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
git diff --check main...HEAD
```

Record exact commands, exit codes, pass/fail/skip counts, durations, Node/npm/Playwright/Chromium versions, and new versus pre-existing failures. Run subprocess-spawning suites outside the restricted sandbox if the known Windows `EPERM` sandbox limitation recurs.

- [ ] **Step 2: Perform complete self-review**

Inspect:

```bash
git status --short
git diff --stat main...HEAD
git diff main...HEAD
rg -n "TO[D]O|TB[D]|UNKNOWN — REQUIRES VALIDATION" core tests docs package.json
```

Review correctness, canonical-field preservation, tag/block compatibility, derived ownership, version/checksum semantics, idempotence, one parser aggregation call, schema/persistence/UI exclusion, synthetic fixtures, bounded complexity, ESM compatibility, and rollback. Classify every finding P0–P3 and fix all P0/P1 findings through a new RED/GREEN cycle.

- [ ] **Step 3: Commit any final scoped verification correction**

If self-review changes scoped files, re-run the affected targeted tests and full fresh verification before committing. Do not commit artifacts, personal data, `node_modules`, Playwright results, or unrelated files.

- [ ] **Step 4: Request independent code review**

Dispatch a reviewer with issue #39, the approved design, this plan, base SHA `137e3ddd039b6392712b0e19b7057792e37b46bd`, and current HEAD. Require actual inspection of the diff and report findings by severity. A quota failure, empty response, or implementer self-review is not approval.

Evaluate review feedback against the repository. Apply actionable Critical/Important or P0/P1 findings one at a time with tests; document or fix bounded Minor/P2/P3 findings. After any code change, repeat targeted and full verification.

- [ ] **Step 5: Publish a draft PR**

Stage only the six issue-owned files plus this plan/design, commit any remaining scoped change, push `agent/m1-canonical-note-normalization`, and create a draft PR titled `Define canonical note normalization ownership` against `main`.

The PR must reference parent #16, related #2/#20, completed dependency #37/PR #38, and `Closes #39`. Include the ownership table, intentional changes, preserved behavior, exact RED/GREEN/full evidence, independent-review evidence, no-migration/existing-data behavior, rollback, security/privacy, performance/memory, accessibility, compatibility, limitations, and follow-up boundary. Explicitly deny automatic rewrites, tag provenance, block redesign, checksum security claims, and changes to persistence, workers, backlinks, history, export, tasks, or UI.

- [ ] **Step 6: Verify current-head CI and move issue #39 to review**

Fetch the workflow run for the pushed HEAD. Inspect checkout, setup, clean install, lint, unit, integration, browser installation, and E2E job steps. If any check fails, inspect logs before proposing a fix. Confirm no sensitive artifact is uploaded.

Only after fresh local verification, green current-head CI, independent review, and no P0/P1 finding, replace `status/in-progress` with `status/review` on issue #39. Keep the PR draft and unmerged; leave #16, #2, and #20 open; stop before any next child.
