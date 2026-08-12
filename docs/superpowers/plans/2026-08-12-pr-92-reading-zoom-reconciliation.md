# PR #92 Reading and Zoom Reconciliation Implementation Plan

> **For implementers:** Execute this plan task-by-task with a fresh review gate after each bounded deliverable. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile issue #90, accepted Figma, runtime capability ownership, tests, and evidence so PR #92 can be reviewed without inventing Reading semantics or misrepresenting native 200% zoom coverage.

**Architecture:** GitHub issue #90 records the owner decision first, then accepted Figma node `126:344` presents Reading as a reasoned disabled control. A pure resolver in `core/japaneseFilters.js` becomes the only common-filter capability seam consumed by `ui/japanese-filters.js`; it maps supported values to the existing canonical M2 filter owner and rejects deferred or unknown values. Repository documentation and PR evidence then describe the same boundary, while native browser 200% zoom remains owned by #71.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js `>=22.13 <23`, Node test runner, Playwright 1.62 Chromium, ESLint 10.8, GitHub CLI/connected GitHub app, Figma MCP.

## Global Constraints

- Work only in `C:\Users\Admin\Src\Cod\myNote\.worktrees\UX-90` on local branch `ux/90`, tracking remote branch `UX/90` and existing draft PR #92.
- Keep issue #90 as the sole active runtime package and preserve the one-PR contract.
- Preserve `UI → Actions → State → Core → Persistence`; `app.js` remains the single browser composition root.
- Keep canonical M2 notebook types exactly `vocabulary`, `kanji`, `grammar`, `output`, and `planner`.
- Keep Filter A's visible order exactly `All / Vocabulary / Grammar / Kanji / Reading / + Filter`.
- Keep Reading visible but disabled with reason `Reading filters require the Japanese V2 learning model`.
- Do not alias Reading, infer it from note content, add a `reading` stored type, or create a second filter/query authority.
- Treat `720×450` as equivalent responsive-layout evidence only; never describe it as native browser 200% zoom evidence.
- Defer native browser 200% zoom acceptance to issue #71 without claiming it passed in #90.
- Do not implement archive navigation or any other issue #94 behavior before #90 merges.
- Make no schema, persistence, scheduler, review-state, search-ranking, dependency, framework, mobile, or touch changes.
- Keep PR #92 draft until a subsequent reviewer or owner explicitly changes its review state.
- Perform exactly two coordinated pushes as approved by the owner: the isolated runtime/test stream pushes first, then the authority/docs/evidence stream integrates that exact commit and pushes second after the complete local gate.

## Approved Two-Stream Execution Override

- Stream A is owned by a separate implementation agent in an isolated worktree. It may modify only `core/japaneseFilters.js`, `ui/japanese-filters.js`, `tests/unit/japanese-filters.test.mjs`, and `tests/e2e/japanese-filters.spec.mjs`.
- Stream A performs push 1 to remote `UX/90` only after focused tests, full lint, and the complete unit suite pass. It does not mutate GitHub issue/PR text, Figma, or documentation.
- Stream B is owned by the coordinating implementer in the existing `UX-90` worktree. It owns issue #90, Figma node `126:344`, tracked documentation, integration, the complete release gate, PR follow-up, and push 2.
- Stream B must integrate Stream A's exact pushed commit before running the complete release gate. The two streams must not edit the same files.
- A third push requires fresh owner authority.

## File Map

- Modify `core/japaneseFilters.js`: export the pure common-filter capability resolver backed by `STUDY_NOTEBOOK_TYPES`.
- Modify `ui/japanese-filters.js`: replace the UI-owned `reading` special case with the core resolver.
- Modify `tests/unit/japanese-filters.test.mjs`: specify canonical resolution and deferred/unknown rejection.
- Modify `tests/e2e/japanese-filters.spec.mjs`: prove every enabled common control filters immediately and Reading remains reasoned/disabled.
- Modify `docs/UX_DESIGN_HANDOFF.md`: record the accepted disabled Reading state for Figma node `126:344` and the #71 zoom boundary.
- Modify `docs/UX_ISSUE_EXECUTION.md`: distinguish enabled common filters from the deferred Reading control and keep zoom with #71.
- Modify `docs/JAPANESE_STUDY_WORKSPACE.md`: name the capability resolver and its canonical ownership boundary.
- Modify `docs/ISSUE_90_VERIFICATION.md`: record the owner disposition, current test evidence, Figma agreement, and non-blocking #71 native-zoom handoff.
- Modify same-directory plan `2026-08-12-issue-90-japanese-filter-review.md`: record the finalized owner decision.
- Modify same-directory plan `2026-08-12-issue-90-board-projection.md`: convert every executed foundation/publication checkbox into historical completed state.
- Mutate GitHub issue #90: reconcile Filter A and native browser zoom acceptance text.
- Mutate Figma file `mzhDU5IwWbd3n3P7oRf88q`, node `126:344`: keep Reading in Filter A but apply the accepted disabled state and reason.
- Mutate PR #92 only after the consolidated push: update head/evidence/owner-decision text and leave one re-review comment.

