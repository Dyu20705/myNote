# Desktop UX Release Gate

Issue: [#73](https://github.com/Dyu20705/myNote/issues/73)

Decision: **BLOCKED**

## Audited revision and environment

| Item | Audited value |
| --- | --- |
| Accepted implementation base | `320fcc31942cc32fbb1401584c51c7ddf2573bed` |
| Focused evidence commit | `eaf113312cb7ff60a664067dc7fb6aac860eb0f1` (`test(ux): add final release gate evidence`) |
| Privacy-safe evidence correction | `3acab3045a218a2d5efa069918bdb757f6a70b53` (`test(ux): redact external request diagnostics`) |
| Product evidence revision | `6a85bc5cb87276b37b5cb21072399a3ea3d73420` (`test(ux): expand healthy control inventory`); this document changes documentation only |
| Supported repository toolchain | Node.js `>=22.13 <23`; npm `11.7.0`; Playwright `1.62.0` |
| Local audit toolchain | Node.js `24.19.0`; npm `11.9.0` — unsupported for release certification |
| Local dependency install | `npm ci --cache /tmp/mynote-issue73-npm-cache` passed; 73 packages installed |
| Local Chromium provisioning | `npx --no-install playwright install --with-deps chromium` — ENVIRONMENT BLOCKED before process spawn |
| Local grouped repository checks | content, lint, unit, and integration command — ENVIRONMENT BLOCKED before process spawn |
| Focused issue #73 browser check | `npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs --project=chromium` — ENVIRONMENT BLOCKED after the web server started; no assertion result and no product RED observed |
| Focused issue #73 lint | `npx --no-install eslint tests/e2e/ux-release-gate.spec.mjs` — ENVIRONMENT BLOCKED before ESLint spawned; `node --check` passed after the expanded native/focusable control-inventory correction |
| Integrated-base CI reference | GitHub Actions PR #96 run #331 was green at head `f84a688ef6484d6c16b464db194be3231ff7bc46`; historical evidence only |
| Integrated-base CI execution | Workflow `CI`, job `verify`, `pull_request` context; GitHub-hosted runner label `ubuntu-24.04`; `npm run test:e2e` invokes `node scripts/run-e2e.mjs`, Playwright's static web server, and the configured Chromium projects with one worker, zero retries, and default headless execution |
| Integrated-base CI toolchain | Node.js `22.20.0`; npm `11.7.0`; `@playwright/test`, `playwright`, and `playwright-core` `1.62.0` |
| Integrated-base CI browser | Chrome Headless Shell `151.0.7922.34`, Chromium revision `1234`, selected by the default-headless `browserName: "chromium"` configuration |
| Integrated-base metadata authority | The run head and current audit have byte-identical `.github/workflows/ci.yml` and `package-lock.json`; exact values come from those files plus Playwright `1.62.0`'s installed `playwright-core/browsers.json` |
| Final issue-branch CI | **PENDING — automatic PR gate is authoritative** |

The base CI result applies to the integrated product tests present at the accepted base. It does not certify the later focused evidence file or this documentation head. The issue-branch automatic CI must run the complete gate on the final head.

## Executive result

The accepted measures total **90/100**, but this is not a release pass. Resize/zoom resilience scores **7/10**, below its floor of **8/10**. Three P1 findings remain unresolved: list/grid has no canonical owner, required native Windows and 200% validation is unavailable, and the final issue-branch complete gate is pending.

No product failure was observed during this package. The local executor did not produce a Playwright or focused ESLint result, so those outcomes are pending rather than failed. Design A remains binding: only Notes and 日本語 are owner-backed workspaces; Archive is an action without an Archive browsing destination; Reminders, Labels, and Trash remain absent.

## 100-point scorecard

Scoring uses only `0`, half, or full credit for every named measure in [UX quality baseline](UX_QUALITY_BASELINE.md). The raw sum is `90`; final rounding does not change it. Existing product tests received credit because run #331 was green on the accepted integrated base and the later commits before this document change only design, planning, or evidence files. The new focused issue #73 suite receives no execution credit while its run is blocked.

| Category | Weight | Floor | Score | Floor result |
| --- | ---: | ---: | ---: | --- |
| Information architecture | 20 | 16 | 17 | MET |
| Core workflow efficiency | 20 | 16 | 16 | MET |
| Visual hierarchy/readability | 15 | 12 | 15 | MET |
| Keyboard/accessibility | 20 | 16 | 20 | MET |
| Resize/zoom resilience | 10 | 8 | 7 | **FAILED FLOOR** |
| Feedback/recovery | 10 | 8 | 10 | MET |
| Consistency/polish | 5 | 4 | 5 | MET |
| **Total** | **100** | **90** | **90** | Total met; release conditions not met |

### Information architecture — 17/20

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Editor priority | 5/5 | [`Notes opens on the board with the shared editor overlay closed`](../tests/e2e/note-editor-overlay.spec.mjs) and [`editor overlay owns drawing projection, title, save status, Details, and More without permanent Save`](../tests/e2e/editor-list-contract.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| Semantic shell | 5/5 | [`shell exposes coherent application and editor-context landmarks without telemetry`](../tests/e2e/editor-shell.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| Workspace separation | 4/4 | [`app is the single browser composition root for both workspaces`](../tests/unit/application-composition.test.mjs) via `npm run test:unit`, plus [`Notes remains default and workspace switching preserves the active ordinary note`](../tests/e2e/japanese-workspace.spec.mjs) via `npm run test:e2e`; integrated-base GREEN. |
| Disclosure | 3/3 | [`Details progressively discloses metadata, hides empty backlinks, and returns focus`](../tests/e2e/editor-list-contract.spec.mjs) and [`Japanese Notes exposes Filter A and starts Review from one compact board action`](../tests/e2e/japanese-progressive-disclosure.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| List/grid contract | 0/3 | **UNKNOWN — REQUIRES VALIDATION.** Direct inventory `rg -n -i "list/grid|grid view|view toggle" app.js ui tests` found no owned list/grid state, renderer, or command. A presentation-only list exists, but parity with a grid does not. |

### Core workflow efficiency — 16/20

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Create/open/edit | 4/4 | [`ordinary create opens one centered overlay with compact state and returns focus`](../tests/e2e/note-editor-overlay.spec.mjs) and [`generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`](../tests/e2e/notes-regression.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| Search/navigation | 4/4 | [`generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`](../tests/e2e/notes-regression.spec.mjs) via `npm run test:e2e`, plus [`refresh owns query, selection, and render coordination without DOM events`](../tests/unit/note-workspace-controller.test.mjs) via `npm run test:unit`; integrated-base GREEN. |
| Flush-safe switching | 4/4 | [`select flushes before changing the active note and rejects missing notes`](../tests/unit/note-workspace-controller.test.mjs) via `npm run test:unit`, plus [`query scroll focus and a saved draft survive overlay close and reopen`](../tests/e2e/note-editor-overlay.spec.mjs) via `npm run test:e2e`; integrated-base GREEN. |
| Labelled actions | 4/4 | [`More actions resolves current registry metadata and labelled recoverable delete`](../tests/e2e/editor-list-contract.spec.mjs) and [`failed delete stays retryable and only durable delete exposes Undo without stealing focus`](../tests/e2e/state-recovery.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| List/grid parity | 0/4 | **UNKNOWN — REQUIRES VALIDATION.** No grid mode exists, so selection, ordering, action, focus, and scroll-anchor parity cannot execute. Reproduce the ownership inventory with `rg -n -i "list/grid|grid view|view toggle" app.js ui tests`. |

### Visual hierarchy/readability — 15/15

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Typography/measure | 5/5 | [`accepted Figma aliases and intentional font stacks are exposed by CSS`](../tests/e2e/visual-system.spec.mjs), [`readable editor and long mixed content remain bounded at 1440x900`](../tests/e2e/visual-system.spec.mjs), [`readable editor and long mixed content remain bounded at 1280x720`](../tests/e2e/visual-system.spec.mjs), and [`readable editor and long mixed content remain bounded at 1024x768`](../tests/e2e/visual-system.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| Semantic tokens/contrast | 5/5 | [`accepted Figma aliases and intentional font stacks are exposed by CSS`](../tests/e2e/visual-system.spec.mjs), [`primary, secondary, quiet, and destructive controls expose distinct bounded variants`](../tests/e2e/control-variants.spec.mjs), and [`core controls expose visible focus and composite search focus`](../tests/e2e/visual-system.spec.mjs); integrated-base GREEN via `npm run test:e2e`. Reproducible token calculation gives primary text/base `18.17:1`, secondary/raised `10.13:1`, black/primary action `7.58:1`, danger/overlay `6.47:1`, and focus/base `9.19:1`. |
| Appearance registry | 3/3 | The render-only semantic registry is directly asserted by [`accepted Figma aliases and intentional font stacks are exposed by CSS`](../tests/e2e/visual-system.spec.mjs); integrated-base GREEN via `npm run test:e2e`. It does not claim a persisted appearance picker or field. |
| State polish | 2/2 | [`selected, disabled, busy, invalid, and destructive states are not color-only`](../tests/e2e/visual-system.spec.mjs) and [`success, warning, and error status utilities include non-color indicators`](../tests/e2e/visual-system.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |

### Keyboard/accessibility — 20/20

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Registry | 5/5 | [`registry rejects duplicate IDs and enforces a literal command bound`](../tests/unit/command-registry.test.mjs) and [`execute by ID and direct shortcut dispatch invoke the same registered run closure`](../tests/unit/command-registry.test.mjs); integrated-base GREEN via `npm run test:unit`. |
| Browser precedence | 4/4 | [`application create shortcut yields to an active editor draft`](../tests/e2e/command-registry-red.spec.mjs) via `npm run test:e2e` and [`text editing and IME composition suppress broad commands while editor-scoped save remains available`](../tests/unit/command-registry.test.mjs) via `npm run test:unit`; integrated-base GREEN. |
| IME | 4/4 | [`IME composition suppresses shell navigation commands`](../tests/e2e/command-registry-red.spec.mjs) and [`sequence state resets on timeout, context change, composition start, explicit reset, and destroy`](../tests/unit/command-registry.test.mjs); integrated-base GREEN via `npm run test:e2e` and `npm run test:unit`. |
| Modal/focus | 4/4 | [`the editor modal isolates background note navigation shortcuts`](../tests/e2e/note-editor-overlay.spec.mjs), [`review modal isolates background note-navigation commands`](../tests/e2e/command-registry-red.spec.mjs), and [`keyboard traversal includes editor context actions and reaches the shell deterministically`](../tests/e2e/editor-shell.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| Names/reasons/announcements | 3/3 | [`an unavailable command must expose a current actionable reason`](../tests/unit/command-registry.test.mjs) via `npm run test:unit`, plus [`healthy visual statuses are not repeated live announcements`](../tests/e2e/state-recovery.spec.mjs) via `npm run test:e2e`; integrated-base GREEN. |

### Resize/zoom resilience — 7/10

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Three viewports | 5/5 | [`board overlay and note transient surfaces stay contained at 1024x768`](../tests/e2e/desktop-resilience.spec.mjs), [`board overlay and note transient surfaces stay contained at 1280x720`](../tests/e2e/desktop-resilience.spec.mjs), and [`board overlay and note transient surfaces stay contained at 1440x900`](../tests/e2e/desktop-resilience.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| 200% zoom | 0/3 | **UNKNOWN — REQUIRES VALIDATION.** [`note and command transient surfaces stay contained during 720x450 narrow-layout stress`](../tests/e2e/desktop-resilience.spec.mjs) passes through `npm run test:e2e`, but it is only a responsive-layout proxy and cannot prove native Chrome/Edge 200% zoom or OS scaling. |
| Live resize/state continuity | 2/2 | [`live desktop resize preserves query draft overlay and logical focus`](../tests/e2e/desktop-resilience.spec.mjs), [`drawing projection and canonical entries remain invariant through desktop resize`](../tests/e2e/desktop-resilience.spec.mjs), and [`Japanese filters create menu and review state survive desktop resize`](../tests/e2e/desktop-resilience.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |

### Feedback/recovery — 10/10

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Save distinction | 3/3 | [`note save failure preserves draft and retry succeeds quietly`](../tests/e2e/state-recovery.spec.mjs), [`derived search failure reports saved canonical data and survives reload`](../tests/e2e/state-recovery.spec.mjs), and [`derived degradation states that canonical data is saved`](../tests/unit/state-presentation.test.mjs); integrated-base GREEN via `npm run test:e2e` and `npm run test:unit`. |
| Delete/Undo | 3/3 | [`failed delete stays retryable and only durable delete exposes Undo without stealing focus`](../tests/e2e/state-recovery.spec.mjs) and [`palette delete, undo, and Delete key keep enrolled note and review atomic across reloads`](../tests/e2e/japanese-delete.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |
| Disabled reasons | 2/2 | [`Japanese commands remain discoverable with a degraded-state reason`](../tests/e2e/command-registry-red.spec.mjs) and [`snapshot evaluates current availability and retains unavailable commands with reasons`](../tests/unit/command-registry.test.mjs); integrated-base GREEN via `npm run test:e2e` and `npm run test:unit`. |
| Recovery/focus | 2/2 | [`reset cancellation mutates no data and restores focus to Reset trigger`](../tests/e2e/state-recovery.spec.mjs) and [`drawing failure preserves draft, retry projects silently, and failed delete preserves saved drawing`](../tests/e2e/state-recovery.spec.mjs); integrated-base GREEN via `npm run test:e2e`. |

### Consistency/polish — 5/5

| Named measure | Credit | Evidence, result, and exact command |
| --- | ---: | --- |
| Shared patterns | 2/2 | [`board-first shell has one application header and one shared editor overlay header`](../tests/unit/application-composition.test.mjs) via `npm run test:unit`, plus [`ordinary and Japanese notes share the direct drawing projection`](../tests/e2e/note-drawing-projection.spec.mjs) via `npm run test:e2e`; integrated-base GREEN. |
| No dead/duplicate controls | 2/2 | [`editor overlay owns drawing projection, title, save status, Details, and More without permanent Save`](../tests/e2e/editor-list-contract.spec.mjs), [`explicit save and delete remain discoverable through the shared command registry`](../tests/e2e/editor-list-contract.spec.mjs), and direct shell inventory `rg -n "notesWorkspaceButton|japaneseWorkspaceButton|Reminders|Labels|Archive|Trash" index.html`; existing tests were integrated-base GREEN via `npm run test:e2e`. The final expanded native/focusable count-only healthy-control audit is pending and adds no score credit. |
| Honest boundaries | 1/1 | Direct source inventory confirms two owner-backed workspace controls, no deferred destination controls, and one owned Archive action. Reproduce with `rg -n "notesWorkspaceButton|japaneseWorkspaceButton|notes.archive|Reminders|Labels|Trash" index.html app.js`. The broader [`release shell exposes only owner-backed navigation and bounded commands`](../tests/e2e/ux-release-gate.spec.mjs) remains pending and is not used for this point. |

## Evidence map

The evidence map was built in four steps:

1. Enumerate test declarations with `rg -n '^\s*(test|it)(\.\w+)?\(' tests/unit tests/integration tests/e2e tests/repository-content.contract.test.mjs`.
2. Read every cited test body directly, including setup, assertions, and failure diagnostics; do not infer coverage from filenames.
3. Map each accepted scorecard measure exactly once to an exact test title, direct source/measurement command, and the package script that executes it.
4. Separate historical execution from pending evidence: run #331 supports accepted-base tests only; `ux-release-gate.spec.mjs` and final PR CI remain pending and award no execution credit.

| Evidence family | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Shell/composition | `shell exposes coherent application and editor-context landmarks without telemetry`; `app is the single browser composition root for both workspaces`; `npm run test:e2e`; `npm run test:unit` | Integrated-base GREEN | Final branch pending |
| Ordinary workflow | `generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`; `edited synthetic note survives a save-triggered reload`; `npm run test:e2e` | Integrated-base GREEN | Ordinary lifecycle/storage owners |
| Commands | `text editing and IME composition suppress broad commands while editor-scoped save remains available`; `palette and direct shortcut share Notes-workspace availability`; `npm run test:unit`; `npm run test:e2e` | Integrated-base GREEN | Shared registry |
| Visual/resize | `readable editor and long mixed content remain bounded at 1440x900`; `readable editor and long mixed content remain bounded at 1280x720`; `readable editor and long mixed content remain bounded at 1024x768`; `live desktop resize preserves query draft overlay and logical focus`; `npm run test:e2e` | Integrated-base GREEN | Native zoom excluded |
| Japanese | `fresh database completes all five templates, duplicate guards, dashboard metrics, close/resume, and all rating controls`; `Japanese lifecycle keeps note and review persistence atomic across create, rating, delete, undo, and redo`; `npm run test:e2e`; `npm run test:integration` | Integrated-base GREEN | Japanese coordinator/actions/storage |
| Saved-grid | `saved-grid canvas supports tools, history, durable editing, recovery, and export`; `delete, restore, export, and import remain atomic service operations`; `npm run test:e2e`; `npm run test:unit` | Integrated-base GREEN | Saved-grid application service |
| Persistence/migration | `valid legacy fixture commits canonical notes and returns a bounded outcome`; `a source changed during normalization is rejected before any legacy write`; `canonical upsert failure rejects before memory or derived commit`; `npm run test:integration` | Integrated-base GREEN | Storage/lifecycle owners |
| Content contract | `tracked repository text is English-only`; `tracked repository text contains no tool-specific provenance markers`; `npm run test:content` | Integrated-base GREEN | Final branch pending |
| Focused #73 cross-package | `release shell exposes only owner-backed navigation and bounded commands` (including an expanded native/focusable count-only healthy-control audit); `workspace transitions preserve ordinary context and keyboard return`; all four named viewport cases (healthy containment plus a one-shot bootstrap storage failure, reachable Retry/Reset recovery controls, recovery containment, and Retry recovery); `saved-grid drawing stays local and outside canonical note content` (including the expanded count-only audit with the drawing dialog open); `npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs --project=chromium` | ENVIRONMENT BLOCKED | No product RED observed; no score credit |

## Workflow matrix

| Workflow | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Ordinary create | `ordinary create opens one centered overlay with compact state and returns focus`; `npm run test:e2e` | Integrated-base GREEN | Existing note lifecycle and shared overlay |
| Ordinary edit/save | `generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`; `npm run test:e2e` | Integrated-base GREEN | Autosave/explicit flush owner unchanged |
| Ordinary search | `ordinary no-match is distinct and Clear search restores notes`; `npm run test:e2e` | Integrated-base GREEN | Search worker/controller; no-result preserves editor |
| Ordinary navigation | `refresh owns query, selection, and render coordination without DOM events`; `npm run test:unit` | Integrated-base GREEN | `NoteWorkspaceController` |
| Pin | `generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`; `npm run test:e2e` | Integrated-base GREEN | Existing note mutation action |
| Archive action | `generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`; `npm run test:e2e` | Integrated-base GREEN | Action only; no Archive browsing destination |
| Delete | `failed delete stays retryable and only durable delete exposes Undo without stealing focus`; `npm run test:e2e` | Integrated-base GREEN | Persist-first lifecycle |
| Undo | `More actions resolves current registry metadata and labelled recoverable delete`; `npm run test:e2e` | Integrated-base GREEN | Command stack and lifecycle capture |
| Export | `generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational`; `npm run test:e2e` | Integrated-base GREEN | Markdown/JSON download owners |
| Reload | `edited synthetic note survives a save-triggered reload`; `npm run test:e2e` | Integrated-base GREEN | IndexedDB canonical note storage |
| Bootstrap recovery reachability | The final focused #73 viewport cases use a one-shot IndexedDB-open failure, assert visible in-viewport `#applicationRecovery`, Retry, and Reset local data controls, assert recovery horizontal containment, then assert Retry hides recovery; focused #73 browser command | ENVIRONMENT BLOCKED | Count-only/synthetic diagnostic; no execution credit |
| Japanese five note types | `fresh database completes all five templates, duplicate guards, dashboard metrics, close/resume, and all rating controls`; `npm run test:e2e` | Integrated-base GREEN | Vocabulary, Kanji, grammar, output, planner canonical templates |
| Japanese filters | `Japanese filters compose with search, validate ranges, and stay workspace-local`; `npm run test:e2e` | Integrated-base GREEN | Filter controller/result policy |
| Japanese Review | `review content stays hidden, close resumes, and all ratings are keyboard reachable`; `npm run test:e2e` | Integrated-base GREEN | Reveal-first modal and scheduler lifecycle |
| Japanese delete/recovery | `palette delete, undo, and Delete key keep enrolled note and review atomic across reloads`; `npm run test:e2e` | Integrated-base GREEN | Atomic note/review lifecycle |
| Japanese export | `Markdown and JSON exports retain Japanese note content while scheduling metadata stays separate`; `npm run test:e2e` | Integrated-base GREEN | Scheduling metadata remains isolated |
| List/grid parity | Direct ownership inventory command in the scorecard | **BLOCKED** | Requires separately approved state/query/render/command ownership |

## Command ownership and discovery

| Command claim | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| One bounded registry | `registry rejects duplicate IDs and enforces a literal command bound`; `npm run test:unit` | Integrated-base GREEN | Registry bound is 128 registrations |
| Availability and reasons | `snapshot evaluates current availability and retains unavailable commands with reasons`; `npm run test:unit` | Integrated-base GREEN | Current context is evaluated at snapshot/dispatch time |
| Palette/shortcut parity | `execute by ID and direct shortcut dispatch invoke the same registered run closure`; `npm run test:unit` | Integrated-base GREEN | Shared run closure |
| Direct-control parity | `quick-create UI and palette expose the same command identity and unavailable reason`; `npm run test:e2e` | Integrated-base GREEN | Japanese create disclosure consumes registry metadata |
| Browser/input precedence | `application create shortcut yields to an active editor draft`; `npm run test:e2e` | Integrated-base GREEN | Broad commands do not replace an active typed draft |
| IME precedence | `IME composition suppresses shell navigation commands`; `npm run test:e2e` | Integrated-base GREEN | Composition suppresses application navigation |
| Modal isolation | `palette and review-modal scopes isolate background commands`; `npm run test:unit` | Integrated-base GREEN | Palette, editor, and Review keep distinct scope |
| Focus return | `keyboard traversal includes editor context actions and reaches the shell deterministically`; `npm run test:e2e` | Integrated-base GREEN | Logical opener/card/control receives focus |
| Focused forbidden-control audit | The final focused suite scans visible native and user-operable/focusable controls: buttons, links/areas, non-hidden inputs, selects, textareas, summary/details, role-bearing elements, nonnegative tabindex, editable/clickable elements, applicable media/embed surfaces, and their accessible-name corpus (relevant text, ARIA references, associated labels, title, ID, name, placeholder, type, and declarative value). It returns only a numeric count and asserts zero for the forbidden release families on the healthy shell and with drawing open. | ENVIRONMENT BLOCKED | No matched text, user content, URL, path, or identifier leaves the browser context |
| Release inventory | Static registration count: 21 application commands, 5 Japanese create commands, 3 saved-grid commands, and 1 saved-grid import command | 30 registered definitions | Source command: `rg -n 'id: "[a-z].*\.' app.js japaneseApp.js ui/kanjiInkView.js ui/kanjiInkImportCommand.js` |

## Viewport, zoom, input, focus, and motion matrix

| Target | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| `1024×768` | `board and centered overlay remain bounded in both workspaces at 1024x768`; `readable editor and long mixed content remain bounded at 1024x768`; `board overlay and note transient surfaces stay contained at 1024x768`; `npm run test:e2e` | Integrated-base GREEN | Supported Chromium CSS viewport |
| `1280×720` | `board and centered overlay remain bounded in both workspaces at 1280x720`; `readable editor and long mixed content remain bounded at 1280x720`; `board overlay and note transient surfaces stay contained at 1280x720`; `npm run test:e2e` | Integrated-base GREEN | Supported Chromium CSS viewport |
| `1440×900` | `board and centered overlay remain bounded in both workspaces at 1440x900`; `readable editor and long mixed content remain bounded at 1440x900`; `board overlay and note transient surfaces stay contained at 1440x900`; `npm run test:e2e` | Integrated-base GREEN | Supported Chromium CSS viewport |
| `720×450` layout proxy | `note and command transient surfaces stay contained during 720x450 narrow-layout stress`; `npm run test:e2e` | Integrated-base GREEN | Responsive-layout proxy only |
| Focused recovery reachability at all four viewports | The final focused viewport cases reload into a one-shot IndexedDB-open failure, keep recovery, Retry, and Reset local data controls within the CSS viewport, preserve horizontal containment, and verify Retry restores the ready shell | ENVIRONMENT BLOCKED | Responsive evidence only when executed; it is not native Windows/200% credit |
| Live resize | `live desktop resize preserves query draft overlay and logical focus`; `npm run test:e2e` | Integrated-base GREEN | Query, draft, selection, scroll, and focus retained |
| Keyboard | `keyboard traversal includes editor context actions and reaches the shell deterministically`; `npm run test:e2e` | Integrated-base GREEN | Non-drawing journeys covered |
| Desktop mouse | `generic Notes create, edit, search, navigation, pin, archive, export, and recovery remain operational` and `saved-grid canvas supports tools, history, durable editing, recovery, and export`; `npm run test:e2e` | Integrated-base GREEN | Automated pointer input, not physical pen |
| Reduced motion | `interactive visual states do not require motion`; `npm run test:e2e` | Integrated-base GREEN | Translation/animation durations resolve to zero |
| Focus return | `ordinary create opens one centered overlay with compact state and returns focus`; `npm run test:e2e` | Integrated-base GREEN | Card, visible create control, and disclosure openers covered |
| Native Windows Chrome/Edge 200% | No direct run | **UNKNOWN — REQUIRES VALIDATION** | Owner-recorded manual browser evidence required |
| OS-level scaling, physical pen, screen reader | No direct run | **UNKNOWN — REQUIRES VALIDATION** | Manual platform/accessibility owner required |

## Saved-grid privacy and compatibility

| Claim | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| V1 read/export | `legacy V1 cards remain read-only and losslessly exportable`; `npm run test:e2e` | Integrated-base GREEN | Historical fields preserved without reinterpretation |
| V2 create/edit | `saved-grid canvas supports tools, history, durable editing, recovery, and export`; `npm run test:e2e` | Integrated-base GREEN | Stable entry identity and exact strokes persist |
| V2 delete/restore | `mixed legacy and canvas entries survive list, delete, note-delete, and restore losslessly`; `npm run test:integration` | Integrated-base GREEN | Atomic dependent lifecycle |
| Mixed import/export | `restores tagged schema-4 mixed ink atomically and losslessly`; `npm run test:integration` | Integrated-base GREEN | V1/V2 bundle validation precedes mutation |
| Projection above editor | `saved drawing projects directly above title and survives reopen without mutating note content`; `npm run test:e2e` | Integrated-base GREEN | Presentation stays outside title/body ownership |
| Zero-state collapse | `editor overlay owns drawing projection, title, save status, Details, and More without permanent Save`; `npm run test:e2e` | Integrated-base GREEN | No empty permanent drawing region |
| Bounded entry/stroke/point/history | `V2 accepts the exact 4,096-point capacity under canonical JSON size measurement`; `History retains no more than 100 committed draft states`; `npm run test:unit` | Integrated-base GREEN | 32 strokes, 256 points per stroke, 4,096 total points, 100 drawing draft states |
| V1-only search | `mixed search projects only confirmed V1 characters`; `npm run test:unit` | Integrated-base GREEN | V2 contributes no inferred character text |
| No invented recognition data | `V2 human-readable export does not invent recognition data`; `npm run test:unit` | Integrated-base GREEN | V2 has no guessed Unicode |
| Local network boundary | `saved-grid canvas supports tools, history, durable editing, recovery, and export`; `npm run test:e2e` | Integrated-base GREEN | Existing base test observed no external request; focused #73 count-only request assertion remains pending |
| Physical Windows pen | No direct run | **UNKNOWN — REQUIRES VALIDATION** | Automated pointer events are not hardware evidence |

## Failure and recovery

| Failure/recovery claim | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Canonical upsert failure | `canonical upsert failure rejects before memory or derived commit`; `npm run test:integration` | Integrated-base GREEN | No memory/derived success before storage |
| Canonical delete failure | `canonical delete failure leaves memory and derived state untouched`; `npm run test:integration` | Integrated-base GREEN | Delete remains retryable |
| Derived degradation | `derived upsert failure preserves canonical commit and reports degradation`; `npm run test:integration` | Integrated-base GREEN | Canonical success remains truthful |
| Save retry | `note save failure preserves draft and retry succeeds quietly`; `npm run test:e2e` | Integrated-base GREEN | Draft and focus retained |
| Delete/Undo | `failed delete stays retryable and only durable delete exposes Undo without stealing focus`; `npm run test:e2e` | Integrated-base GREEN | Undo shown only after durable delete |
| Drawing retry/delete | `drawing failure preserves draft, retry projects silently, and failed delete preserves saved drawing`; `npm run test:e2e` | Integrated-base GREEN | Exact drawing draft/canonical entry retained |
| Rating retry | `Japanese no-result preserves context and rating failure keeps the same review item`; `npm run test:e2e` | Integrated-base GREEN | Same item and pending intent retained |
| Migration atomicity | `mixed valid and invalid records are rejected atomically on every retry`; `npm run test:integration` | Integrated-base GREEN | Invalid legacy source is not partly imported |
| Explicit reset | `reset cancellation mutates no data and restores focus to Reset trigger`; `npm run test:e2e` | Integrated-base GREEN | Reset requires an explicit confirmation surface |
| Bounded announcements | `healthy visual statuses are not repeated live announcements`; `npm run test:e2e` | Integrated-base GREEN | Blocking failures assertive; routine success quiet |

## Performance and retained resources

General startup, worker-search, typing, autosave, and long-session memory values in [Performance budget](PERFORMANCE_BUDGET.md) remain targets, not measured guarantees; no representative checked-in benchmark closes them.

The focused resource command is `npx --no-install playwright test tests/e2e/kanji-resource.spec.mjs --project=chromium`. Its exact test title is [`bounded drawing evidence validates maximum V2 shape, reloads note context, and renders 64 previews`](../tests/e2e/kanji-resource.spec.mjs). The checked-in 2026-08-10 record identifies only Windows and the Playwright Chromium project. It does not record the executed Windows edition/build, Node.js, npm, Playwright, or Chromium versions. The repository lock at the recorded documentation revision pins Playwright `1.62.0`, whose browser metadata pins Chrome for Testing and Chrome Headless Shell `151.0.7922.34` revision `1234`, but a repository pin is not proof of the executable used by that historical Windows command. Consequently, these historical timings are retained as raw observations, not release-certified performance passes.

| Operation | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Validate and codec-serialize maximum V2 shape | Synthetic fixture: 32 strokes, one 256-point stroke, 4,096 total points. Warm-up: 1 combined validation/serialization operation. Samples: 5. Individual durations: `105.4`, `104.6`, `87.9`, `93.3`, `105.8 ms`. Executed environment: Windows; exact edition/build, Node.js, npm, Playwright, and Chromium versions are **UNKNOWN — REQUIRES VALIDATION**. Thresholds: every duration `<1,000 ms`; canonical JSON `≤262,144 bytes`; codec envelope `≤8,388,608 bytes`. Actual byte measurements: **UNKNOWN — REQUIRES VALIDATION**; the checked-in record says only that both assertions passed. | **UNKNOWN — REQUIRES VALIDATION.** Recorded durations are below the tripwire, but the exact environment and byte measurements are absent. | Historical timing observation only; do not compare with unlike machines or promote it to a release guarantee. |
| Load/reload note context | Synthetic fixture: 65 valid minimal V2 entries. Warm-up: 0 explicit operations for this measured phase. Samples: 2 synchronization calls. Individual durations: `4.9`, `5.0 ms`. Executed environment: Windows; exact edition/build, Node.js, npm, Playwright, and Chromium versions are **UNKNOWN — REQUIRES VALIDATION**. Threshold: every call `<2,000 ms`. | **UNKNOWN — REQUIRES VALIDATION.** Recorded durations are below the tripwire, but the exact environment is absent. | Historical timing observation only; do not compare with unlike machines. |
| Render projection window | Synthetic fixture: the same 65-entry note, with 1 primary preview before disclosure and 64 previews after disclosure. Warm-up: 0 explicit 64-preview disclosure operations; the initial one-preview render is fixture setup. Samples: 1 expanded-window disclosure. Individual duration: `175 ms`. Executed environment: Windows; exact edition/build, Node.js, npm, Playwright, and Chromium versions are **UNKNOWN — REQUIRES VALIDATION**. Threshold: expanded render `<5,000 ms`, with exactly 64 previews and older-entry disclosure still visible. | **UNKNOWN — REQUIRES VALIDATION.** The recorded duration and counts are within their tripwires, but the exact environment is absent. | Historical timing observation only; do not compare with unlike machines. |
| Repeated open/close — deterministic resource assertion, not timing evidence | `repeated open and close retains one dialog, stylesheet, command, and bounded desktop layout`; focused resource command above | Integrated-base GREEN | 17-cycle checked-in loop; warm-up, timing samples, durations, and timing threshold are not applicable. Run #331 uses the exact integrated-base CI environment recorded above. |
| Pointer fallback cleanup — deterministic resource assertion, not timing evidence | `capture fallback finishes outside releases and leaves no temporary document listeners`; focused resource command above | Integrated-base GREEN | Temporary document listeners removed; warm-up, timing samples, durations, and timing threshold are not applicable. Run #331 uses the exact integrated-base CI environment recorded above. |
| Preview observer cleanup — deterministic resource assertion, not timing evidence | `preview layout observer ownership stays bounded across hidden synchronization and teardown`; focused resource command above | Integrated-base GREEN | Observer ownership remains bounded; warm-up, timing samples, durations, and timing threshold are not applicable. Run #331 uses the exact integrated-base CI environment recorded above. |
| Command/history bounds — deterministic resource assertion, not timing evidence | `registry rejects duplicate IDs and enforces a literal command bound`; `history enforces literal operation and snapshot bounds`; `npm run test:unit` | Integrated-base GREEN | Command, operation, snapshot, and detailed-patch retention are literal bounds; warm-up, timing samples, durations, and timing threshold are not applicable. Run #331 uses the exact integrated-base CI environment recorded above. |

## Security and artifact hygiene

| Claim | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Markdown/wiki text remains inert | `note cards use bounded plain text and semantic non-color selection without a permanent delete control`; `npm run test:e2e` | Integrated-base GREEN | Hostile markup-like fixture is projected as text |
| Parser metadata bounded/deterministic | `an unclosed fence is deterministic and excludes apparent metadata through end of input`; `npm run test:unit` | Integrated-base GREEN | Tags/links/code stay parser-owned |
| Worker/storage shapes bounded | Direct worker source validation plus `valid legacy fixture commits canonical notes and returns a bounded outcome` and `invalid bundle is rejected before opening a transaction`; `npm run test:integration` | Integrated-base GREEN for storage; source-verified for worker | Worker caps query, rebuild, title/content, tag, and link shapes; malformed-envelope browser injection is not separately checked in |
| Canonical before derived success | `canonical upsert failure rejects before memory or derived commit`; `derived upsert failure preserves canonical commit and reports degradation`; `npm run test:integration` | Integrated-base GREEN | Persistence result remains authoritative |
| Content-free diagnostics | `registry rejects malformed commands with stable content-free errors`; `V1 unknown fields reject hostile getters without leaking caller content`; `npm run test:unit` | Integrated-base GREEN | Stable error codes/counts only |
| Explicit reset confirmation | `application recovery is non-destructive until reset confirmation`; `npm run test:unit` | Integrated-base GREEN | No automatic destructive bootstrap action |
| No V2 recognizer/model/dataset path | `controller persistence is recognizer-free and preserves V2 edit identity`; `V2 human-readable export does not invent recognition data`; `npm run test:unit` | Integrated-base GREEN | Historical V1 attribution remains compatibility data only |
| No normal-product telemetry surface | `shell exposes coherent application and editor-context landmarks without telemetry`; `npm run test:e2e` | Integrated-base GREEN | Local diagnostic measurements are not normal UI |
| Focused forbidden-control diagnostic | Final focused evidence returns only the numeric count of visible forbidden-family controls from its expanded native/focusable inventory in the healthy shell and open drawing dialog; focused #73 browser command | PENDING | The accessible-name corpus stays in page context; it does not serialize matched text, user content, URLs, paths, or fixture identifiers |
| Focused release request diagnostic | `saved-grid drawing stays local and outside canonical note content`; focused #73 browser command | PENDING | Commit `3acab30` uses a count-only external-request assertion; no paths, methods, query text, or user identifiers can appear in its custom diagnostic |
| Release document artifacts | Static tables contain only test titles, counts, synthetic fixture shapes, commands, and aggregate measurements | PASS | No user note text, imported source data, raw vectors, browser-profile material, authentication material, or content-bearing failure output is stored here |

## Findings and ownership

| Severity/finding | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| **P1 — List/grid release contract has no canonical owner** | Scorecard ownership inventory | UNRESOLVED | #73 may audit but cannot add state/query/render/command ownership. Handoff requires a separately approved design/package. |
| **P1 — Required native Windows/200% evidence unavailable** | Compatibility matrix | UNRESOLVED | `720×450` is not native Chrome/Edge zoom, OS scaling, physical pen, or screen-reader evidence. Owner/manual validation required. |
| **P1 — Final issue-branch complete gate pending** | Audited environment table | UNRESOLVED | Resolves only if the one automatic PR CI run is green on the final issue-branch head. |
| P2 — Performance records lack representative, fully reproducible benchmarks | Performance budget and inventory | OPEN | Startup/search/autosave/memory values remain targets; the saved-grid timing record also lacks exact executed versions and recorded byte measurements. The performance owner must add comparable complete benchmark evidence before promoting any result to a guarantee. |
| P2 — Local audit toolchain unsupported | Local Node/npm versions | OPEN | Automatic PR CI must provide supported-toolchain authority. |

No P0 was observed. If automatic CI passes, only the third P1 may be marked resolved in the PR summary. The first two continue to block release.

## Task hierarchy and action counts

Counts are source-level, healthy-state interaction counts at the audited evidence revision; hidden recovery controls are excluded until their state is active.

| Region/level | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Workspace navigation | `shell exposes coherent application and editor-context landmarks without telemetry`; `npm run test:e2e` | 2 controls | Notes and 日本語 only; 0 deferred destinations |
| Global shell task row | Direct `index.html` inventory | 5 interactive controls | 2 workspace buttons, Search, 1 contextual create trigger, Refresh; note count/save state are status-only |
| Bootstrap recovery (active failure state) | Final focused #73 viewport cases | 2 actions | Retry and Reset local data are asserted reachable only while recovery is active; focused execution remains ENVIRONMENT BLOCKED |
| Ordinary editor header | `editor overlay owns drawing projection, title, save status, Details, and More without permanent Save`; `npm run test:e2e` | 4 buttons | Pin, Details, More, Close; Save remains a command, not a duplicate permanent button |
| Ordinary More menu | `More actions resolves current registry metadata and labelled recoverable delete`; `npm run test:e2e` | 3 actions | Archive, Add drawing, Delete |
| Japanese primary entry | `Japanese Notes exposes Filter A and starts Review from one compact board action`; `npm run test:e2e` | 1 create trigger; 1 Review entry | Five create actions appear only in the disclosure/palette |
| Japanese create disclosure | `quick-create disclosure exposes every action through native keyboard traversal`; `npm run test:e2e` | 5 actions | Vocabulary, Kanji, grammar, output, planner |
| Japanese common filters | `Japanese filters compose with search, validate ranges, and stay workspace-local`; `npm run test:e2e` | 5 named filters + 1 disclosure | Four enabled; Reading remains disabled with an exact reason; `+ Filter` owns advanced controls |
| Drawing task | `saved-grid canvas supports tools, history, durable editing, recovery, and export`; `npm run test:e2e` | 8 buttons | Close, three tools, Undo, Redo, Clear, Save |
| Command discovery | Static registration inventory in the command matrix | 30 definitions | Bounded registry; unavailable owned commands remain discoverable with reasons |

The hierarchy keeps one dominant create/review/save action per bounded region, places rare note actions in More, places complete metadata in Details, and isolates Review and drawing as modal tasks. An unowned capability has zero visible controls.

## Unknowns and compatibility boundary

| Boundary | Evidence | Result | Notes/owner |
| --- | --- | --- | --- |
| Chromium on Ubuntu CI | Final PR run not started | **UNKNOWN — REQUIRES VALIDATION** | Automatic PR gate is authoritative |
| Native Windows Chrome 200% | No direct evidence | **UNKNOWN — REQUIRES VALIDATION** | Required manual validation |
| Native Windows Edge 200% | No direct evidence | **UNKNOWN — REQUIRES VALIDATION** | Required manual validation |
| Windows OS display scaling | No direct evidence | **UNKNOWN — REQUIRES VALIDATION** | Required manual validation |
| Physical pen | Automated mouse/pointer evidence only | **UNKNOWN — REQUIRES VALIDATION** | Required manual validation |
| Screen-reader/browser pairing | No recorded pairing | **UNKNOWN — REQUIRES VALIDATION** | Accessibility owner required |
| Forced-colors behavior | No direct run | **UNKNOWN — REQUIRES VALIDATION** | Accessibility owner required |
| Mobile/tablet/touch-first/virtual keyboard/native wrapper | Outside M2 desktop boundary | **UNKNOWN — REQUIRES VALIDATION** | Unsupported; no release credit |
| Firefox, Safari, and other untested browsers | No direct run | **UNKNOWN — REQUIRES VALIDATION** | Unsupported/unverified |
| Reminders, Labels, Archive browsing, Trash | No complete owner | BLOCKED/DEFERRED | Controls remain absent; not #73 implementation scope |

## Reproduction commands

Inventory and direct evidence lookup:

```sh
rg -n '^\s*(test|it)(\.\w+)?\(' tests/unit tests/integration tests/e2e tests/repository-content.contract.test.mjs
rg -n -i "list/grid|grid view|view toggle" app.js ui tests
rg -n "notesWorkspaceButton|japaneseWorkspaceButton|notes.archive|Reminders|Labels|Trash" index.html app.js
```

Supported complete repository gate:

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

Focused cross-package and saved-grid resource evidence:

```sh
npx --no-install playwright test tests/e2e/ux-release-gate.spec.mjs --project=chromium
npx --no-install playwright test tests/e2e/kanji-resource.spec.mjs --project=chromium
```

Do not reinterpret the blocked local focused command as a pass or fail. Do not rerun unchanged executor-blocked commands merely to seek a different classification; use the automatic PR run on the supported toolchain.

## Final decision

**BLOCKED — 90/100.** The total threshold is met, but resize/zoom resilience is **7/10** against the required **8/10** floor. The list/grid contract is ownerless, required native Windows/200% evidence is unavailable, and final issue-branch CI is pending. Therefore the release has one failed category floor and three unresolved P1 findings.

Issue #73 must remain open and must not be marked review/completed. A green automatic PR run may resolve only the pending-CI finding in the PR summary; it cannot supply the missing list/grid owner or native/manual evidence.
