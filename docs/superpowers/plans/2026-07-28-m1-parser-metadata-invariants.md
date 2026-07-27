# M1 Parser Metadata Invariants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish deterministic parser metadata and fenced-code invariants for issue #37 without changing canonical note ownership or stored data.

**Architecture:** Add one private line-oriented analysis boundary in `core/parser/index.js` that distinguishes metadata-visible Markdown from closed and unclosed fenced code. All six public helpers retain their signatures, while `parseDocument` consumes one shared analysis result to keep aggregate fields consistent and tokenization continues over the complete source.

**Tech Stack:** Node.js `>=22.13 <23`, npm `11.7.0`, Node built-in test runner, ESM JavaScript, existing ESLint and Playwright verification.

## Global Constraints

- Implement only GitHub issue #37 on branch `agent/m1-parser-metadata-invariants` from `main` commit `f2425eeecf3ce38ffdfc81cd09c3c5282d0b837f`.
- Do not modify `core/model.js`, storage, IndexedDB, migrations, search worker/client, backlinks, history, patches, UI/editor, export, tasks, checksum, or note-version semantics.
- Do not add a runtime or development dependency and do not broaden the ASCII tag grammar.
- Preserve `tests/parser.invariant.test.js` and `tests/unit/parser.invariant.node.test.mjs` without deleting, replacing, or weakening assertions.
- Use synthetic fixtures only; do not emit note titles or bodies into CI artifacts.
- Preserve code-content searchability through `tokenize`.

## Baseline Evidence

- `npm ci`: exit 0; 73 packages installed, 74 audited, 0 vulnerabilities; 5.842 s tool wall time.
- `npm run lint`: exit 0; no lint errors; 4.147 s.
- First sandboxed `npm run test:unit`: exit 1; 0 passed/3 failed because every Node test-file worker hit `spawn EPERM`. The same command outside the sandbox isolated this as an environment restriction.
- `npm run test:unit` outside sandbox: exit 0; 5 passed, 0 failed, 0 skipped; TAP duration 616.576 ms.
- `npm run test:integration` outside sandbox: exit 0; 2 passed, 0 failed, 0 skipped; TAP duration 291.244 ms.
- `npm run test:e2e` outside sandbox: exit 0; 1 passed, 0 failed, 0 skipped; Playwright duration 4.2 s.
- Runtime: Node v22.20.0 and npm 11.7.0.

---

### Task 1: Define the parser metadata contract and observe RED

**Files:**
- Create: `tests/unit/parser.metadata.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `parseDocument(value)`, `parseMarkdown(value)`, `extractTags(value)`, `parseWikiLinks(value)`, `extractCodeBlocks(value)`, and `tokenize(value)` from `core/parser/index.js`.
- Produces: individually named behavioral contracts executed explicitly by `npm run test:unit`.

- [ ] **Step 1: Add literal, real-parser tests for input and deterministic helper contracts**

Create `tests/unit/parser.metadata.test.mjs` with `node:assert/strict` and `node:test`. Import all six parser exports. Add individually named tests with hand-derived expected values for:

```js
assert.deepEqual(parseDocument(null), {
  ast: [], tags: [], links: [], codeBlocks: [], tokens: [],
});
assert.deepEqual(parseMarkdown(42), [{ type: "paragraph", text: "42" }]);
assert.deepEqual(tokenize(42), ["42"]);
assert.deepEqual(extractTags("#Beta #alpha #BETA #alpha-two"), ["beta", "alpha", "alpha-two"]);
assert.deepEqual(parseWikiLinks("[[ First ]] [[Second]] [[First]]"), ["First", "Second"]);
```

Call `parseDocument` twice with the same mixed synthetic fixture and assert structural equality. These tests protect null-like coercion, non-string coercion, determinism, explicit normalization, deduplication, and first-seen ordering.

- [ ] **Step 2: Add the four required fenced-code RED tests**

Use separate test names and literal expected values:

```js
const closed = "#outside\n```JS\n#inside [[Hidden]]\n```\n[[Visible]]";
assert.deepEqual(extractTags(closed), ["outside"]);
assert.deepEqual(parseWikiLinks(closed), ["Visible"]);