---

### Task 1: Record the owner decision in issue #90

**Files:**
- External modify: `https://github.com/Dyu20705/myNote/issues/90`

**Interfaces:**
- Consumes: the approved design in `../specs/2026-08-12-pr-92-reading-zoom-reconciliation-design.md`.
- Produces: the merged issue authority that Figma, runtime, tests, and documentation implement.

- [ ] **Step 1: Re-read issue #90 and confirm the active review target**

Run:

```sh
gh issue view 90 --repo Dyu20705/myNote --json number,title,state,body,labels,url
gh pr view 92 --repo Dyu20705/myNote --json headRefOid,isDraft,mergeable,reviews,statusCheckRollup,url
```

Expected: issue #90 remains open with `status/in-progress`; PR #92 remains draft and mergeable; the blocking review targets remote head `1150672bc01320fe53b7e3e1dc8db984311ac1b4`. If a newer owner decision already resolves the same contract differently, stop this plan and report that authority delta instead of overwriting it.

- [ ] **Step 2: Replace the Filter A contract with the approved M2 boundary**

Preserve all unrelated issue text. Keep the visible layout block:

```text
[All] [Vocabulary] [Grammar] [Kanji] [Reading] [+ Filter]
```

Replace the common-filter bullets with exactly this meaning:

```markdown
- `All`, `Vocabulary`, `Grammar`, and `Kanji` are enabled common filters; one click updates results immediately through the canonical filter owner.
- `Reading` remains visible at the same Filter A hierarchy but is disabled with the reason `Reading filters require the Japanese V2 learning model`.
- Reading becomes enabled only after the Japanese V2 owner defines its canonical predicate/value and persistence/query ownership; M2 must not alias or infer it.
- `+ Filter` discloses advanced validated filters.
- **no Apply button**;
- active filters render as removable chips;
- text search remains independent;
- clearing filters never silently clears text search;
- the UI mirrors existing canonical filter/controller state rather than becoming a second query authority.
```

- [ ] **Step 3: Reconcile acceptance and zoom ownership**

Add or replace the Filter A acceptance item with:

```markdown
- [ ] Enabled Filter A controls update immediately through one canonical filter owner; Reading remains visibly disabled with its Japanese V2 reason and does not mutate M2 filter state.
```

Replace the combined viewport/zoom acceptance item with:

```markdown
- [ ] 1024×768, 1280×720, 1440×900, keyboard, mouse, overlay focus return, long-content, zero-drawing, and multi-drawing cases pass without horizontal document overflow.
- [ ] The 720×450 CSS viewport is recorded only as equivalent responsive-layout evidence. Native browser 200% zoom acceptance is owned by #71 and is not a #90 merge blocker.
```

Amend Definition of Done so that Figma/code/docs must agree on the disabled Reading boundary, while native 200% zoom is explicitly handed to #71 rather than left as an unresolved #90 acceptance item.

- [ ] **Step 4: Verify the issue mutation**

Run:

```sh
gh issue view 90 --repo Dyu20705/myNote --json body,url --jq .body
```

Expected: the body contains the unchanged visible Filter A order, the exact Reading reason, the prohibition on invented M2 semantics, the #71 zoom handoff, and no change to #90's one-PR, persistence, schema, scheduler, search, or Japanese V2 non-goals.

---

### Task 2: Reconcile accepted Figma node `126:344`

**Files:**
- External modify: Figma file `mzhDU5IwWbd3n3P7oRf88q`, node `126:344`

**Interfaces:**
- Consumes: issue #90's updated owner decision from Task 1 and the file's existing component/variable metadata.
- Produces: an Accepted Japanese board where Reading is visible, visually disabled, non-interactive, and annotated with the exact Japanese V2 reason.

