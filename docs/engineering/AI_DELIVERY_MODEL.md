# AI Delivery Model

## Purpose

`myNote` uses a deliberately asymmetric delivery model:

```text
Duy + ChatGPT
Product / Architecture / Design / Review authority
        ↓
accepted repository design documents
        ↓
Codex
implementation-only agent
        ↓
feature branch → pull request → dev
        ↓
Duy + ChatGPT review
        ↓
approved integration
```

The purpose is to keep product reasoning, architecture, issue design, and review under one explicit authority while using Codex only to translate an approved contract into tested code.

This document governs AI-assisted delivery. It does not change runtime architecture, persistence ownership, or product behavior by itself.

## Roles

### Duy — owner

Duy owns final product intent and explicit approval decisions. Only Duy may authorize a release/promotion decision that the repository governance marks as owner-gated.

### ChatGPT — architect and reviewer

ChatGPT owns the design side of the delivery loop:

- inspect current repository and issue state;
- reconcile roadmap and dependency state;
- define product behavior and non-goals;
- define architecture, ownership, data flow, state transitions, and failure behavior;
- define UX and accessibility contracts;
- define security/privacy, performance, compatibility, migration, and rollback boundaries;
- write the authoritative per-issue design document;
- write or update the bounded implementation plan when implementation becomes eligible;
- review Codex pull requests against the accepted design;
- classify findings and request bounded changes;
- design the next dependency-safe work package only after the current review/integration checkpoint is resolved.

ChatGPT must inspect current repository evidence before changing an accepted design. It must not use stale issue text as a substitute for current code, merged pull requests, or current governing documents.

### Codex — implementation-only agent

Codex has one responsibility:

```text
read accepted design
→ implement exactly that design
→ verify
→ open one PR to dev
→ stop
```

Codex may:

- create one bounded implementation branch from `dev`;
- add the RED tests required by the approved plan;
- make the minimum runtime/documentation changes required by the design;
- run focused and full verification;
- self-review the diff for scope violations;
- push the implementation branch;
- open one pull request targeting `dev`;
- record implementation and verification evidence in that pull request.

Codex must not:

- redesign product behavior or architecture;
- reinterpret an intentional design decision into a different solution;
- expand scope or implement adjacent issues;
- create speculative abstractions or future work packages;
- mutate Figma or other design authority;
- reprioritize the backlog;
- change roadmap authority;
- invent acceptance criteria, migration behavior, or canonical ownership;
- introduce a second persistence, search, parser, scheduler, command, drawing, review, or presentation-state authority;
- weaken tests or replace an acceptance requirement with a looser proxy;
- merge a pull request;
- push implementation directly to `dev` or `main`;
- start the next issue after opening the pull request.

If an authoritative requirement is ambiguous, contradictory, unsafe, or impossible under a repository invariant, Codex stops and reports the exact conflicting clauses. `UNKNOWN` means stop and report, not guess.

## Branch model

`dev` is the integration target for Codex implementation pull requests.

```text
main
  ↑
reviewed release/promotion only
  ↑
dev
  ↑
issue/<number>-<bounded-name>
```

Rules:

1. Codex branches from the current `dev` head.
2. One implementation issue maps to one implementation branch and one PR.
3. Codex PRs target `dev`, never `main`.
4. Codex never pushes implementation commits directly to `dev`.
5. `main` receives only explicitly reviewed/promoted integration according to the current release gate and owner decision.
6. Design/governance documents may be maintained directly on `dev` by the architecture authority when no runtime implementation is being claimed.

## Source-of-truth order

For an implementation issue, use this authority order:

```text
1. docs/ARCHITECTURE.md + docs/INVARIANTS.md
2. accepted architecture/product decisions referenced by the issue design
3. docs/design/issues/<issue>-*.md
4. approved implementation plan referenced by that design
5. GitHub issue — tracking, relationships, status, review links
6. accepted Figma nodes — presentation/interaction evidence only where referenced
7. runtime implementation
8. automated/manual verification evidence
```

A GitHub issue body is not a competing implementation specification after it references an authoritative design document. Its role is coordination: goal, relationships, state, design link, PR link, and review disposition.

When a design document conflicts with a mandatory technical invariant, implementation stops until the architecture authority resolves the conflict explicitly.

