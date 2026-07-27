# M1-24 Deterministic Test Toolchain and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give issue #24 a reproducible Node `>=22.13 <23` install, lint, unit, integration, E2E, and CI contract without changing shipped application behavior or persistence schema.

**Architecture:** Node's built-in runner owns unit and integration execution. `fake-indexeddb` provides the IndexedDB standard API to the real `core/storage.js`; one serial test file resets the canonical test database before and after every case. Playwright serves an explicit application-asset allowlist through a repository-owned localhost server and proves the existing Save-button / `#saveState` / reload flow while the ordinary debounce is frozen.

**Tech Stack:** Node 22, npm 11.7.0, ESLint, Node test runner, fake-indexeddb, @playwright/test, Chromium, GitHub Actions.

## Global Constraints

- `package.json` is private ESM with `engines.node: >=22.13 <23` and `packageManager: npm@11.7.0`; runtime dependencies remain empty.
- Public verification scripts are exactly `lint`, `test:unit`, `test:integration`, and `test:e2e`; script commands are Windows and Linux compatible.
- No production runtime, persistence schema, parser behavior, migration, or UI behavior changes.
- Server binds only to `127.0.0.1:4173`; it serves only the application asset allowlist, caps reads at 1 MiB, has no SPA fallback, and rejects traversal, dotfiles, and repository tooling.
- E2E uses one Chromium project, clean context, `retries: 0`, trace retain-on-failure, screenshot only-on-failure, and video off.
- CI has `contents: read`, no secrets, and only uploads safe Playwright evidence after failure for three days.
- Test fixtures are synthetic and test output must not contain personal note content.

---

### Task 1: Capture baseline RED evidence and scaffold failing contracts

**Files:**
- Create: `tests/unit/parser.invariant.node.test.mjs`
- Create: `tests/integration/storage.lifecycle.test.mjs`
- Create: `tests/e2e/persistence.spec.mjs`
- Create: `playwright.config.mjs`
- Create: `scripts/serve-static.mjs`
- Create: `eslint.config.mjs`
- Test: the above files after toolchain configuration exists

**Interfaces:**
- Consumes: `runParserInvariantTests()` from `tests/parser.invariant.test.js`; `openDatabase`, `putNoteToDb`, `listNotesFromDb`, `deleteNoteFromDb` from `core/storage.js`.
- Produces: executable test contracts that require the package scripts, dependencies, local server, and existing save observable.

- [ ] **Step 1: Record absent-toolchain RED**

Run: `npm run test:unit`

Expected: non-zero exit because `package.json` and the required script do not exist. Record the command, exit code, and missing-toolchain reason before any package file is created.

- [ ] **Step 2: Write unit adapter contract**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { runParserInvariantTests } from "../parser.invariant.test.js";

test("existing parser invariants run unchanged under Node", () => {
  assert.equal(runParserInvariantTests(), "Parser invariant tests passed");
});
```

Run: `node --test tests/unit/parser.invariant.node.test.mjs`

Observed baseline: GREEN on Node 22.20.0 because Node syntax-detected the imported `.js` module as ESM, with a `MODULE_TYPELESS_PACKAGE_JSON` warning. This adapter therefore did not supply independent RED evidence; the absent package script, missing `fake-indexeddb`, missing Playwright, and deliberately unimplemented server contract supplied the required toolchain REDs.

- [ ] **Step 3: Write real-storage integration contracts**

```js
test("storage writes, lists, deletes, and removes a synthetic note", async () => {
  const db = await openDatabase();
  await putNoteToDb(db, syntheticNote);
  assert.deepEqual(await listNotesFromDb(db), [syntheticNote]);
  await deleteNoteFromDb(db, syntheticNote.id);
  assert.deepEqual(await listNotesFromDb(db), []);
});