- [ ] **Step 1: Load the mandatory Figma workflows**

Read the complete `figma:figma-design-to-code` skill before `get_design_context`, and read the complete `figma:figma-use` skill before `use_figma`. Do not call either Figma tool before its prerequisite is loaded.

- [ ] **Step 2: Capture exact pre-mutation authority**

For file `mzhDU5IwWbd3n3P7oRf88q` and node `126:344`, retrieve:

- node-specific design context;
- variables used by the Filter A controls;
- component metadata and available states/variants;
- a screenshot of the exact node.

Expected: the node is Accepted and contains sibling controls `All`, `Vocabulary`, `Grammar`, `Kanji`, `Reading`, and `+ Filter`. If the exact node or metadata cannot be retrieved, stop and report missing design access; do not approximate a generic dark control.

- [ ] **Step 3: Apply only the approved Reading state**

Use the file's existing disabled component state and variables on `Filter / Reading`. Preserve:

```text
Visible label: Reading
Hierarchy: sibling of the other Filter A controls
Interaction state: disabled / non-interactive
Reason: Reading filters require the Japanese V2 learning model
Lifecycle: Accepted
```

Do not remove Reading, rename another filter, add a Reading result predicate, change the other chips, or alter unrelated board/Review/layout nodes.

- [ ] **Step 4: Validate the post-mutation node**

Retrieve fresh metadata and a fresh screenshot for `126:344`. Compare before/after and confirm:

- the Filter A order is unchanged;
- Reading is visibly distinguishable as disabled without relying only on color;
- the exact reason is attached in component description/annotation metadata;
- the control remains reachable as design information but is not presented as an active M2 action;
- no unrelated node changed.

Record the validated node ID and decision for Task 4 documentation and the final PR note.

---

### Task 3: Centralize common-filter capability test-first

**Files:**
- Modify: `tests/unit/japanese-filters.test.mjs`
- Modify: `core/japaneseFilters.js`
- Modify: `ui/japanese-filters.js`
- Modify: `tests/e2e/japanese-filters.spec.mjs`

**Interfaces:**
- Consumes: `STUDY_NOTEBOOK_TYPES: readonly string[]` from `core/studyReview.js` and a Filter A `data-japanese-common-filter` string.
- Produces: `resolveJapaneseCommonFilter(value: unknown): "all" | string | null`; `null` means deferred/unknown and forbids a filter-state mutation.

- [ ] **Step 1: Add the failing unit contract**

Extend the imports in `tests/unit/japanese-filters.test.mjs`:

```js
import { STUDY_NOTEBOOK_TYPES } from "../../core/studyReview.js";
import {
  JAPANESE_FILTER_ERRORS,
  JapaneseNoteFilter,
  filterJapaneseNoteIds,
  resolveJapaneseCommonFilter,
} from "../../core/japaneseFilters.js";
```

Add:

```js
test("enabled common filters resolve through canonical M2 values", () => {
  const enabledCommonFilters = ["all", "vocabulary", "grammar", "kanji"];
  assert.deepEqual(
    enabledCommonFilters.map((value) => resolveJapaneseCommonFilter(value)),
    enabledCommonFilters,
  );
  for (const value of enabledCommonFilters.slice(1)) {
    assert.equal(STUDY_NOTEBOOK_TYPES.includes(value), true);
  }
});

test("deferred and unknown common filters do not resolve", () => {
  for (const value of [undefined, null, "", "reading", "unknown", {}, []]) {
    assert.equal(resolveJapaneseCommonFilter(value), null);
  }
});
```

- [ ] **Step 2: Run the focused test and record RED**

Run:

```sh
node --test tests/unit/japanese-filters.test.mjs
```

Expected: module linking fails because `core/japaneseFilters.js` does not yet export `resolveJapaneseCommonFilter`.

- [ ] **Step 3: Add the minimal canonical resolver**

Add after `normalizeNotebookType` in `core/japaneseFilters.js`:

```js
export function resolveJapaneseCommonFilter(value) {
  if (value === ALL_NOTEBOOK_TYPES) {
    return ALL_NOTEBOOK_TYPES;
  }
  return STUDY_NOTEBOOK_TYPES.includes(value) ? value : null;
}
```

Do not change `STUDY_NOTEBOOK_TYPES`, `normalizeNotebookType`, stored review validation, or filter application behavior.

- [ ] **Step 4: Route the UI through the resolver**

