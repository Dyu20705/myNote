# Issue 73 Desktop Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the final, reproducible desktop UX release-gate evidence for issue #73, score it without inflating unknowns, and publish one reviewable draft pull request without creating unowned product surfaces or noisy CI activity.

**Architecture:** Keep navigation owner-bound: Notes and the Japanese workspace remain the only visible workspace choices, Archive remains an owned note action rather than a destination, and deferred Reminders, Labels, Archive browsing, and Trash stay absent. Reuse existing owner-level tests as the primary evidence map; add one focused cross-package Playwright suite only for release claims not already expressed as a single outcome. Runtime changes are conditional on an observed deterministic RED and must stay inside an existing adapter/controller owner.

**Tech Stack:** Node.js `>=22.13 <23`, npm `11.7.0`, ECMAScript modules, Node test runner, ESLint, Playwright `1.62.0` with Chromium, IndexedDB/local-only storage, Markdown release evidence, GitHub draft pull request and automatic GitHub Actions CI.

## Global Constraints

- Implement from `origin/dev` at `320fcc31942cc32fbb1401584c51c7ddf2573bed` in `/tmp/mynote-issue73-320fcc` on `issue/73-release-gate`.
- Follow authority in this order: `docs/ARCHITECTURE.md`, `docs/INVARIANTS.md`, the accepted design at `docs/design/issues/073-desktop-release-gate.md`, this approved plan, then issue #73.
- Preserve the approved Design A decision. Do not add routes, stores, commands, counters, placeholders, disabled advertisements, or UI for Reminders, Labels, Archive browsing, or Trash.
- Do not add list/grid state, an Archive query surface, recognition/candidate/model behavior, analytics, attachments, rich formatting, a dependency, a schema migration, a remote service, a CI workflow change, or a second canonical owner.
- Use only synthetic fixtures. Never check in personal note content, imported user payloads, database dumps, browser profiles, drawing vectors from user data, search text, credentials, tokens, or unbounded failure artifacts.
- An existing assertion that is green is valid regression evidence. Do not alter production code merely to manufacture a RED phase.
- A production correction requires a deterministic failing assertion first and must be committed separately from evidence/docs.
- Treat Node/toolchain mismatch, missing native hardware/OS, or executor-blocked browser provisioning as environment limitations, not product PASS or product FAIL.
- Never bypass a blocked install/test command through alternate package managers, wrappers, unapproved network access, or repeated equivalent commands.
- Use one branch, one push, one draft PR to `dev`, and the one automatic PR CI run. Do not create empty commits, trial pushes, duplicate PRs, status-spam comments, or manual CI reruns.
- Do not merge, close #73, reconcile #15/#20, or start the next package. A truthful `BLOCKED` release document is an acceptable output when any P0/P1, category floor, complete-gate, or required native-evidence condition remains unmet.
- Stay within six implementation-branch commits: design, plan, focused evidence, release document, at most one bounded runtime correction, and at most one review correction.

---

### Task 1: Revalidate the package lock and activate issue #73

**Files:**

- Read: `AGENTS.md`
- Read: `docs/design/issues/073-desktop-release-gate.md`
- Read: `docs/ARCHITECTURE.md`
- Read: `docs/INVARIANTS.md`
- Read: `package.json`
- Modify: GitHub issue #73 labels only

- [ ] **Step 1: Re-read the controlling repository contracts**

Read the five files above in full before editing code. Confirm the plan still introduces no new canonical owner, persistence shape, route, dependency, or CI configuration.

- [ ] **Step 2: Revalidate the remote package state with the GitHub connector**

Confirm all of the following immediately before implementation:

- `dev` still points to `320fcc31942cc32fbb1401584c51c7ddf2573bed`;
- issue #73 is open and no newer owner comment invalidates Design A or this plan;
- issues #65, #66, #67, #74, #68, #69, #70, #90, #71, and #72 remain closed;
- no other runtime issue has `status/in-progress`;
- no open pull request overlaps issue #73.

