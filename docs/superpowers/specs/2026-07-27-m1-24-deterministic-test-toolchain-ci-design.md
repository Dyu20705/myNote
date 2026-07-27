# M1-24 deterministic test toolchain and CI design

## Scope

Issue #24 establishes the repository's first reproducible verification baseline. It adds tooling only: no product behavior, persistence schema, parser semantics, or user-data migration changes.

## Chosen approach

Use a private ESM npm package on Node 22 with four explicit scripts:

- `lint`: ESLint checks application, test, script, and JavaScript configuration files.
- `test:unit`: Node's built-in test runner executes the governance contract and a Node-compatible wrapper for existing parser invariants.
- `test:integration`: Node's test runner plus `fake-indexeddb` exercises the real storage module using a fresh synthetic database per case.
- `test:e2e`: Playwright launches one headless Chromium project against a local static server and proves create, edit, reload, and recovery.

This keeps each layer close to the production boundary it verifies: pure modules run in Node, storage uses a standards-compatible in-memory IndexedDB implementation, and the browser journey uses an isolated Playwright context. The alternative of using a browser runner for every suite would add slower execution and duplicate runner configuration; the alternative of mocking storage would fail the issue's real-persistence-boundary requirement.

## Dependencies and configuration

Runtime dependencies remain empty. Development dependencies are limited to ESLint, `fake-indexeddb`, and `@playwright/test`; a repository-owned Node static server avoids an additional supply-chain dependency. `package-lock.json` pins all transitive versions. `package.json` declares `private: true`, `type: module`, `engines.node: >=22 <23`, and the verified package manager line `npm@11.7.0`.

The CI workflow uses `permissions: { contents: read }`, reviewed major-version tags for checkout and Node setup actions, `npm ci`, and the same four scripts. Those tags are deliberately not described as immutable references. CI uses Node 22 and the `npm@11.7.0` line declared in package metadata. Playwright installs Chromium only. It uses no secrets, personal browser profile, or external application service. Test fixtures use synthetic labels only and assertions do not print note titles or bodies.

`scripts/serve-static.mjs` is the only local server. It binds only to `127.0.0.1:4173`, serves required HTML/CSS/JS/JSON asset MIME types, rejects path traversal and missing files without an SPA fallback, emits a readiness line, fails clearly when the port is occupied, and exits cleanly on `SIGTERM` or `SIGINT`. Playwright starts this command with `reuseExistingServer: false`.

## Test boundaries

The existing parser invariant module will be executed through a Node adapter at `tests/unit/parser.invariant.node.test.mjs`. The adapter calls its exported runner without rewriting, duplicating, translating, or weakening any existing assertion.

Integration tests will call `openDatabase`, `putNoteToDb`, `listNotesFromDb`, and `deleteNoteFromDb` directly. The exact failure case is: write one synthetic note successfully, close that `IDBDatabase` handle, call `putNoteToDb` with the closed handle, assert that the promise rejects with the platform's closed-database `InvalidStateError`, reopen the database, and verify that the previously committed note is unchanged. This uses the existing storage function signature and requires no production API seam. The integration suite runs with concurrency `1`; every case closes all handles before cleanup, resets the canonical database name in setup and teardown, waits for deletion success, and turns `onblocked` into a failure instead of hanging.

The E2E test uses only existing UI behavior. `#saveButton` calls the existing `autosave.flush()` boundary, and `#saveState` changes to `Saved locally` only after `putNoteToDb` resolves (and subsequent search refresh completes) in the existing save path. The journey is create → edit synthetic content → assert `#saveState` is `Unsaved changes` → click `#saveButton` → wait for `#saveState` to equal `Saved locally` using a locator assertion → reload → assert the edited synthetic content through the normal UI. The interim assertion prevents the initial bootstrap value from creating a false green. It uses no fixed sleep, direct IndexedDB read, test-only production hook, or new Save control. A new Playwright context proves reload persistence only; it does not claim crash or safe-mode recovery.

Playwright uses `retries: 0`, `trace: retain-on-failure`, `screenshot: only-on-failure`, and `video: off`. CI uploads only the Playwright report and trace after `failure()`, with a three-day retention period and an artifact name containing a run ID or commit SHA, never fixture text. It does not upload IndexedDB dumps, browser profiles, or user data.

## Failure behavior and rollback

Commands fail fast on lint, test, server, or browser setup failures. No test retries hide a failure. The workflow never retains IndexedDB data, a browser profile, or user data; its only failure-only artifacts are the safe Playwright report and trace defined above. Rollback is a clean revert of the package files, lockfile, test harnesses, CI workflow, README instructions, and this documentation; user data is unaffected.

## Acceptance mapping

The plan will include a RED test for the absent package scripts, then add the minimum configuration and tests until each command passes. Script implementation uses explicit Node scripts and explicit file paths so it works in Windows PowerShell and CI Linux; it uses no shell globs, Unix-only deletion commands, inline shell environment assignment, or background-process syntax. It will verify a second clean install after removing `node_modules`, inspect the diff for runtime/schema drift, and record `node --version`, `npm --version`, `npx playwright --version`, Chromium version, and exact command results in the draft PR.

## Acceptance evidence map

| Acceptance criterion | Planned evidence |
|---|---|
| Reproducible install | `npm ci` twice after deleting `node_modules` |
| Lint coverage | ESLint file matrix for browser, worker, Node/test, and JavaScript configuration files |
| Parser invariants | Existing assertions through the Node adapter |
| Governance contract | Existing `.mjs` contract in `test:unit` |
| Real persistence boundary | `fake-indexeddb` plus real `core/storage.js` |
| Failure behavior | Closed-handle `InvalidStateError`, followed by reopen and committed-record assertion |
| E2E durability | Existing `#saveButton` / `#saveState` flow followed by reload UI assertion |
| Clean browser | New Playwright context with no reused storage |
| CI parity | The same four npm scripts locally and in CI |
| Runtime neutrality | Diff audit for behavior and schema drift |
| Privacy | Synthetic fixtures and failure-only safe artifacts |
| Rollback | Revert tooling, configuration, test, documentation, and workflow commits |
