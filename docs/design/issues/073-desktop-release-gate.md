# Issue 73 Desktop Release Gate Design

Issue: [#73](https://github.com/Dyu20705/myNote/issues/73)

Owner decision: **Design A — owner-bound navigation**

Accepted implementation base: `dev` at `320fcc31942cc32fbb1401584c51c7ddf2573bed`

## 1. Purpose

Issue #73 is the final M2 integration and evidence package. It determines whether the current desktop product satisfies the accepted 100-point UX scorecard while preserving the local-only saved-grid Kanji lifecycle, the board-first note presentation, and the state/recovery contracts already integrated by issues #65 through #72.

This package does not create a new product subsystem. It may add deterministic release evidence and fix only a bounded defect inside an existing owner. A missing capability that requires a new state, persistence, query, navigation, command, or lifecycle owner blocks the release decision and becomes an explicitly owned follow-up instead of expanding this pull request.

## 2. Authority and audited baseline

The implementation reads authority in this order:

1. `docs/ARCHITECTURE.md` and `docs/INVARIANTS.md`;
2. this accepted issue design;
3. the approved issue #73 implementation plan;
4. issue #73 and its owner amendments;
5. accepted issue #69, #90, #71, and #72 repository contracts;
6. current runtime and verification evidence.

At design time:

- issues #65, #66, #67, #74, #68, #69, #70, #90, #71, and #72 are closed as completed;
- PR #96 is merged into `dev`;
- the final PR #96 head CI run #331 is green;
- no pull request or runtime issue is active;
- `dev` is exactly `320fcc31942cc32fbb1401584c51c7ddf2573bed`.

The release audit targets the final issue-branch head and its merge candidate into `dev`. Promotion from `dev` to `main` remains an owner/release decision and is not performed by this package.

## 3. Product and compatibility boundary

Supported evidence targets are:

- Chromium on the Ubuntu CI environment;
- desktop CSS viewports `1024×768`, `1280×720`, and `1440×900`;
- live resize among supported desktop layouts;
- keyboard-only non-drawing journeys and desktop mouse journeys;
- `prefers-reduced-motion: reduce`;
- the checked-in `720×450` responsive-layout proxy for a `1440×900` desktop at 200% zoom;
- current Chrome and Edge on Windows for native 200% browser zoom and the #69 physical desktop input checks when directly recorded.

The `720×450` proxy is not native browser-zoom evidence. Windows Chrome/Edge, native 200% zoom, OS display scaling, screen-reader pairings, physical pen input, touch-first interaction, mobile/tablet navigation, virtual keyboards, native wrappers, and untested browsers remain `UNKNOWN — REQUIRES VALIDATION` until directly executed. Unknown evidence earns zero points.

## 4. Owner-bound navigation reconciliation

The Keep-like five-destination information architecture is an audit inventory, not authorization to render incomplete destinations.

| Destination | M2 decision | Release evidence |
| --- | --- | --- |
| Notes | Visible and fully owned | Verify board, search, empty/no-result, create/edit, lifecycle, recovery, and commands |
| Reminders | Deferred; no owner | Verify the control is absent and record an M3 handoff |
| Labels | Deferred; no owner | Verify the control is absent and record an M3 handoff |
| Archive | Existing note lifecycle only; no complete destination/query contract | Verify the owned archive action and truthful result removal; do not render a destination |
| Trash | Deferred; no owner | Verify the control is absent and record an M3 handoff |

Japanese remains a workspace with `Notes` and `Review`; it is not a sixth Ordinary destination.

The release gate awards semantic-shell and consistency points for truthful ownership, accessible existing controls, and absence of dead controls. It does not award functionality points for deferred destinations. It must not add placeholder navigation, disabled advertisements, stores, routes, counters, commands, or recovery surfaces for Reminders, Labels, Archive browsing, or Trash.

## 5. Evidence architecture

The gate uses one evidence map rather than duplicating every earlier test.

### 5.1 Existing evidence

Existing unit, integration, and browser suites remain the primary evidence for their owning contracts:

- command scope, browser precedence, IME, availability, and reasons;
- ordinary note creation, overlay editing, search, pin, archive action, delete, Undo, export, and persistence;
- Japanese board, filters, five note types, Review lifecycle, degraded data, delete, and recovery;
- saved-grid drawing tools, bounded history, persistence, retry, direct projection, mixed V1/V2 compatibility, export/import, and resource cleanup;
- desktop viewport containment, resize continuity, long-content overflow, focus, and reduced motion;
- state-presentation, canonical failure, derived degradation, safe-mode reset, and assertive failure announcements;
- parser, search, persistence, migration, history, and storage security invariants.

### 5.2 New focused browser evidence

Create `tests/e2e/ux-release-gate.spec.mjs` only for cross-package claims that are not already asserted as one release outcome. The focused specification will use synthetic, content-safe fixtures and verify:

- the visible semantic navigation contains only owned destinations and exposes no dead M2 controls;
- top-bar refresh and board presentation remain functional without creating a second state owner;
- ordinary and Japanese board-to-overlay journeys preserve query, selection, scroll, draft, and focus across supported transitions;
- the scorecard-critical controls have accessible names, state, and actionable disabled reasons through the shared command registry;
- the supported desktop matrix has no horizontal document overflow and keeps primary recovery actions reachable;
- successful saved-grid persistence projects the drawing above title/body with zero extra navigation and no empty permanent drawing region;
- no recognition, candidate, remote model, analytics, reminder, label-management, Trash, attachment, rich-formatting, or handwriting-recognition control appears in the healthy M2 path.

If an assertion is already green on the accepted baseline, record it as regression evidence. Do not manufacture a production change to create RED.

### 5.3 Release document

Create `docs/UX_RELEASE_GATE.md` with:

1. audited base/head SHA and exact environment;
2. command transcript and result summary;
3. a point-by-point 100-point scorecard;
4. automated and manual workflow matrices;
5. command ownership, availability, disabled-reason, and discovery results;
6. viewport, resize, zoom, keyboard, mouse, focus, and reduced-motion results;
7. saved-grid privacy, persistence, lifecycle, projection, compatibility, export, and resource evidence;
8. failure and recovery results;
9. performance measurements with fixture shape and thresholds;
10. security/privacy evidence and artifact-content rules;
11. P0–P3 findings with owner and disposition;
12. task hierarchy and action counts;
13. compatibility boundaries and explicit unknowns;
14. final `PASS`, `FAIL`, or `BLOCKED` decision with exact blockers.

Every awarded point links to a reproducible command, test, computed measurement, or directly recorded manual check. Design screenshots and inferred behavior earn no score.

## 6. Score calculation

Use the accepted weights from `docs/UX_QUALITY_BASELINE.md` without redefining them:

| Category | Weight | Release floor |
| --- | ---: | ---: |
| Information architecture | 20 | 16 |
| Core workflow efficiency | 20 | 16 |
| Visual hierarchy/readability | 15 | 12 |
| Keyboard/accessibility | 20 | 16 |
| Resize/zoom resilience | 10 | 8 |
| Feedback/recovery | 10 | 8 |
| Consistency/polish | 5 | 4 |

Each named measure receives zero, half, or full credit. Fractions are rounded down only at the final total. Release `PASS` requires all of:

- at least `90/100` total;
- every category at or above its floor;
- no unresolved P0/P1 finding;
- the complete repository gate green on the audited head;
- every awarded point backed by direct evidence.

Native Windows/200% evidence left unknown can therefore block the score or category floor. The document must report the arithmetic result instead of converting an unknown into equivalent evidence.

## 7. Bounded defect policy

A runtime correction is allowed only when all conditions hold:

1. a deterministic release assertion exposes the defect;
2. the expected behavior already belongs to an integrated owner;
3. the correction introduces no new canonical state or lifecycle;
4. the fix is local to an existing adapter/controller boundary;
5. the RED assertion is observed before the production edit;
6. focused and complete verification cover the change.

Examples of allowed corrections are a missing accessible state projection, stale focus return, an incorrect existing command reason, or a bounded overflow rule. List/grid implementation, a new Archive surface, and Reminders/Labels/Trash require new or incomplete owners and are release blockers rather than #73 runtime scope.

## 8. Security and privacy

Release fixtures use synthetic note titles, bodies, identifiers, drawings, and review metadata. Checked-in evidence and diagnostics must not contain personal data, real note content, raw imported payloads, database dumps, search text, drawing vectors from user data, browser-profile data, credentials, or network tokens.

The gate verifies that:

- note content and wiki-link labels remain inert and are never rendered through raw HTML;
- worker messages and persisted shapes remain validated and bounded;
- canonical persistence precedes visible/history success;
- failure diagnostics are bounded and content-free;
- V2 saved-grid drawings remain local-only, contain no guessed Unicode, and cause no recognizer/model/dataset/telemetry request;
- drawing vectors remain outside Markdown, parser metadata, AST, tags, and canonical note content;
- legacy V1 entries remain readable/exportable without destructive migration;
- reset remains explicit and confirmed;
- failure artifacts are bounded, short-lived, and contain only synthetic fixtures.

No dependency, schema migration, remote service, analytics store, or security-boundary expansion is authorized.

## 9. Performance and retained resources

The gate reuses `docs/PERFORMANCE_BUDGET.md` and the checked-in `kanji-resource-evidence` annotations. It records fixture shape, warm-up, sample count, individual durations, environment, and thresholds.

The package verifies:

- maximum-capacity V2 validation/codec bounds;
- 65-entry note-context loading and reload;
- one initial drawing preview and bounded disclosure of 64 older entries;
- repeated dialog/open-note/open-close cleanup;
- pointer fallback listener cleanup;
- bounded command registration and retained drawing/controller state;
- no unexplained regression against checked-in thresholds.

General startup/search/autosave targets remain targets rather than release guarantees where no checked-in representative benchmark exists. The document must not manufacture comparative performance claims from unlike machines.

## 10. Verification and CI discipline

The baseline and final repository gate is:

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

The supported toolchain is Node.js `>=22.13 <23`, npm `11.7.0`, and the repository-pinned Playwright/Chromium dependency.

Local environment failures are classified separately from repository failures. The current work environment reports Node.js `24.19.0`, npm `11.9.0`, and an executor-blocked Chromium provisioning attempt. Those facts are not release PASS evidence and must not be bypassed through alternate installers or wrappers.

Use focused local verification where the environment permits. Publish one consolidated issue branch and one draft pull request to `dev`. Allow the automatic pull-request CI run to provide the authoritative clean Node/npm/Chromium gate. Do not create empty commits, trial pushes, duplicate pull requests, or manual reruns of deterministic failures.

## 11. Findings and stop conditions

Classify findings as:

- **P0:** active data loss, destructive migration, privacy/security breach, or unrecoverable corruption;
- **P1:** release-blocking correctness, data-integrity, accessibility, command, performance, compatibility, or supported-workflow failure;
- **P2:** important limitation with a safe workaround or unsupported-boundary gap;
- **P3:** minor polish or future optimization.

Stop runtime implementation and report when:

- a required fix needs a new canonical owner, schema, route, or broad redesign;
- an authoritative contract materially conflicts with architecture or invariants;
- the complete gate exposes an unrelated baseline defect;
- required native/manual evidence is unavailable and equivalence cannot be proven;
- a remote CI failure is deterministic and its cause has not changed;
- another runtime issue or conflicting pull request becomes active.

An unresolved P0/P1 or an unmet score/category floor keeps #73 open. The pull request may still preserve truthful evidence and a bounded blocker handoff, but it must not claim release PASS or reconcile #15/#20 as completed.

## 12. Expected files and ownership

- Create `docs/design/issues/073-desktop-release-gate.md` as the authoritative issue contract.
- Create the approved issue #73 implementation plan after design approval.
- Create `tests/e2e/ux-release-gate.spec.mjs` for uncovered cross-package evidence only.
- Create `docs/UX_RELEASE_GATE.md` for the scored audit and decision.
- Add the release document to `README.md` only when the document exists.
- Modify existing tests or runtime only for a verified bounded defect under Section 7.
- Reconcile #15/#20 only after the release decision is genuinely PASS.

No core persistence, parser, scheduler, search, drawing schema, command registry ownership, dependency, workflow, or CI configuration change is planned.

## 13. Rollback

The evidence test, release document, README link, and any separately identifiable bounded adapter correction revert independently. Rollback performs no database downgrade, user-data rewrite, index migration, review mutation, or Kanji-entry conversion. Existing V1/V2 drawing data and schema v3 remain untouched.

## 14. Definition of Done

The implementation package is ready for owner review when:

- the release design and approved plan are present;
- the evidence map covers every scorecard measure and issue #73 workflow requirement;
- focused evidence and every executable local gate are recorded truthfully;
- one draft PR targets `dev` and its automatic CI result is recorded;
- security, privacy, performance, accessibility, compatibility, recovery, and rollback reviews are complete;
- unknown native/manual environments remain explicit;
- no unsupported PASS claim, merge, issue close, roadmap completion, or next-package start occurs.

Issue #73 itself is complete only after the audited target satisfies `≥90/100`, every category floor, a green complete repository gate, the required native/manual evidence, and zero unresolved P0/P1 findings, followed by owner-reviewed integration and roadmap reconciliation.