If any check differs, stop before editing and ask the owner to reconcile the authoritative state.

- [ ] **Step 3: Activate the issue without discussion spam**

Replace `status/blocked` with `status/in-progress` on issue #73 in one label update. Do not post a start comment. Re-read issue #73 once and confirm the label state.

- [ ] **Step 4: Validate the local branch boundary**

Run:

```sh
git status --short --branch
git merge-base --is-ancestor 320fcc31942cc32fbb1401584c51c7ddf2573bed HEAD
git diff --name-only 320fcc31942cc32fbb1401584c51c7ddf2573bed...HEAD
git log --oneline --decorate -5
node --version
npm --version
```

Expected before implementation: only the accepted design and approved plan differ from the base; `merge-base` exits `0`; the local runtime reports Node `24.19.0` and npm `11.9.0`, which must be recorded as unsupported local evidence rather than normalized away.

- [ ] **Step 5: Record the already observed baseline facts in working notes**

Carry these facts into the final evidence document without rerunning blocked commands merely to obtain a different outcome:

- `npm ci --cache /tmp/mynote-issue73-npm-cache` completed successfully with 73 packages;
- `npx --no-install playwright install --with-deps chromium` was blocked before process spawn by the executor's network-approval boundary;
- the grouped content/lint/unit/integration command was likewise blocked before process spawn;
- PR #96 head `f84a688` had automatic CI run #331 green before its merge into the audited base;
- the final issue-branch automatic PR CI, not the old run, will be authoritative for #73.

No commit is created for this task.

---

### Task 2: Add focused owner-bound release evidence

**Files:**

- Create: `tests/e2e/ux-release-gate.spec.mjs`
- Reference: `index.html`
- Reference: `app.js`
- Reference: `ui/editorChrome.js`
- Reference: `ui/kanjiInkView.js`
- Reference: `tests/e2e/editor-shell.spec.mjs`
- Reference: `tests/e2e/desktop-resilience.spec.mjs`
- Reference: `tests/e2e/note-drawing-projection.spec.mjs`
- Reference: `tests/e2e/japanese-helpers.mjs`

- [ ] **Step 1: Add local helpers with synthetic-only diagnostics**

Start `tests/e2e/ux-release-gate.spec.mjs` with imports and helpers that never serialize note content into assertion messages:

```js
import { expect, test } from "@playwright/test";

const APP_ORIGIN = "http://127.0.0.1:4173";
const DEFERRED_DESTINATIONS = ["Reminders", "Labels", "Archive", "Trash"];
const FORBIDDEN_COMMAND_IDS = /^(reminders?|labels?|trash|analytics|attachments?|formatting|recognition)(\.|$)/i;

async function commandSnapshot(page) {
  return page.evaluate(async () => {
    const { commandRuntime } = await import("/app.js");
    return commandRuntime.snapshot();
  });
}

async function activeCanonicalNoteShape(page) {
  return page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const state = getActiveStore().getState();
    const note = state.notes.find((candidate) => candidate.id === state.activeId);
    return note ? Object.keys(note).sort() : [];
  });
}
```

The canonical-note helper returns keys only. It must not return title, body, query, IDs, or drawing data into Playwright reports.

- [ ] **Step 2: Assert owner-bound navigation, refresh, and command metadata**

Add a test named `release shell exposes only owner-backed navigation and bounded commands`:

