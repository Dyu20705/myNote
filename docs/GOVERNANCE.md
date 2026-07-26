# myNote Governance Contract

## Authority and scope

This document is the canonical execution contract for the myNote backlog. It governs milestone ordering, child-issue readiness, pull-request evidence, release gates, and rollback discipline. Product and architecture documents remain authoritative for their own domains; when roadmap wording conflicts with this execution sequence, this document controls work ordering.

Each run may advance exactly one independently reviewable child issue. The run ends after a reviewable pull request and checkpoint. It must not merge the pull request, close a parent epic for partial work, or rewrite historical issues.

## Mandatory milestone sequence

Work proceeds in this exact order:

1. M0 — Governance
2. M1 — Reliable Core
3. M2 — Daily Driver
4. M3 — Workflows
5. M4 — Scale
6. M5 — Advanced Platform

A later milestone cannot become active while an earlier milestone has an unmet release gate. Exceptions require a dedicated governance issue that documents the risk, rollback, and explicit owner approval; implementation cannot be hidden inside an unrelated feature PR.

## Release gates

### M0 — Governance

M0 passes when:

- The milestone sequence and issue lifecycle are documented and machine-checkable.
- Child work packages have explicit dependencies, acceptance criteria, verification, risk, and rollback.
- The PR template requires exact command output rather than unsupported claims.
- At least one next work package can be selected deterministically.

### M1 — Reliable Core

M1 passes when:

- The repository has deterministic install, lint, unit, integration, and end-to-end commands.
- CI runs the required commands from a clean checkout.
- Persistence, history, search index, backlinks, parser, worker validation, and recovery invariants have coverage.
- Existing failures are documented and no P0/P1 reliability defect remains open for the release gate.

### M2 — Daily Driver

M2 passes when core create, edit, delete, restore, search, navigation, export, and recovery paths are usable, accessible, and verified without data loss.

### M3 — Workflows

M3 passes when supported organization, capture, templates, tasks, backlinks, and repeatable user workflows meet their acceptance and migration contracts.

### M4 — Scale

M4 passes when checked-in benchmark baselines cover representative datasets, performance budgets are enforced, and history, caches, indexes, workers, and storage have bounded cleanup paths.

### M5 — Advanced Platform

M5 begins only after M1–M4 release gates have passed. Sync, AI, and public Plugin API work is prohibited before the M1–M4 release gates pass. M5 work must additionally define remote trust, privacy, failure isolation, compatibility, and deprecation contracts before implementation.

## Issue hierarchy and lifecycle

The hierarchy is:

```text
Roadmap or milestone epic
└── Child work package
    └── Pull request
```

One child issue maps to one independently reviewable PR. A child issue uses exactly one execution status:

- `status/blocked`: requirements, dependencies, ownership, or verification are incomplete.
- `status/ready`: scope is bounded, acceptance criteria are testable, and all dependencies are complete.
- `status/in-progress`: the child issue is the single selected work package for the current run.
- `status/review`: implementation and required verification are complete and a reviewable PR exists.

Issue closure is separate from execution status. A child issue is not closed merely because code was written; closure follows accepted review and the repository's merge policy. Parent epics remain open until every child and release-gate criterion is complete.

## Readiness and dependency algorithm

Apply `status/ready` only when all of the following are true:

1. The issue identifies one parent roadmap or milestone issue.
2. Goal, scope, and non-goals form one reviewable unit.
3. All dependencies are complete, merged, or explicitly satisfied by immutable repository state.
4. Acceptance criteria are observable and testable.
5. Verification commands are executable or the repository gap is explicitly part of the issue.
6. Migration, data-loss, security, privacy, performance, and rollback risks are stated.
7. The work does not cross a release gate or introduce prohibited M5 capability.
8. The issue has no unresolved `UNKNOWN — REQUIRES VALIDATION` item that blocks safe implementation.

Selection procedure:

```text
find earliest active milestone
→ list open child issues with status/ready
→ discard issues with incomplete dependencies
→ choose highest-impact prerequisite
→ change only that issue to status/in-progress
```

If no child issue qualifies, do not start implementation. Decompose the smallest required parent or create the missing governance work package first.

## Work-package contract

Every child issue must include:

- Goal
- Scope
- Non-goals
- Parent issue
- Dependencies
- Current behavior
- Target behavior
- Acceptance criteria
- Verification plan
- Migration and rollback behavior
- Security and privacy risks
- Performance and memory risks
- Risk level
- Unknowns written as `UNKNOWN — REQUIRES VALIDATION`

A child issue is too large when it spans independently rejectable behaviors, multiple migrations, unrelated architectural boundaries, or more than one reviewable PR. In that case, stop implementation and create smaller child issues with explicit dependency edges.

## Definition of Done

A child work package is ready for review only when all applicable conditions are met:

- The implementation plan is committed under `docs/superpowers/plans/`.
- A failing test was written and RED was observed for the intended reason, unless the issue documents an approved non-code exception.
- Minimal implementation satisfies the acceptance criteria without speculative abstraction.
- Targeted tests and related suites pass.
- Required repository verification commands run with command, exit code, pass/fail count, and existing failures recorded.
- Migration and rollback behavior are verified when applicable.
- Self-review covers correctness, data integrity, architecture invariants, security/privacy, performance/memory, error handling, accessibility, backward compatibility, migration safety, test quality, and documentation.
- Every P0/P1 finding is fixed.
- A reviewable PR references the parent and child issue and includes exact evidence.
- The PR is not merged by the implementation run.

## Risk and rollback policy

Risk levels:

- P0: active or imminent data loss, security compromise, or unrecoverable corruption. Stop feature work.
- P1: serious correctness, privacy, migration, or availability defect. Fix before review completion.
- P2: bounded behavior or process risk with a tested rollback path.
- P3: low-impact documentation, polish, or maintainability risk.

Every work package states a rollback path. Migration work additionally requires backup/export coverage, old-version fixtures, malformed-but-recoverable data coverage, interruption coverage, and proof that existing notes are not rewritten outside the contract.

## Backlog selection procedure

At the beginning of each run:

1. Read the required repository documents, target parent and child issue, related PRs, relevant code/tests, and recent commits.
2. Audit current behavior, target behavior, dependencies, migration/data-loss risks, security/privacy risks, performance risks, and rollback.
3. Identify the earliest milestone whose release gate is not complete.
4. Select exactly one `status/ready` child issue whose dependencies are complete.
5. If no ready issue exists, create or refine governance/decomposition only; do not begin unrelated implementation.
6. Move the selected issue to `status/in-progress`.
7. Plan, implement with TDD, verify, self-review, create a reviewable PR, move the issue to `status/review`, report the checkpoint, and stop.

## Historical issues and superseded plans

Historical roadmap and epic issues are preserved as product context. They are not automatically closed, rewritten, or treated as implementation-ready. Broad specifications, including merged design documents, must be decomposed into milestone-safe child work packages before code is written.

`docs/ROADMAP_PHASE_2.md` remains evidence of the reliability priorities present before this governance contract. Its correctness, security, tooling, and durability work maps primarily to M1 — Reliable Core. It does not authorize feature work that bypasses the mandatory milestone sequence.

## Unknown repository settings

The following settings require direct GitHub repository validation before a work package depends on them:

- Branch protection and required checks: `UNKNOWN — REQUIRES VALIDATION`.
- GitHub milestone objects beyond issue labels: `UNKNOWN — REQUIRES VALIDATION`.
- Required reviewer policy: `UNKNOWN — REQUIRES VALIDATION`.
- Deployment environments and release automation: `UNKNOWN — REQUIRES VALIDATION`.
