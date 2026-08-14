# myNote Governance

## Project mode

`myNote` is maintained as an internal personal-development project.

- Unsolicited external issues, pull requests, feature requests, and contribution proposals are not accepted.
- Repository issues are the internal source of truth for roadmap relationships, dependency state, review state, and completion evidence.
- Accepted per-issue design documents are the source of truth for exact implementation behavior and boundaries.
- Completed issues and pull requests are preserved as audit evidence; they are closed and may be locked, not deleted.
- The current repository tree uses English for documentation, comments, templates, test descriptions, and user-facing text.
- Tool-specific provenance markers are not stored as runtime product data.

AI-assisted delivery follows `docs/engineering/AI_DELIVERY_MODEL.md`.

## Authority hierarchy

```text
Product direction / owner decisions
        ↓
Roadmap and domain epics
        ↓
Accepted per-issue design document
        ↓
Bounded child work package
        ↓
Implementation plan
        ↓
Implementation PR → dev
        ↓
Duy + ChatGPT review
```

For implementation details, the authority order is:

```text
1. docs/ARCHITECTURE.md + docs/INVARIANTS.md
2. accepted architecture/product decisions referenced by the design
3. docs/design/issues/<issue>-*.md
4. approved implementation plan referenced by that design
5. GitHub issue tracking metadata
6. accepted Figma evidence explicitly referenced by the design
7. runtime implementation
8. automated/manual verification evidence
```

A GitHub issue remains the coordination record. After it links an accepted design, stale or superseded issue prose must not be treated as a competing implementation specification.

## Roles

### Owner / architecture / review

Duy + ChatGPT own:

- product decisions;
- architecture and ownership boundaries;
- per-issue design;
- dependency and issue sequencing;
- acceptance criteria;
- review disposition;
- integration/release decisions.

### Codex implementation role

Codex implements one accepted design, verifies it, opens one PR to `dev`, then stops.

Codex does not own product design, architecture, roadmap sequencing, Figma mutation, issue decomposition, PR merge, or next-issue selection.

## Branch policy

Codex/runtime implementation branches start from current `dev` and target `dev`:

```text
main
  ↑ reviewed promotion/release
  ↑
dev
  ↑
issue/<number>-<bounded-name>
```

Rules:

- one implementation issue = one bounded branch = one PR;
- no Codex implementation push directly to `dev`;
- no Codex implementation directly on `main`;
- no merge by Codex;
- no next issue after PR creation until review/integration disposition.

Design/governance documents may be maintained directly on `dev` by the architecture authority when no runtime completion claim is being made.

## Issue hierarchy

```text
Roadmap
└── Epic or milestone parent
    └── Child work package
        └── Authoritative design
            └── Pull request
```

A child work package represents one independently reviewable change. Parent issues provide context and remain open until every accepted child and completion criterion is satisfied.

## Required relationship fields

Every active bounded child issue states:

- **Parent:** roadmap/epic ownership.
- **Depends on:** issues, pull requests, release gates, or repository contracts required first.
- **Blocks:** downstream work packages.
- **Current status:** one execution status label.
- **Authoritative design:** exact `docs/design/issues/...` path once designed.
- **Implementation PR:** link when created.
- **Review authority:** Duy + ChatGPT.

Exact behavior, architecture, ordered implementation steps, acceptance criteria, verification, migration, rollback, and stop conditions belong in the authoritative design and implementation plan rather than being duplicated across multiple issue bodies.

## Execution status

Use exactly one execution status label on each open bounded child:

- `status/blocked`: a dependency, decision, evidence gate, or higher-priority work package prevents implementation.
- `status/ready`: dependencies are satisfied, an accepted design exists, verification is executable, and implementation may be assigned.
- `status/in-progress`: the single selected implementation work package is actively being implemented.
- `status/review`: implementation is complete to its documented boundary and a reviewable PR exists.

Architecture/design/review work may occur while zero runtime issues are `status/in-progress`.

Only one runtime implementation child may be `status/in-progress` at a time. A maintenance/reliability blocker takes precedence over feature expansion.

Issue closure is separate from execution status. Close a child as `completed` only after its accepted PR is integrated into the required target and required verification is green. Close rejected or obsolete work as `not planned` with a concise reason.

## Milestone sequence

Work proceeds through these product gates:

1. **M0 — Governance**
2. **M1 — Reliable Core**
3. **M2 — Daily Driver**
4. **M3 — Workflows**
5. **M4 — Scale**
6. **M5 — Advanced Platform**