```js
test("release shell exposes only owner-backed navigation and bounded commands", async ({ page }) => {
  await page.goto("/");

  const workspace = page.getByRole("navigation", { name: "Workspace" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("button")).toHaveCount(2);
  await expect(workspace.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(workspace.getByRole("button", { name: "日本語", exact: true })).toHaveAttribute("aria-pressed", "false");

  for (const label of DEFERRED_DESTINATIONS) {
    await expect(workspace.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await expect(workspace.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }

  const refresh = page.getByRole("button", { name: "Refresh" });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect(workspace.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");

  const commands = await commandSnapshot(page);
  expect(commands.length).toBeGreaterThan(0);
  expect(commands.length).toBeLessThanOrEqual(128);
  expect(commands.some(({ id }) => id === "notes.archive")).toBe(true);
  expect(commands.map(({ id }) => id).filter((id) => FORBIDDEN_COMMAND_IDS.test(id))).toEqual([]);
  expect(commands.filter(({ available }) => !available).every(({ unavailableReason }) => (
    typeof unavailableReason === "string" && unavailableReason.trim().length > 0
  ))).toBe(true);
});
```

This intentionally permits the owned `notes.archive` action while proving there is no Archive navigation destination.

- [ ] **Step 3: Assert workspace transitions preserve owner state and focus**

Add a test named `workspace transitions preserve ordinary context and keyboard return` using the existing shell contract instead of querying storage directly:

```js
test("workspace transitions preserve ordinary context and keyboard return", async ({ page }) => {
  await page.goto("/");

  const search = page.locator("#searchInput");
  await search.fill("synthetic-release-query");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");

  const notes = page.locator("#notesWorkspaceButton");
  const japanese = page.locator("#japaneseWorkspaceButton");
  await notes.focus();
  await page.keyboard.press("Tab");
  await expect(japanese).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(japanese).toHaveAttribute("aria-pressed", "true");

  await japanese.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(notes).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(notes).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("synthetic-release-query");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");
});
```

- [ ] **Step 4: Assert the supported viewport proxy and recovery reachability**

Add a table-driven test covering the checked-in desktop/proxy matrix without claiming native zoom equivalence:

```js
for (const viewport of [
  { width: 1024, height: 768, label: "minimum desktop" },
  { width: 1280, height: 720, label: "wide desktop" },
  { width: 1440, height: 900, label: "reference desktop" },
  { width: 720, height: 450, label: "200 percent layout proxy" },
]) {
  test(`${viewport.label} keeps the document and primary actions contained`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "New note", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });
}
```

This test proves responsive containment only; the release document must label native Windows Chrome/Edge 200% zoom as unknown until directly observed.

- [ ] **Step 5: Assert saved-grid locality and separation from canonical notes**

Add a test named `saved-grid drawing stays local and outside canonical note content`:

```js
test("saved-grid drawing stays local and outside canonical note content", async ({ page }) => {
  const externalRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== APP_ORIGIN) externalRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await page.locator("#titleInput").fill("Synthetic release note");
  await page.locator("#contentInput").fill("Synthetic content only");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: /Add drawing/ }).click();
  const dialog = page.getByRole("dialog", { name: "Draw Kanji" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Pen", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Marker", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Eraser", exact: true })).toBeVisible();
  await expect(page.locator("#recognizeKanjiButton, #kanjiCandidateList, #kanjiSelectedCharacter")).toHaveCount(0);

  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);

  const noteKeys = await activeCanonicalNoteShape(page);
  expect(noteKeys).not.toContain("strokes");
  expect(noteKeys).not.toContain("paperStyle");
  expect(externalRequests).toEqual([]);
});
```

Keep fixture values and request query strings out of failure output.

- [ ] **Step 6: Run the focused baseline before any production edit**

Run once:

```sh
npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs --project=chromium
```

Classify the result:

- all green: commit as regression evidence and make no production change;
- deterministic assertion failure inside an existing owner: preserve the RED output and proceed to Task 4 only after committing the evidence test;
- browser provisioning/executor block: record `ENVIRONMENT BLOCKED`, do not retry through another command, and rely on automatic PR CI;
- failure caused by a missing list/grid or other unowned capability: record a P1 blocker, do not implement it here.

- [ ] **Step 7: Verify the evidence file statically and commit**

Run:

```sh
npx --no-install eslint tests/e2e/ux-release-gate.spec.mjs
git diff --check
git diff -- tests/e2e/ux-release-gate.spec.mjs
git status --short
```

