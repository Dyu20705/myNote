# M1-24 deterministic test toolchain and CI design

## Scope

Issue #24 establishes the repository's first reproducible verification baseline. It adds tooling only: no product behavior, persistence schema, parser semantics, or user-data migration changes.

## Chosen approach

Use a private ESM npm package on Node `>=22.13 <23` with four explicit scripts:

- `lint`: ESLint checks application, test, script, and JavaScript configuration files.
- `test:unit`: Node's built-in test runner executes the governance contract, a Node-compatible wrapper for existing parser invariants, and the static-server security contract.
- `test:integration`: Node's test runner plus `fake-indexeddb` exercises the real storage module using a fresh synthetic database per case.
- `test:e2e`: a cross-platform Node wrapper launches one headless Playwright Chromium project against a local static server, proves create, explicit save, and reload, and removes Playwright output only after success.

This keeps each layer close to the production boundary it verifies: pure modules run in Node, storage uses a standards-compatible in-memory IndexedDB implementation, and the browser journey uses an isolated Playwright context. The alternative of using a browser runner for every suite would add slower execution and duplicate runner configuration; the alternative of mocking storage would fail the issue's real-persistence-boundary requirement.

## Dependencies and configuration

Runtime dependencies remain empty. Development dependencies are limited to ESLint, `fake-indexeddb`, and `@playwright/test`; a repository-owned Node static server avoids an additional supply-chain dependency. `package-lock.json` pins all transitive versions. `package.json` declares `private: true`, `type: module`, `engines.node: >=22.13 <23` (the minimum supported by ESLint 10.8.0), and the verified package manager line `npm@11.7.0`.

The CI workflow uses `permissions: { contents: read }`, `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (official v4.2.2), and `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (official v4.4.0). These are full commit-SHA pins verified through the official GitHub tag references. CI pins Node 22.20.0 within the declared range and installs the `npm@11.7.0` line declared in package metadata. Playwright installs Chromium only. It uses no secrets, personal browser profile, or external application service. Test fixtures use synthetic labels only and assertions do not print note titles or bodies.

`scripts/serve-static.mjs` is the only local server. It binds only to `127.0.0.1:4173` and serves only `/index.html`, `/styles.css`, `/app.js`, and JavaScript below `/core/` or `/ui/`. It rejects dotfiles, repository tooling, other root files, malformed URLs, path traversal, and real paths outside the repository; missing allowlisted assets return 404 without an SPA fallback. Reads are capped at 1 MiB and use a fixed-size buffer, so a growing file cannot produce an unbounded allocation. The server emits a readiness line, fails clearly when the port is occupied, and exits cleanly on `SIGTERM` or `SIGINT`. A Node contract exercises the allowlist, traversal, malformed URL, method, MIME, HEAD, and missing-file behavior. Playwright starts this command with `reuseExistingServer: false`.

## Test boundaries

The existing parser invariant module will be executed through a Node adapter at `tests/unit/parser.invariant.node.test.mjs`. The adapter calls its exported runner without rewriting, duplicating, translating, or weakening any existing assertion.

Integration tests will call `openDatabase`, `putNoteToDb`, `listNotesFromDb`, and `deleteNoteFromDb` directly. The exact failure case is: write one synthetic note successfully, close that `IDBDatabase` handle, call `putNoteToDb` with the closed handle, assert that the promise rejects with the platform's closed-database `InvalidStateError`, reopen the database, and verify that the previously committed note is unchanged. This uses the existing storage function signature and requires no production API seam. The integration suite runs with concurrency `1`; every case closes all handles before cleanup, resets the canonical database name in setup and teardown, waits for deletion success, and turns `onblocked` into a failure instead of hanging.

The E2E test uses only existing UI behavior. It first lets the title's normal autosave reach `Saved locally`. Immediately before the final content edit, it installs and pauses Playwright's page clock. Filling `#contentInput` then queues the production 350 ms debounce but cannot let that timer fire. The test asserts `Unsaved changes`, dispatches a `click` event directly to the existing `#saveButton` so pointer focus and the editor's blur-flush path do not run, and waits for `#saveState` to equal `Saved locally`; that state appears only after `putNoteToDb` resolves and the subsequent search refresh completes. Because time stays paused, the ordinary debounce cannot mask a broken Save-button handler. The journey then reloads and asserts the edited title and synthetic content through the normal UI. The interim assertions prevent bootstrap or the earlier title save from creating a false green. It uses no fixed sleep, direct IndexedDB read, test-only production hook, or new Save control. Playwright provides a clean browser context for the test; the reload assertion proves reload persistence only and does not claim crash or safe-mode recovery.

Playwright uses `retries: 0`, `preserveOutput: failures-only`, `trace: retain-on-failure`, `screenshot: only-on-failure`, `video: off`, and line plus HTML reporters. The `test:e2e` Node wrapper deletes `playwright-report` and `test-results` only when Playwright exits successfully; failures keep both directories for diagnosis. CI uploads those failure directories only when the E2E step fails, with a three-day retention period and an artifact name containing the run ID, never fixture text. It does not upload IndexedDB dumps, browser profiles, or user data.

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
| Static-server safety | Retained allowlist/method/MIME/traversal contract plus bounded reads and canonical containment |
| E2E durability | Paused page clock, direct existing Save-button event, `#saveState` `Saved locally`, then reload UI assertions |
| Clean browser | New Playwright context with no reused storage |
| CI parity | The same four npm scripts locally and in CI |
| Runtime neutrality | Diff audit for behavior and schema drift |
| Privacy | Synthetic fixtures and failure-only safe artifacts |
| Rollback | Revert tooling, configuration, test, documentation, and workflow commits |
