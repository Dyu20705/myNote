## Parent and child issues

- Parent issue:
- Child issue:
- Milestone:

## Problem statement

Describe the verified current behavior and the problem this PR resolves.

## Scope

List the behaviors and files intentionally changed.

## Non-goals

List adjacent work explicitly excluded from this PR.

## Architecture decisions

Document boundaries, interfaces consumed/produced, dependency direction, transaction ordering, and material trade-offs.

## File-level summary

| File | Change | Reason |
|---|---|---|
| | | |

## Test commands and actual results

Do not write “tests pass” without exact evidence.

| Command | Exit code | Pass/fail count | Existing failures | Result summary |
|---|---:|---|---|---|
| | | | | |

## Migration and rollback

- Database versions and fixtures tested:
- Existing-data rewrite behavior:
- Backup/export behavior:
- Interruption and recovery behavior:
- Rollback command or revert boundary:

## Security and privacy impact

- Untrusted input and validation:
- Note title/body/content logging:
- Worker or message bounds:
- New trust boundaries:

## Performance impact

- Main-thread work:
- Indexing/backlinks behavior:
- Memory/cache/history bounds:
- Benchmark command and baseline comparison:

## Screenshots

For UI changes, attach before/after screenshots and include keyboard and accessibility states. For non-UI changes, state `Not applicable — no UI change`.

## Known limitations

List bounded limitations that remain after this PR. Do not hide incomplete acceptance criteria here.

## Follow-up issues

Reference separately scoped child issues. Do not place untracked future work in prose.

## Self-review checklist

- [ ] Correctness and deterministic behavior reviewed.
- [ ] Data integrity and persistence ordering reviewed.
- [ ] Architecture invariants preserved.
- [ ] Security and privacy impact reviewed.
- [ ] Performance and memory impact measured or shown not applicable.
- [ ] Error handling and recovery paths reviewed.
- [ ] Accessibility reviewed for UI changes.
- [ ] Backward compatibility reviewed.
- [ ] Migration safety verified when applicable.
- [ ] Test quality includes observed RED and final GREEN evidence.
- [ ] Documentation matches implementation.
- [ ] Every P0/P1 finding is fixed.
- [ ] PR is reviewable and is not being merged by this implementation run.