If the executor blocks ESLint before spawn, record the limitation and still require `git diff --check` plus manual diff inspection. Stage only the focused test and commit:

```sh
git add tests/e2e/ux-release-gate.spec.mjs
git commit -m "test(ux): add final release gate evidence"
```

---

### Task 3: Audit the repository and write the scored release decision

**Files:**

- Create: `docs/UX_RELEASE_GATE.md`
- Modify: `README.md`
- Reference: `docs/UX_QUALITY_BASELINE.md`
- Reference: `docs/PERFORMANCE_BUDGET.md`
- Reference: `docs/SECURITY_MODEL.md`
- Reference: `docs/UX_ISSUE_EXECUTION.md`
- Reference: `tests/unit/*.test.mjs`
- Reference: `tests/integration/*.test.mjs`
- Reference: `tests/e2e/*.spec.mjs`

- [ ] **Step 1: Build a complete evidence inventory from checked-in tests**

Use `rg` and direct file reads to map every issue #73 claim to exact test names. At minimum, inspect and cite:

- shell/navigation/commands: `editor-shell.spec.mjs`, `command-registry-red.spec.mjs`, `application-composition.test.mjs`, `command-registry.test.mjs`, `note-action-registry.test.mjs`;
- Ordinary workflows: `notes-regression.spec.mjs`, `note-editor-overlay.spec.mjs`, `editor-list-contract.spec.mjs`, `note-workspace-controller.test.mjs`, `note-presentation.test.mjs`;
- visual/responsive/accessibility: `visual-system.spec.mjs`, `desktop-resilience.spec.mjs`, `state-recovery.spec.mjs`, `state-presentation.test.mjs`;
- Japanese workflows: `japanese-release-gate.spec.mjs`, `japanese-workspace.spec.mjs`, `japanese-progressive-disclosure.spec.mjs`, `japanese-delete.spec.mjs`, Japanese unit/integration suites;
- saved-grid: `kanji-handwriting.spec.mjs`, `note-drawing-projection.spec.mjs`, `kanji-resource.spec.mjs`, Kanji unit/integration suites;
- persistence/migration/recovery/security: all integration suites, parser/storage/search-policy unit suites, and `repository-content.contract.test.mjs`.

Do not cite a filename alone. Each scored row must include the exact test title or direct measurement and the exact command that executes it.

- [ ] **Step 2: Create the release document with reproducible metadata**

Create `docs/UX_RELEASE_GATE.md` with these top-level sections in this order:

```md
# Desktop UX Release Gate

Issue: [#73](https://github.com/Dyu20705/myNote/issues/73)

Decision: **BLOCKED**

## Audited revision and environment
## Executive result
## 100-point scorecard
## Evidence map
## Workflow matrix
## Command ownership and discovery
## Viewport, zoom, input, focus, and motion matrix
## Saved-grid privacy and compatibility
## Failure and recovery
## Performance and retained resources
## Security and artifact hygiene
## Findings and ownership
## Task hierarchy and action counts
## Unknowns and compatibility boundary
## Reproduction commands
## Final decision
```

Record:

- base SHA `320fcc31942cc32fbb1401584c51c7ddf2573bed`;
- evidence-test commit SHA from Task 2;
- local Node `24.19.0`, npm `11.9.0`, and their unsupported status;
- supported repository toolchain Node `>=22.13 <23`, npm `11.7.0`;
- the successful `npm ci` fact and both executor-blocked command facts;
- prior integrated-base CI #331 as historical evidence only;
- final PR CI as `PENDING — automatic PR gate is authoritative` at commit time.

The checked-in document must not claim the unrun final CI succeeded. Record the eventual automatic CI result once in the PR body, not via a documentation-only follow-up push.

- [ ] **Step 3: Score every named measure exactly once**

Copy the accepted category weights and release floors exactly:

| Category | Weight | Floor |
| --- | ---: | ---: |
| Information architecture | 20 | 16 |
| Core workflow efficiency | 20 | 16 |
| Visual hierarchy/readability | 15 | 12 |
| Keyboard/accessibility | 20 | 16 |
| Resize/zoom resilience | 10 | 8 |
| Feedback/recovery | 10 | 8 |
| Consistency/polish | 5 | 4 |

For each named measure in `docs/UX_QUALITY_BASELINE.md`, award only `0`, half, or full credit. Link each nonzero score to direct evidence. Mark unsupported/manual-only evidence as `UNKNOWN` and award zero. Sum raw measure points, then round down only the final total.

If the audited baseline remains unchanged, the expected upper-bound arithmetic is:

| Category | Expected score | Reason for lost points |
| --- | ---: | --- |
| Information architecture | 17/20 | no owned list/grid mode |
| Core workflow efficiency | 16/20 | no list/grid workflow parity |
| Visual hierarchy/readability | 15/15 | only if all checked-in visual evidence is green |
| Keyboard/accessibility | 20/20 | only if all command/focus evidence is green |
| Resize/zoom resilience | 7/10 | native Windows Chrome/Edge 200% remains unknown |
| Feedback/recovery | 10/10 | only if all recovery evidence is green |
| Consistency/polish | 5/5 | only if all cross-workspace evidence is green |
| **Expected ceiling** | **90/100** | subject to the final test results |

This table is a hypothesis to verify, not permission to award points. Any absent or failing evidence reduces the corresponding row. Even at `90/100`, `7/10` fails the resize category floor, and the missing list/grid owner plus required native validation remain release blockers.

- [ ] **Step 4: Record findings with exact ownership and disposition**

Unless new evidence disproves them, record these as unresolved P1 findings:

1. `P1 — List/grid release contract has no canonical owner`: #73 may audit it but cannot safely add its state/query/render/command ownership. Handoff requires a separately approved design/package.
2. `P1 — Required native Windows/200% evidence unavailable`: the `720×450` layout proxy is not equivalent to native Chrome/Edge 200%, OS scaling, physical pen, or screen-reader validation. Owner/manual validation is required.
3. `P1 — Final issue-branch complete gate pending`: remains open at document commit time and resolves only if the one automatic PR CI run is green.

If automatic CI later passes, mark only finding 3 resolved in the PR summary. Findings 1 and 2 keep the release decision `BLOCKED`; do not change #73 to review or completed.

- [ ] **Step 5: Record workflow, security, performance, and compatibility matrices**

Every matrix row must include `Evidence`, `Result`, and `Notes/owner` columns. Explicitly include:

- Ordinary create/edit/search/pin/archive/delete/Undo/export/reload;
- Japanese five note types, filters, Review, delete/recovery/export;
- command availability, disabled reasons, palette/shortcut/direct-control parity, IME and browser precedence;
- all four responsive viewports, keyboard/mouse, reduced motion, focus return, native zoom unknown;
- V1 read/export, V2 create/edit/delete/restore/import/export, projection above title/body, no empty permanent drawing region;
- bounded entry/stroke/point/history/resource behavior and checked-in performance annotations;
- inert Markdown/wiki labels, bounded diagnostics, validated worker/storage payloads, canonical-before-derived success, explicit reset confirmation;
- no recognizer/model/dataset/telemetry network path and no guessed Unicode;
- synthetic-only artifacts and absence of content-bearing failure diagnostics.

Performance rows must quote the fixture shape, warm-up, sample count, measured duration already checked in, environment, and threshold. Do not compare unlike machines or present startup/search/autosave targets as measured guarantees when no representative benchmark exists.

- [ ] **Step 6: Add the README discoverability link**

Add one link near the existing UX/process documentation list:

```md
- [Desktop UX release gate](docs/UX_RELEASE_GATE.md)
```

Do not add a release badge or PASS wording.

