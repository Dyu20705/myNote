# myNote Governance

## Repository purpose

`myNote` is an internal personal-development project. Repository work is planned, implemented, reviewed, and integrated through owner-controlled work packages.

Unsolicited external issues, pull requests, feature proposals, and automated changes are not part of the accepted execution model unless the owner explicitly adopts them.

Closed historical issues and pull requests are retained as audit evidence. Completed records are closed and may be locked, not deleted.

## Authority model

Repository authority is ordered as follows:

1. architecture and technical invariants;
2. accepted product/architecture decisions;
3. the authoritative issue design under `docs/design/issues/`;
4. the approved implementation plan referenced by that design;
5. GitHub issue lifecycle/dependency metadata;
6. accepted visual evidence referenced by the design;
7. runtime code;
8. test and CI evidence.

The issue body is a coordination record once an authoritative design exists. Historical issue prose cannot override the accepted design.

## Work-package relationships

Every executable child records:

- Parent:
- Depends on:
- Blocks:

Relationships are reconciled after integration so downstream readiness is based on current repository state rather than stale prose.

## Lifecycle labels

Use exactly one execution-state label for an executable child:

- `status/blocked` — a direct dependency or required design decision is unresolved;
- `status/ready` — direct dependencies are satisfied and an accepted design exists;
- `status/in-progress` — one implementation branch/package is active;
- `status/review` — implementation is complete enough for owner/reviewer review and the required current-head verification gate is green;
- completed/closed — accepted and integrated according to the package completion rule.

Only one child issue may be `status/in-progress` at a time.

Design/review work may occur while no runtime child is active. A downstream runtime child never starts merely because it is open.

## Branch model

```text
main
  ↑ reviewed release/promotion
  ↑
dev
  ↑
issue/<number>-<bounded-name>
```

- `dev` is the integration branch for reviewed issue work.
- `main` is the release/promotion branch.
- implementation work starts from current `dev`;
- one issue uses one bounded implementation branch and one pull request to `dev`;
- implementation commits are not pushed directly to `dev` or `main`;
- the implementation agent never merges its own pull request.

Owner-maintained governance/design corrections may be committed directly to `dev` when they do not contain runtime implementation and when doing so avoids creating a competing runtime work package.

## Docs-first design gate

A child becomes `status/ready` only after the owner/reviewer has created and accepted an issue design under `docs/design/issues/`.

The design records at minimum:

- goal and user outcome;
- verified baseline;
- product and architecture decisions;
- ownership boundaries;
- state/data flow where relevant;
- in-scope and out-of-scope behavior;
- allowed/forbidden interfaces;
- RED regression contract;
- acceptance criteria;
- failure/recovery behavior;
- security/privacy;
- performance/resource bounds;
- accessibility;
- compatibility/migration;
- rollback;
- verification;
- stop conditions.

Detailed future designs are created just in time. Open future issues do not become implementation-ready by default.

## Implementation contract

The implementation agent must:

1. start from current `dev`;
2. read all authoritative docs in repository order;
3. implement only the active issue;
4. write the required regression evidence;
5. observe genuine RED before runtime changes;
6. make the smallest authorized implementation;
7. run focused and complete verification;
8. inspect the final diff;
9. push the bounded branch;
10. open/update one pull request to `dev`;
11. stop for review.

If an accepted regression is already GREEN, the agent records regression evidence and does not invent a runtime change.

If an unrelated baseline defect blocks the complete gate, the agent reports it and stops instead of silently repairing another owner's subsystem.

## Review and integration

The owner/reviewer decides:

- whether findings are in scope;
- whether the design must change;
- whether a baseline defect needs owner maintenance;
- whether the package advances to `status/review`;
- whether the pull request is accepted/integrated;
- when a downstream package becomes ready.

No P0/P1 correctness, data-integrity, privacy, accessibility, migration, security, or release-claim defect may remain unresolved at a package gate that claims those properties.

## Verification gate

Default complete verification:

```sh
npm ci
npx --no-install playwright install --with-deps chromium
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

A command is PASS only when it actually exits successfully in the claimed environment. Unsupported native environments remain `UNKNOWN — REQUIRES VALIDATION`.

## CI usage and anti-spam policy

Remote CI is a verification gate, not an interactive debugger.

Required behavior:

- run focused/local checks before pushing where the environment permits;
- batch related verified changes before remote push;
- prefer one CI run per review iteration;
- do not create repeated trial commits or empty commits merely to trigger Actions;
- do not repeatedly rerun an unchanged deterministic failure;
- rerun only when the failure is plausibly transient or the tested commit/environment changed;
- use concurrency cancellation already configured by the workflow;
- keep failure artifacts short-lived and bounded;
- do not create duplicate PRs, duplicate automation comments, or label churn.

## Milestones

### M0 — Governance

Repository lifecycle, authority, issue relationships, verification, and review rules.

### M1 — Reliable Core

Local-first persistence, parser/model/state/history, migration, deterministic testing, and failure-safe mutation ordering.

### M2 — Desktop Daily Driver

Board-first desktop Notes/Japanese Notes, centered editing overlay, command/focus/accessibility quality, saved-grid Kanji workflow, resize/zoom resilience, failure/recovery UX, and final evidence gate.

### M3 — Workflows

Accepted higher-level workflows such as Japanese learning expansion only after M2 dependency gates and dedicated data/identity/deletion/export contracts.

### M4 — Scale

Bounded performance, memory, storage, indexes, history, drawings, and long-session behavior using reproducible benchmarks.

### M5 — Advanced Platform

Cross-device, protected-data, remote-trust, optional intelligence, and extension work only after prior milestone gates and dedicated architecture/security decisions.

## Current M2 sequence

```text
completed foundations + saved-grid drawing + board/overlay reconciliation
→ #71 desktop resilience
→ #72 state/recovery UX
→ #73 final desktop release evidence
```

Only direct dependency-safe work advances.

## Completion and rollback

A child closes only after its accepted integration/completion rule is satisfied and downstream relationship/status metadata is reconciled.

Every package must have a bounded rollback. Schema changes require explicit forward/rollback compatibility. Code-only presentation changes must not invent data migrations.
