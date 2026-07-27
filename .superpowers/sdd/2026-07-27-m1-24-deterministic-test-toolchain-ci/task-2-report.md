# Task 2 report: deterministic Node verification tooling

## Files and commit

- Added `package.json` with the private ESM package contract, Node `>=22 <23`, npm `11.7.0`, and exactly four public verification scripts.
- Added npm 11.7.0-generated `package-lock.json` (lockfile v3; 73 resolved development packages plus the root package).
- Completed `eslint.config.mjs` with ESLint's built-in recommended JavaScript rules and scoped browser, worker, and Node globals.
- Updated `README.md` with the Node 22, `npm ci`, Chromium install, and public verification-command instructions.
- Commit: `build: add deterministic Node verification tooling`.

## Dependencies and lock impact

- `eslint@10.8.0` — MIT — static JavaScript verification; supports Node `^22.13.0`.
- `fake-indexeddb@6.2.5` — Apache-2.0 — IndexedDB implementation used by Node integration tests; supports Node `>=18`.
- `@playwright/test@1.62.0` — Apache-2.0 — Chromium end-to-end test runner; supports Node `>=20`.

All are exact development-dependency pins. `package-lock.json` is 33,454 bytes and records the three direct packages plus their 70 transitive development dependencies with registry URLs and integrity hashes.

## Verification

Run with Node `v22.20.0` and npm `11.7.0`:

- `npm run lint` — exit 0; 0 errors, 0 warnings.
- `npm run test:unit` — exit 0; 4 tests passed, 0 failed.
- `npm run test:integration` — exit 0; 2 tests passed in 1 serial suite, 0 failed.

The unit and integration scripts use quoted Node test-runner globs because passing a directory directly is not supported by Node 22's test runner. The parser assertions were not changed.

## Source lint fixes

None. The only lint adjustment after the first run was adding the existing browser `Blob` and `HTMLElement` globals to `eslint.config.mjs`.

## Concerns

`npm run test:e2e` was not run because it is outside Task 2's required checks. It also remains dependent on the later static-server task and on the documented Chromium installation command; no E2E contract, server, CI, or product behavior was changed here.