- [ ] **Step 7: Validate artifact hygiene and commit the audit**

Run:

```sh
rg -n -i "(api[_-]?key|authorization:|bearer |password|secret|token=|cookie:)" docs/UX_RELEASE_GATE.md README.md
rg -n -i "(\[replace\]|fill in later|unknown without owner)" docs/UX_RELEASE_GATE.md
git diff --check
git diff -- docs/UX_RELEASE_GATE.md README.md
git status --short
```

Expected: the secret scan has no match; the placeholder scan has no match; explicit compatibility entries use the exact status `UNKNOWN — REQUIRES VALIDATION`, not vague placeholders. Stage only the release document and README, then commit:

```sh
git add docs/UX_RELEASE_GATE.md README.md
git commit -m "docs(ux): record issue 73 release evidence"
```

---

### Task 4: Correct at most one bounded existing-owner defect, only if RED

**Files:**

- Modify: the smallest existing adapter/controller file implicated by the deterministic RED
- Modify: `tests/e2e/ux-release-gate.spec.mjs` only to clarify the already-correct requirement
- Do not modify: `core/storage.js`, parser ownership, schema/migrations, dependency manifests, CI workflow files, or new product-owner modules

- [ ] **Step 1: Classify every failure before editing runtime**

Use `superpowers:systematic-debugging` for any unexpected test failure. Choose exactly one classification:

- test defect: correct the focused test without changing the product contract;
- existing-owner runtime defect: continue to Step 2;
- missing owner/capability: record a P1 and stop runtime work;
- environment/tooling block: record it and defer to automatic CI;
- unrelated baseline regression: stop and ask the owner rather than absorbing it into #73.

- [ ] **Step 2: Preserve genuine RED evidence**

Run the focused release file once:

```sh
npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs --project=chromium
```

Record the failing assertion and root cause without copying note bodies, imported payloads, URLs with queries, or database content. If the executor blocks before process spawn, there is no genuine RED and no runtime change is authorized locally.

- [ ] **Step 3: Apply the smallest owner-local correction**

Allowed examples are an existing control missing an accessible state, an incorrect existing command unavailable reason, stale focus return, or a bounded layout overflow in the owning UI adapter. The change must introduce no new state, route, schema, service, command family, or lifecycle.

Do not implement list/grid, Archive browsing, Reminders, Labels, Trash, recognition, analytics, attachment, or rich-format behavior under this task.

- [ ] **Step 4: Prove focused GREEN and guard adjacent behavior**

Run the focused release file again, then the adjacent owner suites:

```sh
npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs --project=chromium
npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs tests/e2e/editor-shell.spec.mjs tests/e2e/note-editor-overlay.spec.mjs --project=chromium
npx --no-install playwright test tests/e2e/desktop-resilience.spec.mjs tests/e2e/note-drawing-projection.spec.mjs --project=chromium-legacy-regression
git diff --check
```

If either command is environment-blocked, do not claim GREEN and do not expand the change. The correction can proceed to review only when the automatic CI later supplies the missing complete evidence.

- [ ] **Step 5: Commit the correction separately, or create no commit**

Inspect the exact diff and stage only the owner-local file plus its regression assertion:

```sh
git diff --check
git status --short
git diff -- app.js index.html ui/editorChrome.js ui/kanjiInkView.js styles.css editor.css kanji-ink.css tests/e2e/ux-release-gate.spec.mjs
git add app.js index.html ui/editorChrome.js ui/kanjiInkView.js styles.css editor.css kanji-ink.css tests/e2e/ux-release-gate.spec.mjs
git commit -m "fix(ux): address bounded release finding"
```

The diagnostic must select at most one production owner from the explicit list above; unchanged paths are harmless when staged. If there is no qualifying defect, skip this commit entirely; do not create an empty commit.

---

### Task 5: Run the final local gate and independent review

**Files:**

