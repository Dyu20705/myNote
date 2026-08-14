# <Issue Number> — <Bounded Work Package> Design

## Status

- **Issue:** #<number>
- **Design status:** accepted / draft
- **Implementation target:** `dev`
- **Source commit:** `<sha>`
- **Evidence date:** `YYYY-MM-DD`
- **Parent:** #<number>
- **Depends on:** #<numbers>
- **Blocks:** #<numbers>

## Goal

One sentence describing the bounded outcome.

## User outcome

Describe the observable user result without prescribing an implementation shortcut.

## Current verified baseline

List only behavior verified against the source commit. Include exact files/modules and separate facts from inference.

## Design decisions

State the selected approach and the rejected alternatives that materially constrain implementation.

## Architecture and ownership

Define which existing owner handles each responsibility. State forbidden duplicate authorities explicitly.

## Data / state / presentation flow

```text
intent
→ approved owner
→ state/core boundary
→ persistence when applicable
→ derived presentation
```

State exactly what may and may not mutate canonical data.

## Interaction and presentation contract

Define the accepted UI behavior, focus, keyboard, overflow, responsive/zoom behavior, and transient-surface rules where applicable.

## Failure and recovery contract

Define canonical failure, derived degradation, user-visible state, retry/recovery, and focus/draft preservation.

## In scope

- bounded item

## Non-goals

- explicit exclusion

## Expected files and interfaces

### Expected modifications

- `path`

### Allowed new files

- `path`

### Forbidden interfaces

- explicit interfaces/modules/owners that this package must not change

## RED test contract

List the exact failing behaviors that must be demonstrated before runtime fixes. State which existing tests are extended and which focused test file may be created.

## Implementation sequence

1. RED.
2. Minimal implementation.
3. Focused GREEN.
4. Regression package.
5. Full verification.
6. Diff self-review.

## Acceptance criteria

- [ ] observable criterion

## Security and privacy

State relevant data/logging/untrusted-input boundaries. Use `Not applicable beyond existing invariant` only when genuinely true.

## Performance and resource bounds

State the expected complexity/resource behavior and any benchmark or retained-resource requirement.

## Accessibility

State focus, keyboard, names/states, live-region, zoom, reduced-motion, and unsupported assistive-technology boundaries as applicable.

## Compatibility and unsupported environments

State supported environment and explicit `UNKNOWN — REQUIRES VALIDATION` cases.

## Migration

State `none` when no stored-data migration is allowed. Otherwise define exact versioning/interruption behavior.

## Rollback

Define the independently revertible boundary and any forward-compatibility requirements.

## Verification

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

Add exact focused commands for the issue.

## Manual evidence

List only evidence that automation cannot faithfully establish. Never substitute an emulation for a native-environment claim without saying so.

## Codex stop conditions

Codex must stop and report instead of guessing when:

- a material requirement conflicts with `docs/ARCHITECTURE.md` or `docs/INVARIANTS.md`;
- the design requires a file/interface that does not exist at the source/base commit and no allowed equivalent is stated;
- satisfying the design requires a schema/dependency/framework/roadmap change not explicitly authorized;
- a required acceptance criterion cannot be tested or observed as designed;
- implementation would require expanding into another issue;
- a material `UNKNOWN — REQUIRES VALIDATION` remains unresolved.

## Definition of Done

Define completion as reviewed evidence, not implementation intent.