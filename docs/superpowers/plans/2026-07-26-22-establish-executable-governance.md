# M0 Issue #22 Executable Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a machine-checkable governance contract so each future run selects one dependency-safe `status/ready` child issue and produces one independently reviewable pull request.

**Architecture:** Governance remains repository metadata and documentation only. `docs/GOVERNANCE.md` is the canonical human-readable lifecycle and release-gate contract; GitHub issue and PR templates enforce the contract at contribution boundaries; a Node built-in contract test prevents accidental removal of required clauses without introducing the M1 package/CI toolchain early.

**Tech Stack:** Markdown, GitHub Issue Forms YAML, GitHub pull request template Markdown, Node.js built-in `node:test`, `node:assert/strict`, and `node:fs`.

## Global Constraints

- Mandatory milestone order: M0 — Governance, M1 — Reliable Core, M2 — Daily Driver, M3 — Workflows, M4 — Scale, M5 — Advanced Platform.
- Do not implement Sync, AI, or a public Plugin API before M1–M4 release gates pass.
- Preserve dependency direction: `UI -> Actions -> State -> Core -> Persistence`.
- Do not modify application runtime files, IndexedDB schema, user notes, migrations, search, backlinks, history, or rendering behavior.
- Do not close parent epic #20 or any historical issue.
- Do not add a package manager, third-party dependency, CI workflow, or feature abstraction in M0 issue #22.
- Verification output must include exact commands and exit codes.
- Unknown repository settings remain `UNKNOWN — REQUIRES VALIDATION` rather than being inferred.

---

## File Map

- Create `docs/GOVERNANCE.md`: canonical milestone ordering, release gates, issue states, dependency readiness, Definition of Done, risk classification, rollback rules, and backlog selection algorithm.
- Modify `README.md`: add a discoverable link to the canonical governance contract without changing product behavior.
- Create `.github/ISSUE_TEMPLATE/work-package.yml`: required child-work-package fields and checkboxes.
- Create `.github/pull_request_template.md`: mandatory PR evidence contract.
- Create `tests/governance.contract.test.mjs`: deterministic repository contract test using only Node built-ins.

## Interfaces

### Consumed

- Existing architecture contract in `docs/ARCHITECTURE.md`.
- Existing invariants in `docs/INVARIANTS.md`.
- Existing security model in `docs/SECURITY_MODEL.md`.
- Existing performance budget in `docs/PERFORMANCE_BUDGET.md`.
- Existing Phase 2 reliability priorities in `docs/ROADMAP_PHASE_2.md`.
- Parent roadmap issue #20 and child issue #22.

### Produced

- Canonical governance clauses consumed by maintainers and future AI agents.
- GitHub issue-form fields for `Goal`, `Scope`, `Non-goals`, `Dependencies`, `Acceptance criteria`, `Verification plan`, `Migration and rollback`, `Security and privacy`, `Performance`, and `Risk level`.
- PR sections for parent/child issue, problem, scope/non-goals, architecture, file summary, exact verification, migration/rollback, security/privacy, performance, screenshots, limitations, and follow-ups.
- `node --test tests/governance.contract.test.mjs` as the direct M0 verification command.

---

### Task 1: Add the failing governance contract test

**Files:**
- Create: `tests/governance.contract.test.mjs`

**Interfaces:**
- Consumes: repository-relative file paths.
- Produces: deterministic assertions over governance documentation and templates.

- [ ] **Step 1: Write the failing test**

Create a Node built-in test that reads these files from repository root:

```js
const REQUIRED_FILES = [
  "docs/GOVERNANCE.md",
  ".github/ISSUE_TEMPLATE/work-package.yml",
  ".github/pull_request_template.md",
];
```

The test must assert:

```js
assert.match(governance, /M0 — Governance[\s\S]*M5 — Advanced Platform/);
assert.match(governance, /status\/blocked/);
assert.match(governance, /status\/ready/);
assert.match(governance, /status\/in-progress/);
assert.match(governance, /status\/review/);
assert.match(governance, /all dependencies[^\n]*complete/i);
assert.match(governance, /Sync, AI, and public Plugin API/);
assert.match(governance, /M1–M4 release gates/);
assert.match(issueTemplate, /Goal/);
assert.match(issueTemplate, /Non-goals/);
assert.match(issueTemplate, /Verification plan/);
assert.match(issueTemplate, /Risk level/);
assert.match(prTemplate, /Test commands and actual results/);
assert.match(prTemplate, /Migration and rollback/);
assert.match(prTemplate, /Security and privacy impact/);
assert.match(prTemplate, /Performance impact/);
```

The test must also reject `TODO` and `TBD` in the three governance artifacts.

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
node --test tests/governance.contract.test.mjs
```

Expected: exit code `1`, failing because `docs/GOVERNANCE.md` and templates do not yet exist.

- [ ] **Step 3: Commit the RED test**

```bash
git add tests/governance.contract.test.mjs
git commit -m "test: define governance contract for issue 22"
```

---

### Task 2: Define canonical milestone and issue lifecycle governance

**Files:**
- Create: `docs/GOVERNANCE.md`
- Modify: `README.md`
- Test: `tests/governance.contract.test.mjs`

**Interfaces:**
- Consumes: existing repository architecture and policy documents.
- Produces: one authoritative lifecycle/release-gate document linked from README.

- [ ] **Step 1: Write the minimal governance document**

`docs/GOVERNANCE.md` must contain these exact top-level sections:

```markdown
# myNote Governance Contract
## Authority and scope
## Mandatory milestone sequence
## Release gates
## Issue hierarchy and lifecycle
## Readiness and dependency algorithm
## Work-package contract
## Definition of Done
## Risk and rollback policy
## Backlog selection procedure
## Historical issues and superseded plans
## Unknown repository settings
```

The milestone section must list M0 through M5 in order. The release-gate section must state that Sync, AI, and public Plugin API remain prohibited until every release gate from M1 through M4 has passed. The issue lifecycle must define `status/blocked`, `status/ready`, `status/in-progress`, and `status/review`, with exactly one active child issue per run. The readiness algorithm must require all dependencies to be complete and acceptance criteria to be testable before applying `status/ready`.

The Definition of Done must require:

```text
plan committed; RED observed; minimal implementation; targeted and related tests; required verification; self-review; rollback notes; reviewable PR; no merge
```

The historical-issues section must preserve existing roadmap/epic issues and state that they are not automatically closed or rewritten.

- [ ] **Step 2: Add the README link**

Add `- [Governance Contract](docs/GOVERNANCE.md)` to the existing architecture baseline list. Do not change runtime claims or product scope.

- [ ] **Step 3: Run the contract test**

Run:

```bash
node --test tests/governance.contract.test.mjs
```

Expected: still FAIL because GitHub templates are not yet present; governance-specific assertions pass.

---

### Task 3: Add contribution-boundary templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/work-package.yml`
- Create: `.github/pull_request_template.md`
- Test: `tests/governance.contract.test.mjs`

**Interfaces:**
- Consumes: `docs/GOVERNANCE.md` terminology.
- Produces: structured issue intake and a complete PR evidence checklist.

- [ ] **Step 1: Create the work-package issue form**

The issue form must:

- Set `name: Work package` and a title prefix `[Mx][Child]`.
- Require milestone, parent issue, goal, scope, non-goals, dependencies, acceptance criteria, verification plan, migration/rollback, security/privacy, performance, and risk level.
- Include a required readiness checkbox confirming all dependencies are complete.
- Include a required checkbox confirming the issue is independently reviewable.
- Include a required checkbox confirming no Sync, AI, or public Plugin API work is selected before M1–M4 gates pass.
- Avoid any default `status/ready` label because readiness must be explicitly validated before labeling.

- [ ] **Step 2: Create the pull request template**

The PR template must contain headings for:

```markdown
## Parent and child issues
## Problem statement
## Scope
## Non-goals
## Architecture decisions
## File-level summary
## Test commands and actual results
## Migration and rollback
## Security and privacy impact
## Performance impact
## Screenshots
## Known limitations
## Follow-up issues
## Self-review checklist
```

