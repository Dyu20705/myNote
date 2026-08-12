# PR #92 Reading and Zoom Authority Reconciliation

**Date:** 2026-08-12

**Status:** Approved design, pending implementation-plan review

**Scope:** Issue #90 and PR #92 only

## Goal

Close the two current-head review blockers on PR #92 without inventing Japanese V2 behavior, weakening the repository's source-of-truth order, or representing responsive proxy coverage as native browser-zoom evidence.

This is an authority-reconciliation change. It aligns GitHub acceptance text, the accepted Figma presentation, runtime capability ownership, automated checks, and verification documentation. It does not add a Reading predicate to the M2 domain and does not implement archive lifecycle work from #94.

## Current Evidence

- PR #92 is open and draft at reviewed head `1150672bc01320fe53b7e3e1dc8db984311ac1b4`; its current-head CI is successful.
- Issue #90 and accepted Figma node `126:344` present Filter A as `All / Vocabulary / Grammar / Kanji / Reading / + Filter` and currently imply that each common filter is immediately usable.
- The canonical M2 Japanese notebook types are `vocabulary`, `kanji`, `grammar`, `output`, and `planner`. There is no canonical `reading` notebook type or predicate.
- The runtime already renders Reading as disabled and explains that it requires the Japanese V2 learning model. The UI controller also avoids mutating the canonical filter with `reading`.
- Issue #90 requires native browser 200% zoom, while the PR records only a `720×450` responsive-layout proxy and correctly marks native zoom as unvalidated.
- Issue #71 owns resize and browser-zoom behavior and is sequenced after #90.
- Issue #94 owns archive lifecycle navigation and is blocked until #90 merges.

## Owner Decisions

### 1. Reading remains visible but deferred

For M2, the enabled common filters are `All`, `Vocabulary`, `Grammar`, and `Kanji`. `Reading` remains in the accepted Filter A row so the intended information architecture stays visible, but it is explicitly disabled and labeled as requiring Japanese V2.

The implementation must not:

- alias Reading to another notebook type;
- derive an ad hoc Reading predicate from title, body, tags, or display text;
- add `reading` to canonical stored types;
- create a UI-local or second filter authority.

Reading becomes enabled only when a future owner defines its canonical domain value or predicate, persistence implications, and query ownership.

### 2. Native 200% zoom moves to its owning package

Issue #90 retains required desktop viewport, keyboard, focus, overflow, and compact-layout evidence. Its `720×450` coverage remains an explicitly labeled responsive approximation and is not native browser-zoom evidence.

Native browser 200% zoom acceptance is deferred to issue #71, which owns resize and zoom behavior. PR #92 must preserve the current unknown honestly and must not claim that the proxy closes native zoom acceptance.

### 3. The foundation plan becomes historical

The original board-projection plan remains in the repository as execution history. Its status and checklist are updated to show that its local implementation, push, and PR-opening steps already occurred. It must not be interpreted as an instruction to repeat publication actions.

## Authority Changes

### GitHub issue #90

Amend the issue contract so that:

- Filter A still lists `Reading`, but Reading is explicitly disabled/deferred until Japanese V2 defines canonical semantics;
- only enabled common filters are required to update results immediately;
- native browser 200% zoom is explicitly deferred to #71;
- the responsive proxy remains useful evidence but is not labeled native zoom validation.

No other #90 acceptance boundary changes.

### Accepted Figma node `126:344`

Keep Reading at the same hierarchy level in Filter A, but represent it as disabled and provide a concise reason such as `Requires Japanese V2`. Do not remove the control or redesign unrelated content.

Before mutation, re-read the exact node's design context, variables, component metadata, and screenshot. After mutation, capture the node again and verify that only the intended state and annotation changed.

### Repository documentation and PR narrative

Update the issue verification record, UX handoff/execution material where the acceptance boundary is repeated, the Japanese filter plan, and the historical foundation plan so they agree with the owner decisions. Update PR #92's narrative or add one consolidated current-head note describing the resolved authority and evidence disposition.

## Runtime Capability Seam

The runtime behavior is already safe, but the current UI controller contains a string-specific `reading` exception. Replace that exception with a small canonical capability seam in `core/japaneseFilters.js`:

- export a pure resolver for common Filter A values;
- return `all` or the exact canonical M2 notebook type for an enabled common filter;
- return `null` for deferred or unknown values, including `reading`;
- have `ui/japanese-filters.js` use the resolver before updating filter state.

This keeps the dependency direction `UI → Core`, gives supportability one owner, and prevents the UI from independently deciding Japanese domain semantics. It does not change persistence, stored schemas, or current visible behavior.

## Test-First Changes

Add focused failing coverage before changing the resolver or controller:

1. A unit contract proves that every enabled common Filter A value resolves to exactly one canonical M2 value.
2. The same contract proves that Reading and unknown values do not resolve.
3. UI or browser coverage proves enabled common filters update results in one click.
4. Existing accessibility coverage continues to prove Reading is disabled and exposes its reason.

The implementation should make only these focused tests pass, then run relevant Japanese filter integration/browser packages and the complete repository release gate.

## Verification and Publication

Required local verification:

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

In addition:

- compare the running Japanese board with the updated accepted Figma node at required desktop viewports;
- verify no horizontal document overflow, visible focus, logical focus return, and state preservation;
- record native 200% zoom as deferred to #71 rather than passed;
- confirm GitHub issue text, Figma, code, tests, docs, and PR narrative describe the same capability boundary;
- publish the reconciled batch to the existing `UX/90` branch and PR #92 only after the full local gate passes.

Because the current review is a consolidated top-level review and has no inline threads, there is no thread to resolve. Request the next review with one consolidated note after the new head and authority updates are available.

## Non-Goals

- No canonical Reading predicate or Japanese V2 model.
- No new notebook type, schema migration, or persistence change.
- No archive navigation or issue #94 implementation.
- No unrelated UI redesign or refactor.
- No fabricated native browser-zoom evidence.
- No second pull request for issue #90.

## Rollback and Risk

The code change is a small pure capability resolver plus its caller and tests. Documentation, issue text, and the Figma disabled-state annotation are independently reversible. No stored data is touched, so rollback requires no migration. The primary risk is authority drift; the final verification therefore treats agreement across GitHub, Figma, runtime, tests, and docs as a release condition.