- Review: all changes since `320fcc31942cc32fbb1401584c51c7ddf2573bed`
- Modify: only files required for one bounded review correction

- [ ] **Step 1: Run the supported complete gate once where executable**

Use `superpowers:verification-before-completion`. First run the non-mutating environment preflight:

```sh
node --version
npm --version
npx --no-install playwright --version
```

Only when Node satisfies `>=22.13 <23`, npm is `11.7.0`, and Chromium is already provisioned, run the local complete gate in order:

```sh
npm ci
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

The known work environment reports Node `24.19.0`, npm `11.9.0`, and blocked Chromium provisioning, so it takes the environment-limited branch unless those facts materially change. In that branch, do not rerun the blocked install or the previously blocked grouped test command. Run fresh `git diff --check` and the read-only scope inspection below, record the other local checks as `ENVIRONMENT BLOCKED`, and require the automatic PR CI to execute the full repository gate on the supported toolchain. Do not substitute unsupported local results for that gate.

- [ ] **Step 2: Inspect scope, history, and artifact hygiene**

Run:

```sh
git status --short
git diff --stat 320fcc31942cc32fbb1401584c51c7ddf2573bed...HEAD
git diff --name-status 320fcc31942cc32fbb1401584c51c7ddf2573bed...HEAD
git log --oneline 320fcc31942cc32fbb1401584c51c7ddf2573bed..HEAD
git diff --check
```

Expected files are the accepted design, this plan, the focused E2E test, the release evidence document, README, and at most one diagnosed owner-local correction. There must be no dependency lockfile churn, schema/migration edit, CI workflow edit, generated Playwright report, trace, video, screenshot, database dump, browser profile, or user-content artifact.

- [ ] **Step 3: Run the repository code-review skill**

Invoke `code-review` against base `320fcc31942cc32fbb1401584c51c7ddf2573bed`. Follow its required Standards and Spec review flow. Review against:

- `AGENTS.md`, architecture, invariants, security/performance baselines;
- accepted Design A and this plan;
- issue #73 score/floor/P0-P1 requirements;
- synthetic-only evidence and bounded diagnostics;
- GitHub/CI anti-spam constraints.

Address only findings that are actionable and within the approved owner boundary. If a finding requires a missing canonical owner, record it as a blocker rather than widening scope.

- [ ] **Step 4: Apply at most one consolidated review correction**

If review finds in-scope defects, make one cohesive correction, rerun the narrow relevant checks plus `git diff --check`, and commit once:

```sh
git add README.md docs/UX_RELEASE_GATE.md tests/e2e/ux-release-gate.spec.mjs app.js index.html ui/editorChrome.js ui/kanjiInkView.js styles.css editor.css kanji-ink.css
git commit -m "fix(ux): address release gate review"
```

If no correction is needed, create no commit. Re-run the scope/history inspection after any correction.

- [ ] **Step 5: Determine the truthful publication decision**

Use these exact outcomes:

- `PASS`: total `>=90`, every category floor met, complete gate green on the audited head, required native evidence complete, no unresolved P0/P1;
- `FAIL`: direct supported evidence proves a gate requirement is violated;
- `BLOCKED`: missing required environment/evidence, pending authoritative CI, or missing product owner prevents a supported conclusion.

The accepted baseline is expected to remain `BLOCKED` because native Windows/200% evidence and list/grid ownership are unresolved. Do not soften or relabel those conditions to obtain PASS.

---

### Task 6: Publish one bounded draft pull request and observe one automatic CI run

**Files:**

- Read: final branch diff and commit history
- Modify: GitHub branch/ref, one draft pull request, PR body metadata only
- Do not modify: `dev`, `main`, issue completion state, roadmap completion state

- [ ] **Step 1: Revalidate remote state immediately before publication**

Use the GitHub connector to confirm:

- remote `dev` is still `320fcc31942cc32fbb1401584c51c7ddf2573bed`;
- no new active runtime issue or overlapping PR exists;
- issue #73 remains `status/in-progress`;
- no issue #73 branch/PR already exists remotely.

Stop on drift; do not force-push, rebase onto an unreviewed base, or create a duplicate PR.

- [ ] **Step 2: Use the GitHub publication skill**

Read and apply `github:yeet`. Prefer the connected GitHub app for repository context and draft-PR creation. Push `issue/73-release-gate` exactly once after a safe authentication preflight. If connector coverage cannot publish the branch and authenticated Git is unavailable, report the blocker instead of attempting trial pushes or exposing credentials.

Do not force-push. Do not push `dev` or `main`.

- [ ] **Step 3: Open one draft PR to `dev`**

Use title:

```text
docs(ux): record issue 73 desktop release gate
```

The PR body must copy the audited score, floors, findings, and verification outcomes verbatim from `docs/UX_RELEASE_GATE.md` and include:

```md
## Summary
- adds owner-bound cross-package release evidence
- records the complete 100-point scorecard and compatibility boundary
- keeps unowned destinations absent and saved-grid data local-only