test("closed connection rejects without changing committed data", async () => {
  const db = await openDatabase();
  await putNoteToDb(db, syntheticNote);
  db.close();
  await assert.rejects(() => putNoteToDb(db, replacementNote), { name: "InvalidStateError" });
  const reopened = await openDatabase();
  assert.deepEqual(await listNotesFromDb(reopened), [syntheticNote]);
});
```

Install `fake-indexeddb/auto` before dynamically importing storage. Add reset helpers that await `indexedDB.deleteDatabase`, reject `onblocked`, and close every handle in `beforeEach`/`afterEach`; execute this file with `--test-concurrency=1`.

Run: `node --test tests/integration/storage.lifecycle.test.mjs`

Expected: RED because `fake-indexeddb` is absent.

- [ ] **Step 4: Write E2E contract and server configuration**

```js
test("edited synthetic note survives a save-triggered reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Note title" }).fill("E2E synthetic title");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");
  await page.clock.install();
  await page.clock.pauseAt(Date.now());
  await page.getByRole("textbox", { name: "Note content" }).fill("E2E synthetic body");
  await expect(page.locator("#saveState")).toHaveText("Unsaved changes");
  await page.locator("#saveButton").dispatchEvent("click");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Note content" })).toHaveValue("E2E synthetic body");
});
```

Configure Chromium only, one worker, `retries: 0`, `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, `video: "off"`, and a web server command that runs `scripts/serve-static.mjs` with `reuseExistingServer: false`.

Run: `npx playwright test tests/e2e/persistence.spec.mjs`

Expected: RED because Playwright and the server are absent.

- [ ] **Step 5: Commit the RED contracts**

```bash
git add tests/unit/parser.invariant.node.test.mjs tests/integration/storage.lifecycle.test.mjs tests/e2e/persistence.spec.mjs playwright.config.mjs scripts/serve-static.mjs eslint.config.mjs
git commit -m "test: define deterministic toolchain contracts"
```