The verification table must require command, exit code, pass/fail counts, and existing failures. The self-review checklist must cover correctness, data integrity, architecture invariants, security/privacy, performance/memory, error handling, accessibility, backward compatibility, migration safety, test quality, and documentation.

- [ ] **Step 3: Run GREEN verification**

Run:

```bash
node --test tests/governance.contract.test.mjs
```

Expected: exit code `0`; all governance contract tests pass.

- [ ] **Step 4: Commit the implementation**

```bash
git add docs/GOVERNANCE.md README.md .github/ISSUE_TEMPLATE/work-package.yml .github/pull_request_template.md
git commit -m "docs: establish executable M0 governance"
```

---

### Task 4: Run baseline and final verification

**Files:**
- Review only; no new runtime files.

**Interfaces:**
- Consumes: final branch state.
- Produces: exact evidence for the PR body and checkpoint.

- [ ] **Step 1: Run the existing parser invariant test**

```bash
node --experimental-default-type=module -e "import('./tests/parser.invariant.test.js').then((module) => console.log(module.runParserInvariantTests()))"
```

Expected: exit code `0`, output `Parser invariant tests passed`.

- [ ] **Step 2: Run the governance contract test**

```bash
node --test tests/governance.contract.test.mjs
```

Expected: exit code `0`, all tests pass.

- [ ] **Step 3: Record unavailable required npm commands**

Run existence checks for `package.json`. Because issue #22 explicitly excludes the M1 toolchain, record these as unavailable rather than claiming pass:

```text
npm ci — NOT RUN: package.json absent
npm run lint — NOT RUN: script absent
npm run test:unit — NOT RUN: script absent
npm run test:integration — NOT RUN: script absent
npm run test:e2e — NOT RUN: script absent
```

This is an existing repository gap and the mandatory next M1 work package after M0 closes.

- [ ] **Step 4: Scan for prohibited placeholders and unsafe patterns**

```bash
rg -n "TODO|TBD|eval\s*\(|new Function|document\.write|console\.(log|info|debug).*?(title|body|content)" \
  docs/GOVERNANCE.md .github/ISSUE_TEMPLATE/work-package.yml .github/pull_request_template.md tests/governance.contract.test.mjs
```

Expected: exit code `1` with no matches.

- [ ] **Step 5: Self-review the final diff**

Confirm:

- No application runtime file changed.
- No migration or user-data path changed.
- No architecture invariant changed or weakened.
- Templates are complete and have no placeholders.
- Test assertions verify behavior rather than implementation formatting where possible.
- Rollback is a clean revert.

- [ ] **Step 6: Prepare the draft PR**

Create a draft PR from `agent/m0-22-governance-contract` to `main`, reference parent #20 and child #22, include exact command outputs, and do not merge.

## Error Paths

- If required labels are absent, create/apply them through the issue creation flow and verify returned issue metadata.
- If GitHub Issue Forms reject the YAML, keep the issue open in `status/in-progress`, correct the schema, and rerun the contract test.
- If the governance test fails for wording drift, change the document only when the intended contract remains equivalent; otherwise update the test and document together with explicit rationale.
- If baseline parser tests fail, record them as pre-existing only when reproduced on `main`; do not attribute them to governance files.

## Migration Behavior

No database, note schema, localStorage, IndexedDB, search index, backlink index, history record, cache, or user content is read, rewritten, or deleted.

## Security and Privacy

The work introduces no runtime input-processing path and logs no note title, body, or content. Templates explicitly preserve security/privacy review requirements for future PRs.

## Performance

No runtime bundle or execution path changes. The only new executable artifact is an on-demand Node contract test; it is not shipped to users.

## Commit Boundaries

1. `docs: plan M0 governance work package` — this plan only.
2. `test: define governance contract for issue 22` — RED contract test only.
3. `docs: establish executable M0 governance` — governance document, README link, issue form, and PR template.

No squash, merge, issue closure, or historical issue mutation occurs in this run.
