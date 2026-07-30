> **Internal development only:** unsolicited external pull requests are not accepted.

## Issue relationships

- Parent issue:
- Child issue:
- Depends on:
- Blocks:
- Milestone:

## Problem and scope

Describe the verified current behavior, the bounded problem, the intended outcome, and explicit non-goals.

## Architecture and file summary

| File | Change | Reason |
|---|---|---|
| | | |

Document changed ownership boundaries, interfaces, dependency direction, transaction ordering, and material trade-offs.

## Verification evidence

Do not write “tests pass” without executed evidence.

| Command or check | Exit code | Pass/fail count | Existing failures | Result |
|---|---:|---|---|---|
| `npm run test:content` | | | | |
| `npm run lint` | | | | |
| `npm run test:unit` | | | | |
| `npm run test:integration` | | | | |
| `npm run test:e2e` | | | | |

## Migration, recovery, and rollback

- Database/schema versions and fixtures:
- Existing-data rewrite behavior:
- Interruption and recovery behavior:
- Backup/export behavior:
- Revert or rollback boundary:

## Impact review

- Security and privacy:
- Main-thread and worker performance:
- Memory, cache, history, and listener bounds:
- Accessibility and keyboard behavior:
- Backward compatibility:
- Known limitations:

## Screenshots

For UI changes, include before/after and relevant keyboard, focus, loading, empty, error, and recovery states. Otherwise write `Not applicable — no UI change`.

## Completion checklist

- [ ] Scope matches one child issue and excludes unrelated work.
- [ ] Correctness and deterministic behavior were reviewed.
- [ ] Canonical persistence and data-integrity ordering were reviewed.
- [ ] Architecture invariants are preserved or explicitly updated.
- [ ] Security, privacy, performance, memory, and accessibility impacts were reviewed.
- [ ] Failure, recovery, rollback, and compatibility behavior are explicit.
- [ ] Focused regression tests cover the changed contract.
- [ ] Current-tree documentation matches implementation.
- [ ] No unresolved P0/P1 finding remains.
- [ ] Issue dependencies and downstream blockers are ready to reconcile after merge.