### Task 2: Add minimal package, lint, and test execution configuration

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Modify: `eslint.config.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: test files from Task 1.
- Produces: reproducible `npm ci` and four cross-platform public commands.

- [ ] **Step 1: Create package metadata and scripts**

```json
{
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.13 <23" },
  "packageManager": "npm@11.7.0",
  "scripts": {
    "lint": "eslint . --ext .js,.mjs",
    "test:unit": "node --test tests/governance.contract.test.mjs tests/unit/parser.invariant.node.test.mjs tests/unit/static-server.test.mjs",
    "test:integration": "node --test --test-concurrency=1 tests/integration/storage.lifecycle.test.mjs",
    "test:e2e": "node scripts/run-e2e.mjs"
  }
}
```

Add only `eslint`, `fake-indexeddb`, and `@playwright/test` as development dependencies, then generate and retain `package-lock.json` with npm 11.7.0.

- [ ] **Step 2: Configure ESLint by execution environment**

Configure browser globals for `app.js` and `ui/**`, browser worker globals for `core/search.worker.js`, and Node globals for tests, `scripts/**`, and `*.mjs` configuration files. Apply recommended JavaScript rules without disabling rules globally; fix only behavior-preserving violations in files this configuration exposes.

Run: `npm run lint`

Expected: GREEN with every intended repository-owned JavaScript file covered.

- [ ] **Step 3: Run unit and integration GREEN checks**

Run: `npm run test:unit` and `npm run test:integration`

Expected: parser adapter and three governance tests pass; storage lifecycle and closed-handle preservation pass using `fake-indexeddb`.

- [ ] **Step 4: Document the local contract**

Add concise README instructions for Node `>=22.13 <23`, `npm ci`, `npx playwright install --with-deps chromium`, and the four public verification commands.

- [ ] **Step 5: Commit package and test tooling**

```bash
git add package.json package-lock.json eslint.config.mjs tests README.md
git commit -m "build: add deterministic Node verification tooling"
```

### Task 3: Implement the owned localhost static server and pass E2E

**Files:**
- Modify: `scripts/serve-static.mjs`
- Create: `scripts/run-e2e.mjs`
- Modify: `playwright.config.mjs`
- Modify: `tests/e2e/persistence.spec.mjs`
- Create: `tests/unit/static-server.test.mjs`

**Interfaces:**
- Consumes: existing `index.html`, application JS/CSS assets, the existing Save-button handler, and `#saveState`.
- Produces: a fail-closed localhost asset server and a clean Chromium reload-persistence smoke journey with no product code changes.

- [ ] **Step 1: Write and observe the static-server security RED**

Create `tests/unit/static-server.test.mjs` using a child process and real HTTP requests. Cover readiness, HTML/JS MIME types, HEAD, 405/Allow, malformed encoding, missing allowlisted assets, encoded traversal, and 403 responses for `package.json`, the lockfile, `.git`, tests, and scripts.

Run: `node --test tests/unit/static-server.test.mjs`

Expected RED against the initial server: `/package.json` returns 200 instead of the required 403.

- [ ] **Step 2: Implement the smallest safe server and verify GREEN**

Use `node:http`, `node:fs/promises`, `node:path`, and `fileURLToPath`. Decode the request pathname, map `/` to `index.html`, and allow only `/index.html`, `/styles.css`, `/app.js`, and `.js` assets below `/core/` and `/ui/`. Reject every other path with 403. Retain lexical root containment and verify the canonical real path before opening a file. Reject non-files and assets over 1 MiB; read through a fixed 1 MiB-plus-one buffer so growth after `stat` remains bounded. Respond to missing allowlisted assets with 404, and listen on `127.0.0.1:4173`. Print `Static server ready at http://127.0.0.1:4173` only after `listen` succeeds. On `SIGINT` and `SIGTERM`, close the server and exit. Convert `EADDRINUSE` to a clear non-zero error.

Run: `node --test tests/unit/static-server.test.mjs`

Expected: GREEN.

- [ ] **Step 3: Verify timer-isolated Save-button E2E and success cleanup**

Run: `npm run test:e2e`

Expected: one Chromium test passes after the title autosave settles, the Playwright page clock is installed and paused, the final content edit queues but cannot fire the 350 ms debounce, and a directly dispatched click reaches the existing `#saveButton` handler without pointer blur. `#saveState` reports `Saved locally` after persistence and search refresh complete, then reload verifies title and content through the UI. Configure `preserveOutput: failures-only`, trace and screenshots on failure, and line plus HTML reporters. A cross-platform Node wrapper removes `playwright-report` and `test-results` only after exit code 0; a failure retains both directories for CI upload.

- [ ] **Step 4: Commit E2E support**

```bash
git add scripts/serve-static.mjs scripts/run-e2e.mjs playwright.config.mjs tests/e2e/persistence.spec.mjs tests/unit/static-server.test.mjs
git commit -m "test: add persistence reload smoke coverage"
```

### Task 4: Add CI parity and failure-only diagnostics

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `package-lock.json` and all four public npm scripts.
- Produces: pull-request and main-push verification using Node 22.20.0 and Chromium.

- [ ] **Step 1: Write workflow contract**

Create PR and `main` push triggers, `permissions: { contents: read }`, a finite job timeout, reviewed official full-SHA action pins with release comments, Node 22.20.0 setup, `npm ci`, lint, unit, integration, Playwright Chromium installation, and E2E. After E2E failure only, upload `playwright-report` and `test-results` with `retention-days: 3` and an artifact name based on `${{ github.run_id }}`. Do not upload a database, profile, secret, or fixture content.

- [ ] **Step 2: Add a failing workflow contract check if necessary**

If a pure Node contract test is needed to prevent regression of required workflow clauses, write it before implementation and verify RED on the missing clause; otherwise use the reviewed workflow file itself because no existing workflow parser is part of the repository contract.

- [ ] **Step 3: Locally validate workflow syntax and all commands**

Run: `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`

Expected: all commands green; inspect workflow text for exact commands, least permissions, full SHA pins, no secrets, and failure-only artifacts.

- [ ] **Step 4: Commit CI workflow**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add deterministic verification workflow"
```

### Task 5: Final two-clean-install verification and review handoff

**Files:**
- Modify: `.github/pull_request_template.md` only if a repository contract defect is proven; otherwise no change.

- [ ] **Step 1: Clean-install run one**

Delete only this worktree's `node_modules`, then run `npm ci`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e`. Record exit code, test counts, durations, Node/npm/Playwright/Chromium versions, and whether failures are new.

- [ ] **Step 2: Clean-install run two**

Delete the same explicit `node_modules` path, repeat the entire sequence, and record equivalent evidence.

- [ ] **Step 3: Review full branch diff**

Run `git status --short`, `git diff --check`, `git diff --stat main...HEAD`, and `git diff main...HEAD`. Confirm only tooling/tests/CI/docs changed; no schema, migration, runtime behavior, secrets, local paths, artifacts, or unresolved placeholders exist.

- [ ] **Step 4: Publish the reviewable checkpoint**

Push `agent/m1-24-implementation`, create a draft PR against `main` using the repository template, include parents #16/#20 and `Closes #24`, exact RED and both clean-run evidence, dependency/action justification, durability and failure contracts, security review, rollback, and unknown branch settings. Inspect the remote diff and CI. Only after CI is green, replace #24's `status/in-progress` with `status/review`; leave all issues open and do not merge.

## Rollback

Revert the commits that add the package/lockfile, lint configuration, test harnesses, local server, CI workflow, documentation, plan, and specification. No production data or database schema changes, so no migration or user-data recovery procedure is required.