## Release decision
- Decision: BLOCKED unless every release condition is proven
- Score: copied from the final scorecard
- Category floors: copied from the final scorecard
- Unresolved P0/P1: copied from Findings and ownership

## Verification
- Local dependency install: npm ci passed with 73 packages under unsupported Node 24.19.0/npm 11.9.0
- Local content/lint/unit/integration/e2e: copied from Reproduction commands
- Automatic PR CI: PENDING

## Security and privacy
- synthetic fixtures only
- no raw note/import/drawing data in artifacts
- no recognizer/model/analytics network path added

## Deferred owner handoffs
- list/grid canonical ownership
- native Windows Chrome/Edge 200%, OS scaling, screen reader, and physical pen evidence

Closes no issue. #15 and #20 are not reconciled by this draft.
```

Do not use `Closes #73` while blockers remain.

- [ ] **Step 4: Observe the single automatic CI run**

Read the automatically created PR checks once they settle. Do not trigger a rerun.

- green: update the PR body once to record run URL/number, head SHA, and `CI PASS`; resolve only the CI-pending finding;
- deterministic failure: capture the failing job/test and stop without a second push or rerun until owner approval for a correction batch;
- infrastructure failure: record it as infrastructure-blocked and stop; do not retry unchanged infrastructure;
- pending beyond the observation window: leave `PENDING` and report it without polling spam.

Do not post progress comments. The PR body is the single evolving evidence summary.

- [ ] **Step 5: Leave truthful repository state for owner review**

Keep the PR draft and issue #73 `status/in-progress` while Design A blockers remain. Do not merge, mark ready for review, close #73, or change roadmap issues. Report:

- draft PR URL;
- exact head SHA and commit count;
- automatic CI result or pending state;
- score/category-floor result;
- unresolved P0/P1 blockers;
- confirmation that only one push and one automatic CI run occurred.

---

## Completion Checklist

- [ ] Accepted design and approved plan remain unchanged and discoverable.
- [ ] Focused evidence covers owner-bound navigation, bounded commands, workspace continuity, responsive containment, and saved-grid locality without exposing content.
- [ ] `docs/UX_RELEASE_GATE.md` maps every score to exact evidence and gives unknowns zero credit.
- [ ] README links to the release evidence without claiming PASS.
- [ ] No new canonical owner, deferred destination, schema, dependency, remote service, analytics, recognition, or CI workflow is introduced.
- [ ] Any runtime correction has preserved RED evidence, focused GREEN evidence, and one existing owner.
- [ ] Artifact and security scans contain no credentials, personal data, user payloads, or content-bearing diagnostics.
- [ ] Local environment limitations and authoritative automatic CI are reported separately.
- [ ] One bounded branch, one push, one draft PR, and no manual CI rerun or comment spam are used.
- [ ] No merge, issue close, roadmap reconciliation, or unsupported release PASS occurs.