A later milestone does not bypass an unmet earlier release gate. Research may occur early only when it supports a concrete near-term decision; runtime implementation remains dependency-gated.

## Design readiness check

A bounded child becomes `status/ready` only when:

1. Parent, dependencies, and blocked downstream work are explicit.
2. Direct dependencies are merged/accepted according to the current integration target.
3. `docs/design/issues/<issue>-*.md` exists and is accepted.
4. The design contains no material placeholder, contradiction, or unresolved implementation-blocking unknown.
5. Goal, scope, and non-goals form one reviewable unit.
6. Acceptance criteria are observable and testable.
7. RED/focused/full verification paths are defined.
8. Data migration, rollback, security/privacy, performance, memory, accessibility, and compatibility risks are addressed where applicable.
9. The implementation can preserve `docs/ARCHITECTURE.md` and `docs/INVARIANTS.md`, or an explicit architecture decision is part of the approved scope.
10. No other runtime child is already `status/in-progress`.

## Work-package selection

At the start of a work cycle:

1. Inspect current `dev`, `main`, recent merged/integrated PRs, roadmap parents, and candidate children.
2. Reconcile stale checkboxes/labels against current repository evidence.
3. Identify the earliest incomplete milestone/release gate.
4. Select the highest-impact dependency-safe bounded child.
5. Design it completely under `docs/design/issues/`.
6. Self-review the design for placeholders, contradiction, ambiguity, ownership duplication, and scope inflation.
7. Mark it `status/ready` only after the design gate passes.
8. When an implementer is assigned, move only that child to `status/in-progress`.
9. Implement, verify, and open one PR to `dev`.
10. Move to `status/review` only when the PR is reviewable to the documented boundary.
11. Duy + ChatGPT review the PR against the accepted design.
12. Merge/promote only through the current owner/release decision.
13. Reconcile parent/downstream state before designing the next runtime package.

## Just-in-time design and research

Do not pre-create a detailed implementation tree for distant work.

Use:

```text
eligible capability
→ identify material unknowns
→ bounded research/audit only if necessary
→ adopt/adapt/defer/reject
→ complete next issue design
→ implementation
→ review
→ reconcile
```

Historical research issues remain reusable reference material but are not automatic prerequisites unless a current design explicitly depends on them.

## Test-driven implementation

Runtime behavior changes follow:

```text
RED
→ confirm expected failure
→ minimal implementation
→ GREEN
→ focused regression
→ complete verification
→ diff self-review
→ PR to dev
```

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

Documentation-only packages may define a narrower gate when explicitly designed as documentation-only.

## Definition of Done

A work package is complete when all applicable conditions hold:

- acceptance criteria are satisfied without speculative scope expansion;
- focused regression tests cover changed contracts;
- the required verification gate is green;
- migration and rollback behavior are verified where applicable;
- review covers correctness, data integrity, architecture, security/privacy, performance/memory, failure handling, accessibility, compatibility, and documentation;
- no unresolved P0/P1 finding remains;
- the PR references the authoritative design and records exact verification evidence;
- Duy + ChatGPT have reviewed the implementation;
- parent and downstream dependency states are reconciled after accepted integration.

Codex may report a PR as ready for review; it does not declare the work package/release complete.

## Risk levels

- **P0:** active or imminent data loss, security compromise, or unrecoverable corruption. Stop unrelated work.
- **P1:** serious correctness, privacy, migration, availability, accessibility, or release-contract defect. Resolve before completion.
- **P2:** bounded behavior or process risk with a clear rollback.
- **P3:** low-impact documentation, polish, or maintainability risk.

## Issue maintenance

Perform backlog reconciliation after every accepted integration and at each milestone checkpoint:

1. Close accepted completed children when their completion rule is satisfied.
2. Close rejected/superseded work as `not planned` with a reason.
3. Update parent checklists and release-gate evidence.
4. Remove stale status labels and apply one current execution status to each bounded open child.
5. Validate `Depends on` and `Blocks` in both directions.
6. Ensure zero or one runtime child is `status/in-progress`.
7. Ensure implementation-ready issues link one accepted design document.
8. Lock completed conversations when no follow-up is needed.
9. Keep roadmap, governance, design docs, current tree, and repository evidence consistent.

## Completion rule

Governance is healthy when a human or agent can determine, without reconciling competing instructions:

- what product/architecture authority applies;
- which bounded issue is eligible next;
- where its exact implementation contract lives;
- what Codex is allowed to do;
- which branch receives its PR;
- who reviews it;
- what evidence is required before the project proceeds.