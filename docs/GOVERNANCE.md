# myNote Governance

## Project mode

myNote is maintained as an internal personal-development project.

- Unsolicited external issues, pull requests, feature requests, and contribution proposals are not accepted.
- Repository issues are the internal source of truth for roadmap, dependency, risk, and completion state.
- Completed issues and pull requests are preserved as audit evidence; they are closed and may be locked, not deleted.
- The current repository tree uses English for documentation, comments, templates, test descriptions, and user-facing text.
- Tool-specific execution artifacts and provenance markers are not stored in the current tree.

## Hierarchy

```text
Roadmap
└── Epic or milestone parent
    └── Child work package
        └── Pull request
```

A child work package represents one independently reviewable change. Parent issues provide context and remain open until every accepted child and completion criterion is satisfied.

## Required relationship fields

Every active child issue states:

- **Parent:** the roadmap or epic that owns the outcome.
- **Depends on:** issues, pull requests, release gates, or repository contracts that must be complete first.
- **Blocks:** downstream work packages that cannot proceed until this issue is complete.
- **Current status:** one execution status label.
- **Ordered steps:** the dependency-safe implementation sequence.
- **Acceptance criteria:** observable completion evidence.
- **Verification:** exact commands and relevant manual checks.
- **Rollback:** the safe revert or recovery boundary.

## Execution status

Use exactly one status label on each open child issue:

- `status/blocked`: a dependency, decision, evidence gate, or higher-priority work package prevents execution.
- `status/ready`: scope is bounded, dependencies are complete, and verification is executable.
- `status/in-progress`: the single selected implementation work package.
- `status/review`: implementation is complete and a reviewable pull request exists.

Only one child issue may be `status/in-progress` at a time. A maintenance or reliability blocker takes precedence over feature expansion.

Issue closure is separate from execution status. Close a child as `completed` only after its accepted pull request is merged and required verification is green on the target branch. Close rejected or obsolete work as `not planned` with a concise reason.

## Milestone sequence

Work proceeds through these product gates:

1. **M0 — Governance**
2. **M1 — Reliable Core**
3. **M2 — Daily Driver**
4. **M3 — Workflows**
5. **M4 — Scale**
6. **M5 — Advanced Platform**

A later milestone does not bypass an unmet earlier release gate. Research may occur early, but runtime implementation remains blocked until its required contracts are complete.

## Readiness check

A child becomes `status/ready` only when:

1. Parent, dependencies, and blocked downstream issues are explicit.
2. Goal, scope, and non-goals form one reviewable unit.
3. Every dependency is merged, closed, or satisfied by immutable current repository evidence.
4. Acceptance criteria are observable and testable.
5. Verification commands exist or creating them is explicitly in scope.
6. Data migration, rollback, security/privacy, performance, memory, and accessibility risks are addressed where applicable.
7. No unresolved `UNKNOWN — REQUIRES VALIDATION` item blocks safe implementation.
8. No other child is already `status/in-progress`.

## Work-package selection

At the start of a work cycle:

1. Read the roadmap, relevant parents, candidate children, recent merged pull requests, and current repository contracts.
2. Reconcile stale checkboxes and labels against current `main` evidence.
3. Identify the earliest incomplete milestone gate.
4. Select the highest-impact prerequisite among eligible `status/ready` children.
5. Change only that child to `status/in-progress`; block conflicting or downstream work.
6. Implement, verify, self-review, and open a draft pull request.
7. Move the issue to `status/review` only after the required CI result is green.
8. Merge only through an explicit owner decision.
9. Close the child as `completed`, update parents and blocked dependents, then lock the completed conversation when no follow-up is required.

## Definition of Done

A work package is complete when all applicable conditions hold:

- Acceptance criteria are satisfied without speculative scope expansion.
- Focused regression tests cover changed contracts.
- `npm run test:content`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run test:e2e` pass where applicable.
- Migration and rollback behavior are verified when applicable.
- Self-review covers correctness, data integrity, architecture, security/privacy, performance/memory, error handling, accessibility, compatibility, and documentation.
- No unresolved P0/P1 finding remains.
- The pull request references the child and parent issues and records exact verification evidence.
- Parent checklists and downstream dependency states are reconciled after merge.

## Risk levels

- **P0:** active or imminent data loss, security compromise, or unrecoverable corruption. Stop unrelated work.
- **P1:** serious correctness, privacy, migration, or availability defect. Resolve before completion.
- **P2:** bounded behavior or process risk with a clear rollback.
- **P3:** low-impact documentation, polish, or maintainability risk.

## Issue maintenance

Perform a backlog reconciliation after every merge and at each milestone checkpoint:

1. Close merged child issues with `completed`.
2. Close rejected or superseded work with `not planned` and a reason.
3. Update parent checklists and release-gate evidence.
4. Remove stale status labels and apply one current status to each open child.
5. Validate `Depends on` and `Blocks` links in both directions.
6. Ensure exactly one child is in progress.
7. Lock completed conversations when no additional action is needed.
8. Keep roadmap, governance, current-tree documentation, and repository evidence consistent.