Change the import in `ui/japanese-filters.js` to:

```js
import {
  JAPANESE_FILTER_ERRORS,
  resolveJapaneseCommonFilter,
} from "../core/japaneseFilters.js";
```

Replace `selectCommonFilter` with:

```js
function selectCommonFilter(event) {
  const notebookType = resolveJapaneseCommonFilter(
    event.currentTarget.dataset.japaneseCommonFilter,
  );
  if (notebookType === null) {
    return;
  }
  filter.update({ notebookType });
  syncControls();
  render();
  refresh();
}
```

This removes the UI-owned `reading` string exception while keeping Reading non-mutating.

- [ ] **Step 5: Run focused GREEN and static checks**

Run:

```sh
node --test tests/unit/japanese-filters.test.mjs
node --check core/japaneseFilters.js
node --check ui/japanese-filters.js
npx --no-install eslint core/japaneseFilters.js ui/japanese-filters.js tests/unit/japanese-filters.test.mjs
git diff --check
```

Expected: all Japanese filter unit tests pass, both syntax checks exit zero, ESLint reports no error, and the diff is clean.

- [ ] **Step 6: Strengthen one-click browser coverage**

In `tests/e2e/japanese-filters.spec.mjs`, immediately after creating vocabulary, kanji, and grammar notes, add:

```js
const commonFilterCases = [
  ["Vocabulary", "New vocabulary"],
  ["Grammar", "New grammar pattern"],
  ["Kanji", "新しい漢字"],
];
for (const [name, expectedTitle] of commonFilterCases) {
  const button = common.getByRole("button", { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#noteList .note-item-title")).toHaveText(expectedTitle);
}
await common.getByRole("button", { name: "All", exact: true }).click();
await expect(page.locator("#noteList .note-item-title")).toHaveCount(3);
```

Retain the existing assertions that Reading is disabled, has the exact title, and has the exact accessible description.

- [ ] **Step 7: Run the focused browser contract**

Run:

```sh
npx --no-install playwright test tests/e2e/japanese-filters.spec.mjs --project=chromium
npm run lint
npm run test:unit
```

Expected: the Japanese filter scenario passes; Vocabulary, Grammar, and Kanji each update results immediately; All restores the complete Japanese board; Reading remains disabled and reasoned; full lint and the complete unit suite are green.

- [ ] **Step 8: Commit and perform coordinated push 1**

Run:

```sh
git add core/japaneseFilters.js ui/japanese-filters.js tests/unit/japanese-filters.test.mjs tests/e2e/japanese-filters.spec.mjs
git diff --cached --check
git commit -m "fix(ux): centralize Japanese filter capability"
git push origin HEAD:UX/90
```

Expected: one focused commit and exactly one successful Stream A push. Report the exact commit SHA to Stream B. Do not edit or push any other file, and do not update PR text.

---

### Task 4: Reconcile repository authority and historical records

**Files:**
- Modify: `docs/UX_DESIGN_HANDOFF.md`
- Modify: `docs/UX_ISSUE_EXECUTION.md`
- Modify: `docs/JAPANESE_STUDY_WORKSPACE.md`
- Modify: same-directory `2026-08-12-issue-90-japanese-filter-review.md`
- Modify: same-directory `2026-08-12-issue-90-board-projection.md`

**Interfaces:**
- Consumes: the updated issue #90 authority, validated Figma node `126:344`, and `resolveJapaneseCommonFilter()`.
- Produces: English-only tracked documentation with one Reading/zoom interpretation and no executable-looking historical publication steps.

- [ ] **Step 1: Update the accepted design handoff**

In `docs/UX_DESIGN_HANDOFF.md`, keep node `126:344` Accepted and add this boundary adjacent to its table entry:

```markdown
For M2, node `126:344` keeps Reading visible in Filter A but marks it disabled with the reason `Reading filters require the Japanese V2 learning model`. Only All, Vocabulary, Grammar, and Kanji are enabled common filters. Native browser 200% zoom remains owned by #71; the 720×450 CSS viewport is responsive-layout evidence only.
```

- [ ] **Step 2: Update execution and workspace ownership docs**

In `docs/UX_ISSUE_EXECUTION.md`, replace the broad immediate-filter bullet with:

```markdown
- Japanese Filter A is visible; enabled All/Vocabulary/Grammar/Kanji controls are immediate, Reading is visibly disabled pending Japanese V2 canonical semantics, and `+ Filter` owns the existing advanced canonical controls and removable chips.
```