assert.deepEqual(parseMarkdown("Before\n```js\nconst value = 1;\n```\nAfter"), [
  { type: "paragraph", text: "Before" },
  { type: "paragraph", text: "After" },
  { type: "code", language: "js", text: "const value = 1;\n" },
]);

const unclosed = "#outside\n```txt\n#inside [[Hidden]]";
assert.deepEqual(parseDocument(unclosed).tags, ["outside"]);
assert.deepEqual(parseDocument(unclosed).links, []);
```

The production mutations these tests catch are: scanning full fenced source for tags/links, emitting fence/body paragraphs, and ending metadata exclusion before EOF for an unclosed fence.

- [ ] **Step 3: Add GREEN contract coverage around the same boundary**

Add individually named tests for:

- LF and CRLF producing structurally equal parser output.
- Empty and multiple code blocks, uppercase language normalization, and `txt` default.
- Heading levels 1–6, an ordinary paragraph, and a seven-hash line remaining a paragraph.
- Metadata immediately before and after fences retaining first-seen order.
- `parseDocument` fields equaling each corresponding helper output.
- Tokens containing code identifiers such as `searchable_code` inside closed and unclosed fences.

- [ ] **Step 4: Include the dedicated test explicitly in the unit script**

Change only `scripts.test:unit` in `package.json` to include `tests/unit/parser.metadata.test.mjs` while retaining every existing test file in the command. Do not change dependencies or the lockfile.

- [ ] **Step 5: Run targeted RED and record the intended failures**

Run:

```bash
node --test tests/unit/parser.metadata.test.mjs
```

Expected: exit 1 with assertion failures specifically showing fenced tags/wiki links leaking, fence/body paragraph duplication, and unclosed-fence metadata leakage. Null-like, ordering, determinism, and existing-compatible cases may already pass. Fix any syntax/import/harness error and rerun until RED is behavioral.

- [ ] **Step 6: Commit the RED contract**

```bash
git add tests/unit/parser.metadata.test.mjs package.json
git commit -m "test: define parser metadata invariants"
```

### Task 2: Implement one shared parser analysis pass and reach GREEN

**Files:**
- Modify: `core/parser/index.js`
- Modify: `docs/INVARIANTS.md`

**Interfaces:**
- Consumes: the unchanged six public parser signatures and the RED contract from Task 1.
- Produces: deterministic `{ ast, tags, links, codeBlocks, tokens }` output with fenced metadata isolation and code token searchability.

- [ ] **Step 1: Add source normalization and internal extraction primitives**

Add private functions equivalent to:

```js
function normalizeSource(value) {
  return String(value || "").replace(/\r\n?/g, "\n");
}

function extractTagsFromSource(source) {
  const matches = source.match(/#([a-zA-Z0-9_-]+)/g) ?? [];
  return [...new Set(matches.map((token) => normalizeTag(token.slice(1))).filter(Boolean))];
}

function parseWikiLinksFromSource(source) {
  const matches = source.match(/\[\[([^\]]+)\]\]/g) ?? [];
  return [...new Set(matches.map((token) => token.slice(2, -2).trim()).filter(Boolean))];
}
```

Keep `normalizeTag` private and preserve its ASCII/lowercase behavior.

- [ ] **Step 2: Implement the line-oriented fenced-code scanner**

Scan normalized lines exactly once. Outside a fence, recognize headings and paragraphs and append the original outside line to metadata-visible text. A trimmed line matching `/^```([a-z0-9_-]*)$/i` opens a fence; a trimmed line equal to `"```"` closes it. Inside a fence, collect code lines but never metadata-visible text or paragraph nodes. On close, emit `{ language: (language || "txt").toLowerCase(), code }`; at EOF emit the same shape for an unclosed fence. Preserve LF between body lines and the newline immediately before a closing delimiter, while an unclosed body preserves only newlines present in input.

- [ ] **Step 3: Derive all public helper results from one analysis result**

