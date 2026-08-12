# UX quality baseline

Issue: [#65](https://github.com/Dyu20705/myNote/issues/65)

Stage: 0 — audit, design acceptance, and interaction architecture

Repository scope: documentation only

Lifecycle after merge of PR #78: **Accepted design contract**. This status does not mean Implemented or Verified runtime behavior.

## 1. Audit identity and evidence boundary

This document records the audited runtime and defines the normative desktop UX contract for issues #66–#74 and the note-action boundary consumed by #69.

| Item | Audited value |
| --- | --- |
| Repository | `Dyu20705/myNote` |
| Audited runtime SHA | `6261eac6a7864ef243bb24a0ed68aca881949a6c` |
| Merged planning-document revision | `1cd07d2c910244fdc4b9fd7489a833d36010bfb9` |
| PR #78 base after dependency reconciliation | `1cd07d2c910244fdc4b9fd7489a833d36010bfb9` |
| Audit date | 2026-08-03 |
| Operating system | Windows NT 10.0.26200.0 |
| Shell | PowerShell 7.6.4 |
| Node.js | v22.20.0 |
| npm | 11.7.0 |
| Time zone | Asia/Bangkok |
| Product boundary | Local-only, dark-first, desktop-browser, editor-first application |

The audit read `AGENTS.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/INVARIANTS.md`, `docs/UX_DESIGN_HANDOFF.md`, `docs/UX_ISSUE_EXECUTION.md`, issue #65 and its amendment, and issue #75.

Evidence terms are strict:

- **Current**: directly observed in source at the audited runtime SHA.
- **Candidate**: represented in Figma but not accepted by a merged repository decision.
- **Accepted**: authorized as design-to-code input by this merged manifest for the exact listed node IDs and contracts.
- **Target**: a normative requirement assigned to a future implementation issue.
- **Implemented**: present in runtime source at a later implementation SHA.
- **Verified**: proven by the required automated and recorded manual evidence at that implementation SHA.
- **Unknown**: `UNKNOWN — REQUIRES VALIDATION`; it receives no implementation or score credit.

Figma remains design evidence. It cannot prove persistence, browser behavior, accessibility-tree output, saved-grid correctness, scheduling correctness, or data durability.

## 2. Product boundary and non-goals

M2 supports desktop browsers with keyboard and desktop mouse at:

- `1024×768`;
- `1280×720`;
- `1440×900`;
- live resize among those desktop widths;
- 200% browser zoom.

The following are outside this baseline unless a later issue explicitly authorizes them:

- mobile or tablet navigation;
- touch-first behavior or virtual keyboards;
- Android, iOS, native wrappers, or PWA installation;
- viewport support below 1024 CSS pixels at 100% zoom;
- a framework migration or external component library;
- a light theme;
- account sync, collaboration, remote telemetry, or network services;
- AI assistance, OCR, translation, or dictionary services;
- general handwriting, whiteboards, or freeform drawing;
- rich-text editing and attachments;
- Japanese V2 learning evidence;
- speculative feature parity with Google Keep.

Issue #65 changes no runtime HTML, CSS, JavaScript, dependencies, schema, persistence, search, review scheduling, Kanji code, or user data.

## 3. Google Keep benchmark boundary

Google Keep is a reference for low-friction capture, information scent, direct manipulation, and progressive disclosure. It is not a visual-parity target.

The review uses the official Google Help pages linked by issue #75 for create/edit, organization, search, shortcuts and list/grid, reminders, sharing, version history, and export.

| Keep pattern | myNote decision | Owner |
| --- | --- | --- |
| Fast create/edit surface | Keep the editor continuously prominent | #66, #68 |
| Search as a primary top-bar action | Adopt through one visible control and one command owner | #66, #74 |
| List/grid presentation | Adopt as session-only presentation state with full parity | #66, #68 |
| Pin, archive, delete | Expose only through real lifecycle owners and labelled actions | #68, #74 |
| Labels, reminders, Trash | Reserve in information architecture; hide until complete owners exist | Later lifecycle issues |
| Color-coded notes | Use ten accessible rendering tokens; no M2 persistence | #67 |
| Collaboration and sync | Reject for current product boundary | Non-goal |
| Remote product analytics | Reject | Non-goal |
| Attachments and rich formatting | Defer to separate data/content contracts | Later issues |

No score is awarded for resemblance to Keep. Points require measurable efficiency, durability, accessibility, privacy, ownership, and recovery evidence.

## 4. Desktop information architecture

### 4.1 Current architecture

The audited runtime has:

- a top bar with product identity, note count, save state, and metrics;
- Ordinary Notes and Japanese workspaces;
- search and create actions;
- a note list and persistent editor;
- a command palette;
- backlinks and metadata;
- Japanese dashboard, filters, quick-create, and review paths.

The product is functional, but telemetry, filters, dashboard cards, diagnostics, backlinks, and equally weighted actions compete with editing.

### 4.2 Target architecture

| Layer | Target content | Ownership rule |
| --- | --- | --- |
| Semantic top bar | Workspace context, search, concise save state, Create, app refresh/reconcile, list/grid | Every control invokes a real command; no decorative or dead control |
| Workspace switch | Ordinary Notes and Japanese | Japanese is a workspace, not an Ordinary destination |
| Ordinary navigation | Reserved: `Notes`, `Reminders`, `Labels`, `Archive`, `Trash` | A destination is visible only after query, empty state, count, commands, persistence, and recovery have owners |
| Japanese subviews | `Notes` and `Review` | Review is an exclusive task mode, not destination six |
| Results region | Search/filter result list or grid | Same IDs, ordering, selection, actions, and empty-state semantics |
| Spotlight editor | One uninterrupted active-note editor | A card is a projection, never a second draft owner |
| Details | Backlinks, metadata, diagnostics, complete handwriting list | Secondary information cannot crowd the editor |
| Modal/task layer | Confirmation, recovery, Review, bounded Kanji task | Background is inert; focus return is deterministic |

At M2 shell delivery, only destinations with complete runtime owners may render. `Reminders`, `Labels`, and `Trash` remain hidden. `Archive` may render only through its existing lifecycle and complete query/empty-state contract.

### 4.3 List/grid contract

List/grid is presentation-only session state, scoped to Ordinary results and defaulting to list on a fresh session.

- Both modes render the same filtered note IDs in the same stable order.
- Both expose equivalent selection, pin, modified time, More actions, keyboard navigation, and empty states.
- Toggling preserves active note, draft, selection, focus context, and a note-ID-plus-offset scroll anchor.
- A one-column grid at 1024 CSS pixels is valid desktop presentation; it does not trigger mobile navigation.
- Toggling never persists appearance, archive, delete, label, or view state to IndexedDB.
- The toggle exposes selected state and a deterministic accessible name.

### 4.4 Spotlight editor contract

- Create uses the canonical create transaction, selects the new note, and focuses Title.
- An existing note restores the last safe logical editor position, otherwise body start.
- There is exactly one draft owner.
- Note, workspace, close, archive, and delete transitions perform the explicit-flush contract first.
- A failed canonical flush blocks the transition and preserves draft, active note, selection, and focus.
- Rapid switching uses the existing one-in-flight plus one-trailing-save discipline.
- Stale completion cannot clear a newer dirty revision or replace a newer draft.
- Resize and zoom cannot mutate note data, dirty state, filters, selection, or review state.

## 5. Journey inventory

### 5.1 Ordinary Notes

| Journey | Current entry | Target completion boundary | Owner |
| --- | --- | --- | --- |
| Create and write | New action, current `Ctrl/Cmd+N` | Retire browser conflict; visible Create or scoped `N` creates canonically and focuses Title | #66, #68, #74 |
| Resume a note | Result selection or keyboard navigation | Same editor opens without draft or scroll loss | #68 |
| Search | Search field, `/`, palette | Results update; no-result never clears the active draft | #66, #68, #72, #74 |
| Change presentation | Not implemented | List/grid parity and anchor/focus preservation pass | #66, #68 |
| Inspect details | Backlinks/metadata exist | Details owns complete secondary information | #68 |
| Pin/archive | Existing actions | Labelled action, visible state, one lifecycle owner | #68, #74 |
| Delete and Undo | Existing transaction/history | Flush, context, persist-first delete, truthful Undo and failure | #68, #72, #74 |
| Recover save failure | Dirty draft and message | Persistent reason, Retry, blocked unsafe transition | #72, #74 |
| Export/reset | Existing palette commands | Preserve bounded current behavior; no Keep parity claim | #74 |

### 5.2 Japanese

| Journey | Current entry | Target completion boundary | Owner |
| --- | --- | --- | --- |
| Create study note | Five quick-create actions | One coherent Create entry and canonical lifecycle | #70, #74 |
| Browse Japanese Notes | Workspace and filters | Board-first Notes with direct common filters and a shared focused editor overlay | #70 lifecycle, #90 presentation |
| Start Review | Start/Resume action | Exclusive task mode; unrelated shell commands are unavailable | #70, #74 |
| Reveal and rate | Reveal then `1`–`4` | Rating unavailable before reveal; IME wins; success advances once | #70, #72, #74 |
| Recover rating failure | Persistence failure | Preserve exact pending rating and current item; retry is idempotent | #70, #72 |
| Add drawing | Note action | Bounded saved-grid drawing; persist before success; no recognition or candidate step | #69 lifecycle, #90 presentation |
| Retry or edit a saved drawing | Direct note-overlay projection | Preserve exact V2 strokes across retry/reload; V1 remains read-only historical data | #69 lifecycle, #90 presentation |
| View saved handwriting | Direct note-overlay projection | Show one newest drawing, disclose older entries inside a bounded region, and consume no space at zero | #69 lifecycle, #90 presentation |

## 6. Surface and command inventory

### 6.1 Surfaces

| Surface | Task/state | Scope | Current owner and target |
| --- | --- | --- | --- |
| Product top bar | Orient, search, create, save state | Global shell | Current shell; #66 removes competing telemetry |
| Workspace switch | Switch Ordinary/Japanese context | Global after flush | Workspace coordinator; #66 |
| Search | Query and derived result IDs | Active workspace | Search pipeline; #66/#68/#74 |
| Create controls | Create correct note type | Notes or Japanese Notes | Lifecycle/Japanese actions; #66/#70/#74 |
| Results list/grid | Find, select, navigate | Active results | Results controller; #68 |
| Editor | Read/edit active draft | Active note | Editor/autosave; #68 |
| Details | Inspect backlinks/metadata/entries | Active note | Current projections; #68/#70 |
| Palette | Discover and run commands | Active command scope | Current palette; registry #74 |
| Japanese dashboard | Understand study state | Japanese Notes | Dashboard selectors; disclosure #70 |
| Japanese filters | Narrow enrolled notes | Japanese Notes | Filter controller; #70 |
| Review | Reveal/rate/resume/complete | Exclusive task | Review controller; #70/#72/#74 |
| Kanji task | Draw/save/retry/discard; edit V2 | Exclusive task | #69 only |
| Delete/Undo feedback | Remove/restore exact note | Active note and feedback | Lifecycle/history; #68/#72/#74 |
| Recovery reset | Repair unusable local state | Exclusive recovery | Storage owner; #72/#74 |
| Empty/no-result/degraded | Explain absent/partial capability | Owning region | State mapper #72 |

### 6.2 Current command inventory

| Command | Task | Target scope/availability owner |
| --- | --- | --- |
| `new` | Create Ordinary note | Notes results; lifecycle and #74 |
| `daily` | Open/create daily note | Notes; lifecycle and #74 |
| `search` | Focus search | Global shell unless modal/task; #74 |
| `code` | Insert code block | Active editor only; #74 |
| `pin` | Toggle active-note pin | Active note; #68/#74 |
| `archive` | Archive active note | Active note; #68/#74 |
| `delete` | Delete active note | Active note after flush; #68/#74 |
| `recent` | Navigate recent note | Notes after flush; #68/#74 |
| `undo` | Undo app command | Non-editor declared scope; #74 |
| `redo` | Redo app command | Non-editor declared scope; #74 |
| `export-md` | Export Markdown | Global data command; #74 adapter |
| `export-json` | Export JSON | Global data command; #74 adapter |
| `recovery-reset` | Reset local database | Exclusive confirmed recovery; #72/#74 |
| `japanese-create-vocabulary` | Create vocabulary note | Japanese Notes when study data usable; #70/#74 |
| `japanese-create-kanji` | Create Kanji note | Japanese Notes; not handwriting #69 |
| `japanese-create-grammar` | Create grammar note | Japanese Notes; #70/#74 |
| `japanese-create-output` | Create output note | Japanese Notes; #70/#74 |
| `japanese-create-planner` | Create planner note | Japanese Notes; #70/#74 |

Direct list navigation, editor focus, explicit flush, Review rating, and boundary jumps must either consume registry records or remain explicitly documented native/scoped handlers.

## 7. State ownership

| State | Authoritative owner | Lifetime | Required transition rule |
| --- | --- | --- | --- |
| Ordinary notes | IndexedDB `notes` via storage | Persistent | Persistence precedes memory/history success |
| Study reviews | IndexedDB `studyReviews` | Persistent | Successful rating writes exactly once |
| Kanji entries | #69 additive store/model | Persistent | V2 contains bounded vectors and no guessed Unicode; V1 remains historical compatibility data |
| Active draft | Editor/controller | Session until save | One draft owner; transition requires flush |
| Dirty flag/revision | Save coordinator | Session | Clear only after latest canonical save |
| Save status | Derived save outcome | Session | Pending, canonical failure, and derived degradation remain distinct |
| Active note ID | Workspace coordinator | Session | Change only after required flush |
| Workspace | Shell coordinator | Session | Restore each workspace query/selection state |
| Ordinary destination | Navigation coordinator | Session | Select only when complete owner exists |
| Japanese subview | Japanese coordinator | Session | Exactly Notes or Review |
| Search query | Workspace coordinator | Session | Never written into a note |
| Japanese filters | Japanese coordinator | Session | Clear explicitly; never persist to a note |
| Result IDs | Search/filter selectors | Derived | Recompute; never persist |
| Backlinks/search indexes | Derived services | Rebuildable | Failure cannot roll back canonical save |
| List/grid | Results presentation | Session only | Preserve active note, focus, anchor |
| Palette state | Command surface | Ephemeral | Close clears query and restores focus |
| Command definition | Central registry | Static runtime | One ID, scope, availability, reason, runner |
| Modal/task | Modal coordinator | Ephemeral | One top layer; background inert |
| Review session/pending rating | Review controller | Session/ephemeral | Failure preserves item and exact intent |
| Kanji V2 draft strokes | #69 task controller | Ephemeral until save | Persist-before-success; failed save retains the exact draft and retry intent |
| Delete Undo entry | Undo coordinator | Bounded session | Created only after successful persistence |
| Feedback/error | State mapper | Severity-bounded | Blocking failure remains visible and actionable |
| Appearance token | #67 registry | Render-only in M2 | Unknown token falls back without data write |
| Behavior intelligence | No M2 owner | Deferred | No store or UI until separate authorization |

## 8. State presentation vocabulary

| State | Required presentation and exit |
| --- | --- |
| Empty | Explain first useful action; Create is focusable |
| Loading | Label owning region; retain stable shell; no fabricated empty state |
| Ready | Normal hierarchy; no repetitive success noise |
| Editing | Editor remains owner; dirty state is perceivable without interrupting typing |
| Saving | Concise persistent pending state; duplicate destructive transitions unavailable |
| Saved | Latest canonical revision persisted; never inferred from index success |
| Failed | Preserve input/focus; persistent reason and Retry |
| Filtering | Active constraint visible and clearable; canonical data unchanged |
| No result | Explain active constraint; Clear available; editor draft remains mounted |
| Degraded | Name safe capabilities and unavailable derived capability; bounded retry |
| Review active | Background inert; reveal/rating availability explicit |
| Review complete | Announce completion and Close Review; no synthetic write |
| Delete pending | Identify note, prevent duplicate action, permit safe cancel before commit |
| Undo available | Identify exact action/object; do not imply restoration before success |
| Undo failed | Keep deleted state truthful; show retry/recovery |
| Recovery | Exclusive labelled surface; consequences and confirmation explicit |

## 9. Progressive disclosure and control hierarchy

The editor is the visual and interaction anchor.

| Level | Content | Prohibited |
| --- | --- | --- |
| Shell | Workspace, search, Create, save state, refresh, view toggle | Dead destinations, diagnostics, destructive confirmation |
| Result/editor context | Title/body, selection, pin, modified time, directly relevant status | Complete metadata and hover-only critical actions |
| More menu | Archive, Delete, and other real note actions | Unowned future controls |
| Details | Backlinks, metadata, complete handwriting entries, diagnostics when relevant | A second editable draft |
| Modal/task | Confirmation, recovery, Review, Kanji | Background interaction or global command leakage |

Control levels:

- **Primary**: one dominant next action per bounded region.
- **Secondary**: valid alternative that advances or changes the task.
- **Quiet**: reversible utility such as Details, Clear, Close, list/grid.
- **Destructive**: labelled action with object/consequence context and confirmation or truthful Undo.
- **Disabled**: real owned control with exact unmet prerequisite; never advertises an unowned feature.
- **Status-only**: non-interactive state such as Saving, Degraded, count, or time.

Cross-cutting rules:

- Pin, selection, failure, and disabled state are not color-only.
- A hover affordance has an equivalent focus-visible path.
- If a capability has no owner in the state matrix, its control is absent.
- Empty/no-result content belongs to its owning region and never replaces an active draft.
- Japanese quick-create uses one primary entry plus menu/palette discovery, not five equal permanent buttons.

## 10. Typography, accessibility, and motion

- Use a Japanese-capable UI sans-serif stack for shell and prose.
- Reserve monospace for code, shortcuts, and technical metadata.
- Editor/body text is at least 16 CSS pixels with line height at least 1.5.
- Dense labels are at least 14 CSS pixels.
- Primary prose measure is 60–76 characters.
- Normal text contrast is at least 4.5:1; large text and meaningful graphics/component boundaries at least 3:1.
- Disabled state remains legible and is not opacity-only.
- Interactive targets use a 44×44 CSS-pixel effective area where layout permits.
- Focus indicators are at least 2 CSS pixels and at least 3:1 against adjacent colors.
- DOM/tab order follows visual and task order.
- Status live regions are polite except immediately blocking recovery/destructive failures.
- Autosave success is not announced on every keystroke.
- `prefers-reduced-motion: reduce` removes non-essential translation, scale, and smooth scrolling.
- Other transitions are at most 200 ms and cannot delay focus or command completion.

## 11. Keyboard and command contract

### 11.1 Precedence

1. Browser and operating-system reserved commands.
2. Top modal or bounded task commands.
3. IME composition.
4. Focused native input/editor behavior.
5. Available central command-registry command.
6. Remaining list/workspace navigation.

When `KeyboardEvent.isComposing` is true, composition is active, or compatibility key code is `229`, global navigation, palette selection, deletion, numeric rating, and single-key commands do not run. Application handling resumes only after `compositionend` and a subsequent key event.

### 11.2 Shortcut decisions

| Input | Target decision |
| --- | --- |
| `Ctrl/Cmd+K` | Open palette when no modal/task owns focus |
| `Ctrl/Cmd+N` | Retire; browser New Window wins |
| `N` | Scoped create outside editable/composition/modal/Review |
| `/` | Focus search outside editable/composition/modal/task |
| `j` / `k` | Move within non-empty active results |
| `g g` / `G` | First/last result; timer clears on scope/focus change |
| `i` | Focus active editor when a note exists |
| `Delete` | Delete only with explicit active context and lifecycle owner |
| `Ctrl/Cmd+Enter` | Flush dirty active draft |
| `Tab` | Editor-specific insertion only inside editor; native traversal elsewhere |
| `Ctrl/Cmd+Z` | Native editor undo first; app Undo only in declared non-editor scope |
| `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` | Same precedence for redo |
| `Ctrl/Cmd+Tab` | Retire; browser tab switching wins |
| `1`–`4` | Rate revealed Review item only |
| `Escape` | Dismiss one top layer after IME/platform handling; never cascade |

Never register browser-critical `Ctrl/Cmd+L`, `T`, `W`, `R`, `F`, `P`, `S`, `O`, `N`, or `Tab`.

The #74 registry record contains `id`, `title`, `description`, `shortcuts`, `scope`, `availability`, `reason`, and `run`. Buttons, menus, help, palette, and keyboard handlers consume the same definition. `run` rechecks availability.

## 12. Save, delete, Undo, failure, and focus

### 12.1 Save and explicit flush

The audited autosave debounce is 350 ms with at most one save in flight and one trailing revision.

Explicit flush occurs before Save command completion, active-note transition, workspace transition, close, archive, delete, and any ownership-changing editor blur. Visibility loss requests a best-effort flush but does not weaken durable transition requirements.

Canonical persistence completes before in-memory publication, history success, or success presentation. A derived index failure after canonical save reports a bounded degraded state such as `Saved locally; search index unavailable` and does not mark the draft dirty again.

A canonical failure preserves exact draft, dirty flag, active note, selection, and recoverable focus. `beforeunload` may warn; it is not a save mechanism.

### 12.2 Delete and Undo

1. Identify the active note visibly.
2. Flush it; stop on canonical failure.
3. Use the owned note or paired note/review transaction.
4. Persist deletion before removing canonical in-memory state.
5. Select deterministic next note or empty state.
6. Create Undo only after successful delete persistence.
7. Undo restores storage first, then memory, indexes, selection, and focus.
8. Failed restore leaves deletion truthful and exposes retry/recovery.

### 12.3 Focus

- Create focuses Title.
- Search keeps focus until a result is activated.
- List/grid toggle returns focus to the toggle.
- Palette, menu, Details, confirmation, Review, and Kanji record invoker and restore a deterministic logical target.
- Modal backgrounds are inert and excluded from tab order.
- Failure moves focus only when required to prevent unsafe transition; otherwise it preserves the editing point.
- Resize and zoom preserve logical focus, draft, selection, disclosures, and Review item.

## 13. Desktop resize and 200% zoom

| Evidence size | Target layout contract |
| --- | --- |
| 1024×768 | Desktop shell remains; navigation may compact; results may use one column; editor remains primary |
| 1280×720 | Usable horizontal hierarchy; limited height uses owned vertical scrollers |
| 1440×900 | Full hierarchy with readable editor and bounded Details |
| 200% zoom | Desktop semantics remain; content reflows; core controls remain reachable; vertical document scrolling is allowed |

Hard requirements:

- **No horizontal document overflow** at any supported viewport or at 200% zoom.
- Transient/content regions may own bounded internal scrolling only when semantics require it; they cannot create page-level horizontal overflow.
- Core actions, failure recovery, and focused content remain reachable.
- Long English, Japanese, mixed, and code content cannot force page overflow.
- Resize/zoom cannot reset active note, draft, query, Japanese filters, selection, Review session, or persisted data.
- Hidden/collapsed surfaces cannot retain focus or execute scoped commands.
- No mobile-style route, off-canvas navigation, bottom navigation, or back-button contract is introduced.

At 200% zoom, the effective viewport can be narrower than 1024 CSS pixels. This is zoom resilience inside the desktop contract, not mobile support.

Required evidence environments:

- current Chromium on Ubuntu for automated checks, recorded with exact versions and SHA;
- current Chrome and Edge on Windows for manual keyboard/mouse/zoom checks, recorded with exact versions;
- screen-reader combinations remain `UNKNOWN — REQUIRES VALIDATION` until #73 names and tests one.

## 14. Note appearance token contract

#67 owns an accessible render registry, not persisted note color.

Manifest version `1` has exactly ten stable IDs:

| Family | IDs |
| --- | --- |
| Light | `paper`, `sand`, `coral`, `amber`, `mint` |
| Dark | `slate`, `ocean`, `forest`, `plum`, `charcoal` |

The canonical form is `note-appearance/v1/<id>`.

Each token defines surface, border, primary text, secondary text, icon, focus, and non-color marker values. Unknown or absent IDs render `note-appearance/v1/paper` without writing the fallback to user data.

M2 adds no appearance field, picker, migration, Undo entry, or export field. Persistence requires a separate schema/API issue.

## 15. Measurable 100-point scorecard

Scoring is `0`, half credit, or full credit per named measure. Unknown or unsupported evidence scores zero. Fractions are rounded down only at the final total.

Release requires all three:

1. total at least 90/100;
2. every category at least 80% of its weight;
3. no unresolved P0 or P1 UX defect.

| Category | Weight | Measures | Current audited score |
| --- | ---: | --- | ---: |
| Information architecture | 20 | Editor priority 5; semantic shell 5; workspace separation 4; disclosure 3; list/grid contract 3 | 11 |
| Core workflow efficiency | 20 | Create/open/edit 4; search/navigation 4; flush-safe switching 4; labelled actions 4; list/grid parity 4 | 11 |
| Visual hierarchy/readability | 15 | Typography/measure 5; semantic tokens/contrast 5; appearance registry 3; state polish 2 | 7 |
| Keyboard/accessibility | 20 | Registry 5; browser precedence 4; IME 4; modal/focus 4; names/reasons/announcements 3 | 5 |
| Resize/zoom resilience | 10 | Three viewports 5; 200% zoom 3; live resize/state continuity 2 | 3 |
| Feedback/recovery | 10 | Save distinction 3; delete/Undo 3; disabled reasons 2; recovery/focus 2 | 7 |
| Consistency/polish | 5 | Shared patterns 2; no dead/duplicate controls 2; honest boundaries 1 | 1 |
| **Total** | **100** | Acceptance target ≥90 | **45** |

Required evidence per measure:

- automated DOM/state assertion for deterministic behavior;
- reproducible computed-style/contrast/overflow measurement where visual geometry is claimed;
- recorded keyboard, mouse, zoom, IME, and focus check where browser/platform behavior cannot be fully automated;
- exact base/head SHA, OS, browser, Node, Playwright, and viewport for every release-gate artifact.

Appearance screenshots alone earn zero points. A high total cannot compensate for a category below its floor.

## 16. Classified findings

| Finding | Class | Severity | Disposition |
| --- | --- | --- | --- |
| `Ctrl/Cmd+N` and `Ctrl/Cmd+Tab` capture browser commands | Defect | P1 | Retire in #74 |
| Global/Review handlers lack complete IME composition guard | Defect | P1 | #74 implementation and browser tests |
| Palette lacks declared scope, availability, and disabled reason | Defect | P1 | #74 registry; #72 presentation |
| Destructive affordance can be ambiguous | Defect | P1 | #68 labels/context; #72 feedback |
| Mobile/touch/virtual-keyboard behavior unsupported | Limitation | P2 | Explicit product boundary |
| Telemetry/dashboard/filters/backlinks compete with editor | Design debt | P2 | #66/#68/#70 disclosure |
| Global monospace and border-heavy grouping weaken readability | Design debt | P2 | #67 |
| No runtime list/grid or appearance registry | Limitation | P2 | #68/#67 |
| Keep disclosure patterns are useful | Inference | P3 | No similarity score |
| Exact browser/assistive-tech/contrast/announcement results | Unknown | P1 | #73 evidence |
| Runtime 200% zoom preserves all tasks without page overflow | Unknown | P1 | #71 implementation; #73 gate |
| Persisted appearance, Reminders, Labels, and Trash have safe owners | Unknown | P2 | Hidden/deferred until separate authorization |

No P0 was observed in the source/design audit. P1 findings block the future #73 release gate, not the documentation-only completion of #65.

## 17. Local-only behavior-intelligence boundary

No behavior-intelligence implementation is authorized in M2.

A future M3 issue may allow only:

- event type;
- timestamp;
- random session-local ID;
- workspace/surface;
- command ID;
- outcome enum;
- duration bucket;
- viewport bucket;
- input-modality enum;
- application version.

Prohibited fields include note content or IDs, search text, labels/tags, Japanese content, Kanji drawing vectors or historical V1 character/recognizer data, media, clipboard, URLs, raw keystrokes, cursor/selection text, free-text errors, stacks, database records, fingerprints, account IDs, and network transmission.

Hard bounds are 5,000 events and 30 days with FIFO deletion, visible Reset, local Export, no remote endpoint, and failure isolation from note/review/delete/Kanji workflows.

## 18. Downstream responsibility and rollback

| Issue | Exact responsibility | Must not change | Rollback |
| --- | --- | --- | --- |
| #66 | Semantic editor-first shell and owned navigation | Schema, tokens, command registry internals, list/grid implementation | Revert shell wiring/tests; preserve data |
| #67 | Scoped semantic tokens and ten-token rendering | Persisted color/schema, commands, external UI library | Revert CSS/registry/tests |
| #74 | Command registry, scope, reasons, IME/browser precedence | Schema and business semantics | Revert registry adapters/handlers |
| #68 | List/grid parity, spotlight editor, Details, actions, flush/delete/Undo | New schema, Japanese scheduler, Kanji package | Revert presentation/actions/tests |
| #69 | Saved-grid V2 domain/storage, task UI, mixed V1/V2 lifecycle, bounded integration evidence | Ordinary IA, scheduler, network, telemetry, guessed Unicode/search/review evidence, Markdown vector payload | Disable writers/presentation; retain V1 and V2 handwriting data |
| #70 | Japanese Notes/Review disclosure and task mode | Scheduler algorithm, Japanese V2, Kanji drawing internals | Revert Japanese presentation/controllers |
| #71 | Supported desktop resize/zoom behavior | Mobile navigation, state/persistence semantics | Revert layout/tests |
| #72 | Accessible state-to-presentation mapping | Persistence outcomes, schema, scheduling | Revert mapping/components/tests |
| #73 | Final scorecard and bounded fixes tied to failed measures | Broad feature expansion or unsupported claims | Revert gate evidence/fixes independently |

No rollback may delete canonical user data, silently rewrite an unknown newer schema, or down-migrate #69 data destructively.

### 18.1 Note-level action extension boundary

#68 establishes the registration boundary and #74 supplies command semantics.

A definition contains:

- stable `id`;
- `title` and `description`;
- ordered `placements`;
- optional `shortcuts`;
- `scope`;
- `availability(context) -> { available, reason }`;
- async `run(context)`.

Context is read-only and bounded to active note ID, workspace, current revision/dirty state, and declared capabilities. `run` calls the owning domain transaction; it does not mutate DOM, IndexedDB, search projections, or canonical collections directly.

#69 registers command ID `notes.kanji-ink` only after #68; issue #90 presents it as `Add drawing`. #69 remains sole owner of `KanjiInkEntry`, storage, V1-only confirmed-character search projection, mixed V1/V2 export, and lifecycle. V1 recognition metadata is historical compatibility data. V2 has no recognition path, guessed Unicode, or search/review/mastery contribution.

## 19. Design acceptance manifest

`Accepted` is a repository lifecycle state. A Figma node is marked Accepted when its exact node ID appears in this merged manifest. Canvas lifecycle labels are mirrors; they are not a second independent authority and cannot override a merged repository decision.

The original design roots below were accepted as design-to-code input after PR #78 merged. The superseded Kanji recognition root is historical only; issue #69's later accepted saved-grid nodes are listed in its place:

- Foundations `13:2`;
- Components `18:2`;
- Patterns `39:2`;
- Notes routes `50:2`;
- Japanese routes `51:351`;
- saved-grid dialog hierarchy `43:343` (`Header → Toolbar → Canvas → Footer`);
- repeated horizontal paper rules `120:313` (paper pattern only, not broad interaction authority);
- superseded recognition-route root `52:2` is retained as historical design evidence only;
- States and recovery `53:2`;
- Responsive documentation `55:2`;
- Prototype index `65:2`;
- Implementation handoff `66:2`.

Acceptance is limited to the hardened contracts recorded in this document and `docs/UX_DESIGN_HANDOFF.md`:

- semantic primitive/status/ink publication boundaries;
- bounded palette, inspector, Review, and Kanji geometry;
- no-result editor preservation;
- Review task mode and pending-rating failure intent;
- same-dialog Kanji discard;
- persist-before-success saved-grid lifecycle with exact draft retention on failure;
- compact saved-handwriting disclosure with complete Details owner;
- product-control prototype paths;
- supported desktop overflow ownership;
- honest Candidate/Accepted/Implemented/Verified separation.

Accepted does not mean Implemented or Verified. Any material Figma change to an accepted node invalidates only that node's acceptance until its issue records a new exact-node review. Downstream issues may start only after their direct repository dependencies are merged and green.

## 20. Unsupported environments and remaining unknowns

Unsupported in M2:

- viewport widths below 1024 CSS pixels at 100% zoom;
- mobile/tablet navigation and touch-only flows;
- virtual keyboards and native wrappers;
- light theme;
- browsers and assistive technologies outside the #73 evidence matrix;
- sync, accounts, collaboration, and network services.

Remaining unknowns:

- computed runtime contrast and forced-colors behavior;
- screen-reader announcements and exact tested pairing;
- live runtime IME precedence across all surfaces;
- runtime list/grid, spotlight editor, appearance tokens, state mapper, and command registry;
- runtime 200% zoom and live resize behavior;
- native Windows pen behavior and machine-specific saved-grid latency outside the checked-in regression tripwires;
- persisted note appearance and future lifecycle owners.

Unknowns cannot be claimed as passed and receive no score.

## 21. Migration, rollback, and Stage 0 exit

This PR adds one Markdown file. It has no runtime or data migration. Reverting its commit removes the baseline without touching dependencies, HTML, CSS, JavaScript, IndexedDB, search, scheduling, Kanji data, or user data.

Figma has independent version history and is not reverted by Git. Future schema work must remain additive and preserve unknown newer fields.

Stage 0 exits when:

- this document is the sole PR #78 repository change;
- repository verification is green on the final head;
- exact base/head SHAs and dependencies are recorded in the PR;
- review confirms the accepted design manifest remains honest;
- issue #65 acceptance criteria are covered;
- downstream work remains dependency-safe;
- no runtime or user-data mutation is included.

Merging PR #78 accepts the design contract and unblocks only the direct children whose other dependencies are already merged and green. It does not claim a 9+/10 runtime, begin #66 automatically, or convert design evidence into implementation evidence.

## 22. Issue #66 editor-first shell contract

Issue #66 consumes the Accepted manifest without changing the Stage 0 audit identity. Its runtime shell contract is:

- `applicationHeader` is the only application banner and contains product identity, `workspaceNavigation`, search, one concise `saveState`, subordinate `noteCount`, the valid Ordinary `newNoteButton`, and `refreshButton`;
- `workspaceNavigation` is the only workspace-navigation owner; `notesWorkspaceButton` and `japaneseWorkspaceButton` remain native buttons with explicit `aria-pressed` state;
- `noteNavigationRegion` is the bounded navigation landmark and internal scroll owner;
- `editorRegion` is the single main editor landmark and remains flexible and dominant;
- `searchInput`, `newNoteButton`, `refreshButton`, `saveButton`, and the two workspace buttons retain stable IDs for #74 adapters;
- refresh flushes the existing autosave owner and calls the existing `NoteWorkspaceController` refresh path; it does not reload the page, synthesize input, click rendered notes, discover hidden DOM state, or create runtime services;
- performance measurements remain available in runtime state for tests and explicit diagnostics, but no render/search/worker/autosave/memory telemetry appears in normal product UI;
- per-workspace query and active-note state remain owned by `JapaneseWorkspaceCoordinator`, while the active draft, dirty revision, store, search client, history, backlinks index, and persistence authorities remain unchanged;
- Japanese filters, dashboard, repair state, and five current quick-create actions retain their existing behavior and owners, but live inside the bounded navigation region so they cannot push the editor below the document fold;
- the document does not scroll horizontally at the 1024×768, 1280×720, and 1440×900 desktop reference viewports; secondary navigation and backlinks scroll internally.

### 22.1 Accepted-design reconciliation

The structural hierarchy in Figma `39:2`, `50:2`/`50:92`, `51:351`/`51:466`, and `55:2` is compatible with the repository contract: persistent workspace controls, search and creation hierarchy, bounded note navigation, and a dominant editor.

Repository ownership wins for these deferred details:

- Figma visual tokens, typography, component variants, and broad polish remain #67;
- the single `New Japanese note` chooser and Japanese Notes/Review disclosure remain #70, so #66 preserves the current five lifecycle-backed quick-create actions and does not invent a generic Japanese template;
- final list/grid parity, note-card hierarchy, editor action menu, Details, and backlinks disclosure remain #68;
- command registry semantics, availability reasons, IME precedence, and browser-conflict retirement remain #74;
- full resize/zoom hardening outside the two #66 reference viewports remains #71;
- save-failure and recovery presentation remain #72.

These are deferred ownership boundaries, not failed #66 acceptance claims.

### 22.2 Compatibility, migration, and rollback

Issue #66 supports the repository's automated Chromium desktop baseline at 1024×768, 1280×720, and 1440×900. A 200% zoom check is a smoke test only until #71 and #73 complete. Viewports below 1024 CSS pixels at 100% zoom, mobile/tablet/touch navigation, light theme, native wrappers, and untested browser/assistive-technology combinations remain unsupported or unknown.

The shell adds no dependency, schema, migration, persistence, search-ranking, scheduling, Kanji, or user-data change. Rollback is one pull-request revert of the Issue #66 HTML/CSS/composition wiring, focused tests, and this section. Canonical notes, `studyReviews`, current IndexedDB schema, search/history/backlinks ownership, export, migration, and command behavior remain intact.
