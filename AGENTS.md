# Repository Agent Contract

This repository uses a docs-first delivery model. Product intent, architecture, issue design, implementation, review, and integration are separate responsibilities.

## Authority

Read and obey sources in this order:

1. `docs/ARCHITECTURE.md` and `docs/INVARIANTS.md`
2. accepted architecture/product decisions referenced by the active design
3. `docs/design/issues/<issue>-*.md`
4. the approved implementation plan referenced by that design
5. GitHub issue tracking metadata
6. accepted visual evidence referenced by the design
7. current runtime implementation
8. verification evidence

A lower source never overrides a higher source.

## Roles

The owner and architecture reviewer own:

- product decisions;
- architecture;
- UX design;
- issue decomposition;
- roadmap priority;
- acceptance criteria;
- review;
- integration decisions.

The implementation agent owns only:

- reading the accepted contract;
- creating one bounded branch from current `dev`;
- writing the specified tests;
- implementing the minimum change required by the contract;
- running verification;
- opening one pull request to `dev`;
- stopping for review.

The implementation agent must not redesign requirements, reinterpret architecture, expand scope, reprioritize the backlog, create future packages, mutate visual design sources, merge its own pull request, or begin the next issue.

## Branch model

```text
main
  ↑ reviewed release promotion
  ↑
dev
  ↑
issue/<number>-<bounded-name>
```

Implementation always starts from the current `dev` head.

Never push implementation directly to `dev` or `main`.

Pull requests from issue branches target `dev`.

## One active package

Only one runtime implementation package may be active at a time. A ready package becomes active only when implementation begins. Downstream packages remain blocked until their direct dependency is accepted and integrated.

## Required implementation workflow

1. fetch current repository state;
2. verify the exact `dev` head;
3. verify there is no conflicting active package;
4. create one bounded issue branch;
5. read architecture, invariants, delivery model, issue design, and approved plan;
6. create or extend the specified regression evidence;
7. observe genuine RED before changing runtime behavior;
8. implement the minimum authorized change;
9. run focused verification;
10. run the complete repository gate;
11. inspect the entire diff for scope and ownership violations;
12. push once after local verification is complete where practical;
13. open or update one pull request targeting `dev`;
14. stop for owner/reviewer review.

If a required regression is already GREEN on the accepted baseline, record that fact. Do not manufacture runtime changes merely to create a RED result.

## Stop conditions

Stop and report instead of guessing when:

- authoritative sources materially conflict;
- the accepted design requires a boundary forbidden by architecture/invariants;
- satisfying the issue appears to require scope outside the accepted design;
- a runtime fix requires a new canonical owner;
- a required environment is unavailable and equivalence cannot be proven;
- another runtime issue becomes conflicting/active;
- verification reveals an unrelated owner defect.

Unrelated baseline defects are reported to the owner/reviewer. They are not authorization to widen the implementation pull request.

## Architecture invariants

Preserve:

```text
UI → Actions → State → Core → Persistence
```

Do not create duplicate owners for parsing, search, scheduling, commands, review state, drawing state, or persistence.

Canonical persistence succeeds before visible/history success. Derived search/backlink degradation is separate from canonical storage failure.

Kanji saved-grid data remains in its existing canonical relation and is never copied into note Markdown merely for presentation.

## Verification

Unless a narrower accepted design explicitly adds more checks, the complete gate is:

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

Do not claim PASS for a command that was not actually executed successfully.

Environment limitations must be reported as `UNKNOWN — REQUIRES VALIDATION` when direct evidence is unavailable.

## CI and repository hygiene

Use local/focused verification before remote CI.

Do not repeatedly push trial fixes merely to use Actions as a debugger. Batch verified changes and prefer a single remote verification run per review iteration. Re-run a failed workflow only when the failure is plausibly transient or the exact failing condition has changed.

Do not create empty commits, duplicate pull requests, repeated labels/comments, or automated activity with no engineering value.

## Review boundary

A pull request remains unmerged until the owner/reviewer explicitly accepts it. Review findings are classified by severity and owner. The implementation agent fixes only findings inside the assigned contract unless the design is explicitly amended.