## Per-issue design contract

Every implementation-ready issue has one authoritative file under:

```text
docs/design/issues/
```

The design must state:

- source commit and evidence date;
- goal and user outcome;
- current verified baseline;
- design decisions and rejected alternatives;
- architecture and ownership boundaries;
- data/state/presentation flow;
- failure and recovery behavior;
- in-scope and non-goals;
- expected files and interfaces;
- RED test matrix;
- implementation sequence;
- acceptance criteria;
- security/privacy considerations;
- performance/resource bounds;
- accessibility and compatibility boundaries;
- migration and rollback impact;
- complete verification gate;
- manual evidence that automation cannot faithfully establish;
- Codex stop conditions.

No placeholder such as `TBD`, `TODO`, or an unresolved material assumption may remain when the issue is marked implementation-ready.

## Delivery loop

The normal loop is:

```text
inspect current dev/main
→ reconcile merged work and issue state
→ design the next dependency-safe issue
→ self-review the design
→ mark the work package ready
→ Codex implementation branch from dev
→ RED → minimal implementation → GREEN
→ full verification
→ PR to dev
→ Codex stops
→ Duy + ChatGPT review
→ request changes or approve
→ integrate according to owner decision
→ reconcile docs/issues
→ design the next work package
```

The project does not pre-design a large speculative implementation tree. Long-term epics may remain open, but detailed implementation design is created just in time for the next dependency-safe package.

## Issue status semantics

Use execution labels only for bounded child work packages:

- `status/blocked` — a dependency, evidence, or explicit owner gate prevents implementation.
- `status/ready` — the authoritative design is complete, dependencies are satisfied, and implementation may be assigned.
- `status/in-progress` — Codex or another explicitly selected implementer is actively executing the one selected package.
- `status/review` — a reviewable implementation PR exists and required pre-review verification has completed to the documented boundary.

Design work by ChatGPT does not itself require an implementation issue to be `status/in-progress`. There may be zero implementation issues in progress while architecture/review work occurs.

Only one bounded runtime implementation issue may be `status/in-progress`.

## Pull-request contract

Every Codex implementation PR must target `dev` and record:

- issue number;
- authoritative design path;
- implementation-plan path when present;
- base and head SHA;
- changed files;
- bounded implementation summary;
- RED evidence;
- GREEN evidence;
- complete verification results;
- acceptance-criteria mapping;
- security/privacy review;
- performance/resource review;
- accessibility review;
- compatibility review;
- migration impact;
- rollback boundary;
- remaining explicit unknowns.

After the PR is opened, Codex stops. It does not merge, start another issue, or independently address review findings until Duy/ChatGPT disposition is provided.

## Review authority

Duy + ChatGPT perform the review phase. Review checks the PR against the authoritative design and current repository invariants rather than rewarding approximate visual similarity or successful tests alone.

Review outcomes are:

- `REQUEST CHANGES` — exact bounded findings are returned to Codex for the same issue/PR;
- `APPROVE` — the implementation satisfies the accepted contract to the documented evidence boundary;
- `BLOCKED` — architecture/design evidence must be resolved before implementation can continue.

Approval does not by itself authorize a `main` merge when a separate owner/release gate exists.

## Verification baseline

Unless an issue explicitly documents a narrower documentation-only gate, implementation work runs:

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

No agent may claim a command passed unless it actually executed successfully in the declared environment.

## Research policy

Research is just in time. Create a bounded research/audit package only when a near-term implementation decision contains a material unknown. Research ends with one explicit `adopt`, `adapt`, `defer`, or `reject` decision.

Historical research issues remain reference material; they are not automatic implementation prerequisites unless the current authoritative design explicitly depends on them.

## Completion rule

This delivery model is operating correctly when a contributor can answer all of these questions unambiguously:

1. Who decides product behavior and architecture? — Duy + ChatGPT.
2. Where is the exact implementation contract? — the referenced `docs/design/issues/...` file.
3. What may Codex decide? — implementation details only inside that contract and repository invariants.
4. Where does Codex open its PR? — `dev`.
5. Who reviews and decides what happens next? — Duy + ChatGPT.
6. When may Codex start another issue? — only after a new issue is explicitly assigned with an accepted design.