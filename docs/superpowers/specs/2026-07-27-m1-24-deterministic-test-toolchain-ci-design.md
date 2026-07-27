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

Runtime dependencies remain empty. Development dependencies are limited to ESLint, `fake-indexeddb`, Playwright, and a minimal local static-server package. `package-lock.json` pins all transitive versions; `package.json` declares Node 22 and `private: true`.

The CI workflow uses `contents: read`, an immutable checkout action major, Node setup action major, `npm ci`, and the same four scripts. Playwright installs Chromium only. It uses no secrets, personal browser profile, external application service, or data-bearing artifact upload. Test fixtures use synthetic labels only and assertions do not print note titles or bodies.

## Test boundaries

The existing parser invariant module will be made runnable by Node without changing its assertions. Integration tests will call `openDatabase`, `putNoteToDb`, `listNotesFromDb`, and `deleteNoteFromDb` directly, first proving a successful lifecycle and then an aborted/error-path contract supported by IndexedDB. Each test deletes its named synthetic database in setup and cleanup.

The E2E test will serve the repository locally, create one synthetic note, edit it, wait for the visible durable-save state, reload, and assert that the synthetic note still appears. The browser context starts clean and never reuses browser state.

## Failure behavior and rollback

Commands fail fast on lint, test, server, or browser setup failures. No test retries hide a failure. The workflow retains no storage or browser artifacts. Rollback is a clean revert of the package files, lockfile, test harnesses, CI workflow, README instructions, and this documentation; user data is unaffected.

## Acceptance mapping

The plan will include a RED test for the absent package scripts, then add the minimum configuration and tests until each command passes. It will also verify a second clean install after removing `node_modules`, inspect the diff for runtime/schema drift, and record Node/npm/Playwright versions and exact command results in the draft PR.