Keep Stage 6 as the owner of native browser 200% zoom.

In `docs/JAPANESE_STUDY_WORKSPACE.md`, retain the exact disabled reason and add that common controls pass through `resolveJapaneseCommonFilter()` before `JapaneseNoteFilter.update()`, so deferred/unknown values cannot mutate filter state.

- [ ] **Step 3: Finalize the Japanese plan record**

Add a completed owner-reconciliation note near the top of same-directory `2026-08-12-issue-90-japanese-filter-review.md`:

```markdown
**Owner reconciliation:** Reading remains visible but disabled for M2 until Japanese V2 defines canonical semantics. Enabled common controls resolve through the canonical M2 type set; native browser 200% zoom is deferred to #71, not this package.
```

Do not rewrite the already completed implementation checklist.

- [ ] **Step 4: Convert the foundation plan into historical completed state**

In same-directory `2026-08-12-issue-90-board-projection.md`:

- add a top note stating that all foundation, initial push, draft PR opening, and handoff steps completed on PR #92 and must not be repeated;
- change the 12 unchecked execution boxes at the current lines 40, 89, 99, 130, 144, 155, 179, 190, 205, 225, 235, and 279 from `[ ]` to `[x]`;
- preserve command/output text as historical evidence;
- keep future work references as narrative history, not open execution instructions.

- [ ] **Step 5: Validate and commit documentation locally**

Run:

```sh
npm run test:content
rg -n "reading.*special|notebookType === \"reading\"" ui/japanese-filters.js
rg -n "^- \[ \]" -g "2026-08-12-issue-90-board-projection.md" docs
git diff --check
```

Expected: content validation passes; the search returns no UI string special case and no open checkbox in the historical foundation plan; the diff check is clean.

Then run:

```sh
git add docs/UX_DESIGN_HANDOFF.md docs/UX_ISSUE_EXECUTION.md docs/JAPANESE_STUDY_WORKSPACE.md
git add -u -- docs
git diff --cached --check
git commit -m "docs(ux): reconcile issue 90 filter and zoom authority"
```

Expected: one local documentation commit. Do not push.

---

### Task 5: Produce fresh repository evidence

**Files:**
- Modify: `docs/ISSUE_90_VERIFICATION.md`
- Verify: complete repository tree

**Interfaces:**
- Consumes: Tasks 1–4, the existing locked dependency tree, and all release-gate scripts.
- Produces: a current-head verification record whose results and unknowns match the exact tree to be pushed.

- [ ] **Step 1: Run the focused reconciliation set**

Run:

```sh
node --test tests/unit/japanese-filters.test.mjs
npx --no-install playwright test tests/e2e/japanese-filters.spec.mjs tests/e2e/japanese-progressive-disclosure.spec.mjs --project=chromium
npx --no-install eslint core/japaneseFilters.js ui/japanese-filters.js tests/unit/japanese-filters.test.mjs tests/e2e/japanese-filters.spec.mjs
git diff --check
```

Expected: every command exits zero and the output proves canonical mapping, immediate enabled filters, disabled Reading accessibility, and clean static checks.

- [ ] **Step 2: Install exact dependencies and Chromium**

Run:

```sh
npm ci
npx --no-install playwright install --with-deps chromium
```

Expected: both commands exit zero under Node.js `>=22.13 <23` and the lockfile remains unchanged.

- [ ] **Step 3: Run the preliminary complete release gate**

Run each command separately and retain its exit code, TAP counts, Playwright counts, and bounded resource samples:

```sh
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

Expected: every command exits zero. Stop without publication if any command fails.

- [ ] **Step 4: Update the verification record with observed evidence**

In `docs/ISSUE_90_VERIFICATION.md`:

- record `resolveJapaneseCommonFilter()` as the canonical common-filter capability seam;
- record that issue #90 and Figma node `126:344` now agree that Reading is visible, disabled, and reasoned until Japanese V2;
- replace the native-zoom blocker with an explicit owner disposition: native browser 200% zoom remains unvalidated in #90 and is deferred to #71; `720×450` remains only responsive-layout evidence;
- update every command result and test count to the exact values printed by Step 3;
- update the publication section to say push 1 contains the isolated runtime/test slice and the evidence-complete tree is ready for coordinated push 2 and re-review, while PR approval/merge still remain external gates;
- retain physical pen, OS display scaling, and untested assistive-technology/browser combinations as explicit non-claims.

- [ ] **Step 5: Run the final complete release gate on the evidence-complete tree**

Run again after the verification record is final:

```sh
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