Create a private `analyzeMarkdown(value)` returning `ast`, `tags`, `links`, `codeBlocks`, and `tokens`. Build AST as ordinary heading/paragraph nodes followed by filtered wiki-link nodes and one code node per scanned block, retaining existing output shapes. Compute tags/links from metadata-visible text and tokens from the complete normalized source. Implement the exported helpers as projections of this result and make `parseDocument` return one `analyzeMarkdown(content)` result rather than calling public helpers repeatedly.

- [ ] **Step 4: Run targeted GREEN and the preserved parser invariant**

Run:

```bash
node --test tests/unit/parser.metadata.test.mjs
node --test tests/unit/parser.invariant.node.test.mjs
```

Expected: every dedicated parser test passes; the unchanged browser-oriented parser invariant adapter passes.

- [ ] **Step 5: Document the parser invariant at the architecture boundary**

Under the Parser Source-of-Truth invariant in `docs/INVARIANTS.md`, state that tag/link metadata excludes closed and unclosed fenced code, fenced code appears once as a code node, and tokenization retains code content for search. Do not document canonical-note normalization or schema ownership changes.

- [ ] **Step 6: Refactor only after GREEN and commit**

Remove duplication inside `core/parser/index.js` only if targeted and unit tests remain green. Then commit:

```bash
git add core/parser/index.js docs/INVARIANTS.md
git commit -m "fix: isolate parser metadata from fenced code"
```

### Task 3: Verify, review, and publish the draft PR checkpoint

**Files:**
- Modify: only files already listed if review finds an issue within #37 scope.

**Interfaces:**
- Consumes: completed parser behavior and documentation from Tasks 1–2.
- Produces: reviewable draft PR against `main`, exact evidence, and issue #37 in `status/review` only after green CI.

- [ ] **Step 1: Run fresh clean verification**

Delete only this worktree's resolved `node_modules`, then run in order:

```bash
npm ci
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
node --test tests/unit/parser.metadata.test.mjs
```

Record command, exit code, passed/failed/skipped counts, duration, Node/npm/Playwright/Chromium versions, and new versus existing failures.

- [ ] **Step 2: Inspect correctness boundaries and the complete diff**

Inspect closed/unclosed fences, LF/CRLF, multiple/empty fences, languages, metadata adjacency/order, AST uniqueness, token searchability, linear-time/bounded-memory behavior, existing consumers, and Node/browser syntax. Run:

```bash
git status --short
git diff --check
git diff --stat main...HEAD
git diff main...HEAD
rg -n "TO[D]O|TB[D]|UNKNOWN — REQUIRES VALIDATION" core tests docs/superpowers docs/INVARIANTS.md package.json
```

Confirm no dependency/lockfile, schema, migration, personal data, artifact, unrelated refactor, consumer ownership, or canonical-normalization change.

- [ ] **Step 3: Request independent code review**

Use `superpowers:requesting-code-review` with base `f2425eeecf3ce38ffdfc81cd09c3c5282d0b837f`, current HEAD, this plan, and issue #37. Fix every Critical/Important finding through a new RED/GREEN cycle; record any accepted Minor/P2/P3 limitation.

- [ ] **Step 4: Commit review fixes and repeat fresh verification**

If review requires changes, commit only scoped fixes, then repeat Step 1 and inspect the final diff again. Do not publish unsupported pass claims.

- [ ] **Step 5: Push and create a draft PR**

Push `agent/m1-parser-metadata-invariants` and create a draft PR against `main`. Include parents #16 and related #2/#20, `Closes #37`, exact behavior change, RED and final evidence, fenced metadata rationale, preserved code token searchability, no migration, rollback, security/privacy/performance analysis, limitations, and explicit canonical-normalization/task non-goals.

- [ ] **Step 6: Inspect CI and move only #37 to review**

Wait for the actual workflow conclusion and inspect failed logs rather than retrying blindly. After local verification and green CI, replace `status/in-progress` with `status/review` on #37. Keep the draft PR unmerged and leave #16, #2, and #20 open.

## Rollback

Revert the parser implementation, dedicated parser unit test, package test-script change, invariant documentation, design, and plan commits. No schema or stored-note migration exists, so no data rollback or user-note rewrite is required.
