# Issue Design Template

Use this template for the next dependency-safe implementation package. The design is authored and accepted before implementation begins.

## Status

- Issue:
- Design status:
- Implementation target: `dev`
- Runtime baseline SHA:
- Evidence date:
- Parent:
- Depends on:
- Blocks:
- Review authority: owner + architecture reviewer

## Goal

State one bounded product/engineering outcome.

## User outcome

Describe the observable user result without implementation detail.

## Current verified baseline

Record the exact runtime/code/test behavior inspected on the baseline SHA. Separate verified facts from assumptions.

## Design decisions

For each decision record:

- accepted behavior;
- ownership;
- why the boundary exists;
- explicitly rejected alternatives when ambiguity would otherwise remain.

## Architecture and ownership

Preserve repository dependency direction:

```text
UI → Actions → State → Core → Persistence
```

Identify existing canonical owners that must be reused. New ownership requires an explicit architecture decision.

## State/data flow

Document the required flow when the issue changes state, persistence, concurrency, focus, or cross-module coordination.

## In scope

List exact behaviors and interfaces authorized to change.

## Out of scope

List adjacent capabilities that must not be implemented.

## Expected files and interfaces

### Allowed runtime files

List exact files or module boundaries.

### Allowed tests/docs

List exact evidence owners.

### Forbidden boundaries

List modules/interfaces that must not change without an accepted design amendment.

## RED regression contract

Define behavior-first failing assertions before production changes. A test that is already GREEN is valid regression evidence; do not manufacture runtime changes to force RED.

## Implementation sequence

Define minimal RED → GREEN task order. Keep task boundaries independently reviewable.

## Failure and recovery

Specify durable commit points, retryability, data-safety wording, degraded behavior, and stop conditions.

## Security and privacy

State trust boundaries, prohibited content in logs/artifacts, and any network/credential implications.

## Performance and resource bounds

State complexity, memory/listener/timer/cache limits, and benchmark requirements where relevant.

## Accessibility

State keyboard/focus/name/state/announcement/zoom requirements that are in scope.

## Compatibility and migration

State schema/version/environment compatibility. Unsupported environments remain `UNKNOWN — REQUIRES VALIDATION`.

## Rollback

Define a deterministic revert path and any data compatibility constraints.

## Verification

Default complete gate:

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

Add focused commands specific to the issue.

## Acceptance criteria

Use observable checkboxes mapped to automated, measured, or recorded evidence.

## Stop conditions

The implementation agent stops instead of guessing when the accepted design conflicts with architecture/invariants, requires unauthorized scope, or cannot be evidenced in the available environment.

## Completion rule

Define exactly when the issue may move to review, be accepted/integrated, and unblock downstream work.