Expected: every command exits zero with the same test counts as the verification record.

- [ ] **Step 6: Commit the evidence record locally**

Run:

```sh
git add docs/ISSUE_90_VERIFICATION.md
git diff --cached --check
git commit -m "docs(ux): refresh issue 90 verification evidence"
```

Expected: one local evidence commit and no uncommitted files.

---

### Task 6: Publish once and request current-head re-review

**Files:**
- Verify: complete local worktree and commit range
- Publish: remote branch `UX/90`
- External modify: PR #92 body and one consolidated conversation comment

**Interfaces:**
- Consumes: all green local commits and Task 5 evidence.
- Produces: the second and final planned remote PR head, an accurate draft PR narrative, and a single re-review trigger without resolving nonexistent inline threads.

- [ ] **Step 1: Audit exact publication scope**

Run:

```sh
git status --short --branch
git log --oneline origin/UX/90..HEAD
git diff --stat origin/UX/90...HEAD
git diff --name-only origin/UX/90...HEAD
git diff --check origin/UX/90...HEAD
```

Expected: worktree is clean; the range contains the approved spec, this implementation plan, focused resolver/tests, reconciled documentation/history, and refreshed verification only. No #94, schema, dependency, archive, or unrelated refactor file appears.

- [ ] **Step 2: Perform coordinated push 2**

Run exactly once:

```sh
git push origin HEAD:UX/90
```

Expected: remote `UX/90` advances from Stream A's pushed runtime commit to the evidence-complete local HEAD. Do not issue a third push in this reconciliation batch.

- [ ] **Step 3: Verify the new remote head and CI trigger**

Run:

```sh
gh pr view 92 --repo Dyu20705/myNote --json headRefOid,isDraft,mergeable,statusCheckRollup,url
```

Expected: `headRefOid` equals local `git rev-parse HEAD`; PR remains draft and mergeable; the normal push-created CI run is visible. Do not manually trigger or rerun CI while it is already active.

- [ ] **Step 4: Update the PR body without changing draft state**

Preserve all unrelated PR history and replace stale evidence with:

- exact new head SHA;
- Reading owner decision and `resolveJapaneseCommonFilter()` seam;
- Figma `126:344` disabled-state reconciliation;
- native 200% zoom explicitly handed to #71 while remaining an honest #90 non-claim;
- fresh release-gate counts from `docs/ISSUE_90_VERIFICATION.md`;
- completed historical foundation-plan cleanup;
- completion checklist item for owner disposition marked complete;
- approval/merge and issue-close items left open.

End the body with the statement that PR #92 remains draft pending next review; do not mark it ready or merge it.

- [ ] **Step 5: Leave one consolidated re-review note**

Post one PR conversation comment with this structure and actual new head SHA/test counts:

```markdown
## Review follow-up — Reading and native zoom authority reconciled

- Issue #90 now defines Reading as visible but disabled until Japanese V2 owns canonical semantics.
- Accepted Figma node `126:344` matches that disabled, reasoned state.
- `resolveJapaneseCommonFilter()` gives enabled common controls one canonical M2 capability seam; deferred/unknown values cannot mutate filter state.
- Native browser 200% zoom remains an explicit non-claim in #90 and is dispositioned to its owning package #71; `720×450` is still only responsive-layout evidence.
- The original foundation plan is now unambiguously historical/completed.
- Focused and complete local verification are green on the current remote head; its exact SHA and evidence are recorded in `docs/ISSUE_90_VERIFICATION.md`.

PR #92 remains draft. Please re-review this current head when the push-created CI result is available.
```

There are no inline review threads, so do not call a thread-resolution mutation.

- [ ] **Step 6: Wait for the push-created CI result and report state**

Use read-only PR/check queries until the current-head run reaches a terminal state. Do not rerun a pending or successful job. Report:

- exact remote head SHA;
- CI conclusion;
- draft/mergeability state;
- review threads `0` unless a new thread appears;
- issue #90 still open and #71/#94 still blocked until #90 merges;
- no merge performed.

If CI fails, use `github:gh-fix-ci` and diagnose only the failing current-head logs before any further mutation. A repair requiring another push needs fresh user authority because both approved pushes have been consumed.
