# AI Delivery Model

## Purpose

This repository separates design authority from implementation execution so runtime work remains deterministic, reviewable, and bounded.

The model is tool-neutral. Repository docs describe roles and contracts rather than vendor/product identities.

## Roles

### Owner + architecture reviewer

Owns:

- product intent;
- architecture;
- UX decisions;
- issue decomposition;
- dependency sequencing;
- authoritative design documents;
- acceptance criteria;
- implementation-plan approval;
- pull-request review;
- integration/release decisions.

### Implementation agent

Owns only:

- reading accepted repository authority;
- writing the specified regression evidence;
- implementing the minimum authorized change;
- running focused/full verification;
- pushing one bounded issue branch;
- opening/updating one pull request to `dev`;
- stopping for review.

It does not redesign the product, reinterpret architecture, expand scope, reprioritize issues, create future work packages, mutate visual design sources, merge, or begin the next issue.

## Authority order

```text
ARCHITECTURE + INVARIANTS
→ accepted product/architecture decisions
→ authoritative issue design
→ approved implementation plan
→ issue tracking metadata
→ accepted visual evidence
→ runtime implementation
→ verification evidence
```

When sources conflict, the higher source wins. A material conflict between authoritative sources is a stop condition for implementation.

## Delivery loop

```text
inspect current dev
→ design next dependency-safe package
→ owner accepts design
→ package becomes ready
→ implementation branch from dev
→ RED/regression evidence
→ minimum GREEN implementation
→ focused + complete verification
→ PR to dev
→ stop
→ owner/reviewer review
→ fix bounded findings
→ accept/integrate
→ reconcile roadmap
→ design next package
```

The repository intentionally avoids detailed speculative designs for distant future work.

## Branch model

```text
main
  ↑ reviewed promotion
  ↑
dev
  ↑
issue/<number>-<bounded-name>
```

`dev` is the integration branch. `main` is the release/promotion branch.

Implementation never commits directly to `dev` or `main`.

Owner-maintained governance/design repair may update `dev` directly when it does not contain runtime implementation and exists solely to restore repository authority/verification consistency.

## Ready gate

A child may become `status/ready` only when:

- direct dependencies are accepted/integrated;
- no conflicting runtime package is active;
- the current `dev` baseline is inspected;
- an authoritative design under `docs/design/issues/` is accepted;
- scope and stop conditions are explicit.

## In-progress gate

When the implementation branch begins, the child becomes the single `status/in-progress` runtime package.

Only one runtime implementation child may be active at a time.

## Review gate

A child becomes `status/review` only after:

- the implementation PR exists against `dev`;
- required focused verification is green;
- the complete current-head repository gate is green;
- environment unknowns are recorded truthfully;
- no unresolved implementation blocker remains.

If the PR is blocked by a pre-existing baseline defect, it remains in progress until the owner/reviewer repairs/reconciles that baseline and the PR is refreshed.

## TDD rule

For behavior changes:

```text
RED
→ verify the failure represents the accepted contract
→ minimum implementation
→ GREEN
→ focused regression
→ complete gate
```

If a new regression assertion is already GREEN on the accepted baseline, record it as regression evidence. Do not alter runtime code merely to produce a failing test.

## Unrelated failures

When verification exposes an unrelated owner defect:

1. preserve exact evidence;
2. classify whether it predates the issue branch;
3. do not widen the implementation PR;
4. report the blocker to the owner/reviewer;
5. keep the package in progress;
6. refresh/reverify after the baseline is repaired or the design is explicitly amended.

## Complete verification

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

A PASS claim requires fresh successful execution. Unavailable native validation remains `UNKNOWN — REQUIRES VALIDATION`.

## CI discipline

Remote CI is a gate, not a development loop.

- run focused/local tests before pushing when possible;
- batch verified changes;
- prefer one remote run per review iteration;
- do not push empty/trial commits to trigger Actions;
- do not repeatedly rerun deterministic failures without a changed cause;
- use targeted reruns only for plausibly transient failures;
- keep artifacts bounded and short-lived;
- rely on workflow concurrency cancellation where configured.

This protects repository signal quality and avoids wasteful automated activity.

## Pull-request contract

The PR records:

- issue;
- authoritative design reference;
- implementation-plan reference;
- base/head SHA;
- changed files;
- RED/regression evidence;
- GREEN/focused results;
- complete-gate results;
- acceptance mapping;
- security/privacy review;
- performance/resource review;
- accessibility review;
- compatibility/environment unknowns;
- migration impact;
- rollback.

After publishing the PR, the implementation agent stops until review feedback arrives.

## Integration rule

The implementation agent never merges. The owner/reviewer decides acceptance, integration into `dev`, and later promotion to `main`.
