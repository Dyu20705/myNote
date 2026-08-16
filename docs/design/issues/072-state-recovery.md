# Issue #72 — State and Recovery UX

## Status

Owner-approved design for issue #72.

- Target branch: `dev`
- Design baseline: `5a98ba527b9b6d040f4f5a96123fb7d7c8367834`
- Depends on: #65, #66, #67, #74, #68, #69, #70, #90, #71
- Blocks: #73
- Product boundary: M2 desktop browser only
- Implementation model: one bounded issue branch, one pull request to `dev`, review before integration

This document is the authoritative implementation contract for #72. Historical issue prose and comments remain input, but this document owns exact behavior, scope, architecture, state mapping, recovery semantics, verification, and stop conditions.

## 1. Goal

Unify empty, loading, saving, failure, degraded, and recovery presentation across ordinary Notes, Japanese Notes/Review, and Kanji saved-grid drawing without creating a second canonical state owner.

The healthy product stays calm. Successful work is usually silent and evidenced by the resulting state itself. Failures are explicit, local to the affected task, persistent long enough to rediscover, and accurate about whether canonical data is safe.

The design must preserve the repository dependency direction:

```text
UI → Actions → State → Core → Persistence
```

Presentation must never infer durable success from a timer, DOM mutation, animation, or optimistic UI transition.

## 2. Fixed product decisions

### 2.1 Silent-success

Healthy successful operations do not create generic success notifications.

- Note autosave success: compact `Saved` state only.
- Explicit note save success: same compact state; no toast.
- Drawing save success: the persisted drawing appearing directly in the active note overlay above title/body is the primary confirmation; no success toast.
- Japanese rating success: naturally advance to the next item; no success toast.
- Filter application, note open, refresh completion, and other healthy transitions do not create success notifications.

A bounded notification is reserved for a user action that still has a recovery opportunity, such as Undo after a durable delete.

### 2.2 First run is a real empty state

An empty database must remain empty until the user explicitly creates a note.

Current behavior that creates an automatic `Untitled` note during bootstrap is removed.

First run becomes:

```text
empty canonical database
→ empty board
→ explicit Create action
→ canonical write only after user intent
```

### 2.3 No general notification system

#72 must not create a global toast queue, notification manager, feedback bus, timeout-based success mechanism, or automatic retry loop.

Each presentation remains scoped to an existing task surface.

## 3. Architecture

### 3.1 Existing state owners remain authoritative

| State family | Existing owner |
|---|---|
| note dirty/save/canonical failure | note lifecycle + autosave + shared store |
| derived search degradation | note lifecycle/search boundary |
| note command availability | command registry |
| note delete/undo | command/history lifecycle |
| Kanji draft/saving/failure/retry | Kanji controller/application |
| persisted drawing projection | Kanji persistence + drawing projection/view |
| Japanese workspace availability | Japanese coordinator/actions |
| Japanese review transition | scheduler preparation + review persistence/action boundary |
| reset/storage recovery | application bootstrap/storage boundary |

No #72 module may become an additional persistence, search, scheduler, drawing, command, history, or canonical application-state owner.

### 3.2 Pure presentation mapper

Create:

```text
ui/statePresentation.js
```

This module is pure and stateless. It converts already-authoritative state/results into bounded presentation descriptors.

A descriptor may contain only presentation metadata such as:

```js
{
  kind: "failure",
  scope: "note",
  tone: "danger",
  message: "Save failed. Your draft is preserved.",
  actionId: "retry-save",
  announce: "assertive",
  persistent: true
}
```

The exact field names may be adjusted during implementation if tests prove a simpler equivalent, but the semantic boundary is fixed:

- no persistence callback;
- no timer;
- no retry loop;
- no event bus;
- no store ownership;
- no raw error payload;
- no note/drawing/review content;
- no command duplication.

Preferred mapper responsibilities:

```text
presentNoteSaveState(...)
presentBoardEmptyState(...)
presentDerivedDegradation(...)
presentDrawingState(...)
presentJapaneseAvailability(...)
presentJapaneseReviewState(...)
presentRecoveryState(...)
```

## 4. Feedback hierarchy

The application uses one hierarchy across subsystems:

```text
HEALTHY
→ quiet or iconic state

BUSY
→ compact local status only

SUCCESS
→ resulting state is confirmation

DEGRADED
→ persistent scoped warning with canonical-data truth

FAILURE
→ persistent scoped error + supported next action

RECOVERY AVAILABLE
→ bounded non-blocking notice + explicit action

DESTRUCTIVE CONFIRMATION
→ exclusive confirmation only after explicit user initiation
```

Error presentation appears at the smallest surface where the user can act safely.

Examples:

- note save failure → active note overlay;
- drawing save failure → drawing dialog;
- drawing projection problem → drawing region;
- Japanese rating failure → review surface;
- filter state problem → filter region;
- application bootstrap/storage failure → shell recovery region.

## 5. Ordinary Notes state contract

| State | Presentation | Action | Canonical truth |
|---|---|---|---|
| bootstrap/loading | board/application region busy state | none | data not yet classified |
| first run / zero notes | empty board + primary New note action | create note | database contains no notes |
| query has no matches | `No notes match this search` | Clear search | canonical notes still exist |
| dirty draft | compact `Unsaved` | none | visible draft newer than persisted note |
| autosave pending/saving | compact local saving state | none | durability not yet confirmed |
| save success | compact `Saved`, no toast | none | canonical persistence committed |
| save failure | persistent inline overlay error | Retry save | visible draft preserved and remains dirty |
| derived search failure after save | warning such as `Saved · Search unavailable` | only a supported existing recovery action | canonical note is already durable |
| create failure | board/local create failure | Retry create | no undurable note inserted |
| delete success | bounded Undo notice | Undo | delete committed canonically |
| delete failure | persistent task-local error; note stays visible | Retry delete | canonical note remains present |
| reset cancelled | silent | none | data unchanged |
| reset failed | persistent application recovery error | explicit supported recovery | reset did not complete |

### 5.1 Save semantics

Required lifecycle:

```text
editor input
→ dirty
→ autosave/explicit flush
→ canonical persistence

failure
→ no canonical in-memory success commit
→ visible draft remains
→ dirty remains true
→ failure presentation

success
→ canonical commit
→ memory/history success
→ compact Saved presentation
```

A newer editor revision must never be marked clean by an older completed save.

### 5.2 Derived failure semantics

A failure after canonical persistence in search/backlink projection is degradation, not save failure.

Required meaning:

```text
Saved · Search unavailable
```

Forbidden meaning:

```text
Save failed
```

If no safe explicit search-rebuild action already exists, #72 does not invent one.

## 6. First-run and empty-board contract

Bootstrap with zero stored notes must not create a placeholder note.

Required ordinary Notes empty presentation:

```text
No notes yet
Create your first note.
[New note]
```

The CTA reuses the existing `notes.create` command/action boundary. It does not duplicate note creation logic.

Required Japanese empty presentation:

```text
No Japanese notes yet
[New Japanese note]
```

The CTA reuses the existing Japanese create boundary.

A no-match state must be distinguishable from first-run/zero-data:

```text
canonical notes = 0
→ empty data state

canonical notes > 0 && visible filtered IDs = 0
→ no-match state
```

Search/filter context is preserved until the user explicitly clears it.

## 7. Drawing state contract

The Kanji controller/application continues to own draft, saving, retry, persistence, and exact `KanjiInkEntry` lifecycle truth.

#72 only normalizes presentation.

| State | Presentation | Action |
|---|---|---|
| empty clean draft | no status noise | draw |
| non-empty editable draft | normal canvas/tools | Save |
| saving | compact `Saving drawing…`; existing safe controls disabled | none |
| save success | direct saved projection in active note overlay; no success toast | none |
| save failure | `Save failed. Your drawing is preserved.` | Retry save |
| delete success | projection removed only after durable delete; bounded Undo | Undo delete |
| delete failure | saved projection remains visible | Retry delete |
| invalid/degraded stored entry | isolate the entry; note title/body remain usable | supported recovery only |
| zero drawings | no permanent drawing region | none |
| multiple drawings | existing bounded projection/window | existing Edit/Delete/Show older actions |

### 7.1 Drawing success

Required sequence:

```text
save intent
→ canonical KanjiInk persistence
→ success
→ synchronize drawing projection
→ drawing visible directly above title/body
```

No separate success toast or Details navigation is required.

### 7.2 Drawing failure

Persistence failure must preserve the existing controller guarantees:

- exact recoverable draft;
- selected tool;
- Undo/Redo state;
- retry intent;
- prior canonical entry when updating;
- note title/body unchanged.

## 8. Japanese state contract

### 8.1 Japanese Notes and filters

| State | Presentation | Action |
|---|---|---|
| loading | regional busy state | none |
| zero Japanese notes | empty Japanese board | New Japanese note |
| Filter A/text no result | `No Japanese notes match these filters` | Clear relevant filter/search |
| invalid filter combination | scoped filter status | Clear affected filters |
| degraded study data | persistent Japanese-only warning | supported repair/recovery |
| ordinary Notes while Japanese is degraded | normal usable Notes UI | normal actions |

No-result presentation preserves text query and Filter A chips until explicit clear.

### 8.2 Review

| State | Required behavior |
|---|---|
| zero due | quiet healthy `No reviews due` state |
| review ready | existing Start review action |
| hidden content | existing reveal-first behavior |
| rating pending | current item remains visible; rating controls bounded while canonical write is pending |
| rating success | advance naturally; no success toast |
| rating failure | do not advance; same item remains current |
| review complete | existing completion state |
| invalid persisted review | scoped Japanese degraded state; ordinary Notes unaffected |

Recommended rating failure copy:

```text
Rating wasn't saved. This review item is unchanged. Try again.
```

Required transition:

```text
rate intent
→ prepare deterministic scheduler transition
→ canonical review persistence
  ├─ success → advance
  └─ failure → same item + persistent error + retry
```

Optimistic advance before canonical review persistence is forbidden.

## 9. Application storage recovery

Replace delayed destructive bootstrap confirmation with a persistent non-destructive recovery surface.

Add a bounded shell-level region, for example:

```html
<section id="applicationRecovery" role="alert" hidden></section>
```

Exact markup may vary, but ownership is fixed: this region is only for application-wide initialization/storage failure.

Required healthy recovery copy semantics:

```text
Local storage couldn't be opened.
Your existing local data has not been reset.

[Retry] [Reset local data…]
```

`Reset local data…` opens explicit destructive confirmation:

```text
Reset local data?
This permanently removes local myNote data on this device.

[Cancel] [Reset]
```

Cancellation:

- performs zero storage mutation;
- closes only the confirmation;
- leaves the original recovery surface available;
- returns focus deterministically to the Reset trigger.

There is no timed confirm, automatic reset, automatic retry loop, or destructive action triggered by bootstrap failure alone.

## 10. Accessibility contract

### 10.1 Visual state and live announcement are separate concerns

Healthy save-cycle text may remain visible without being announced on every mutation.

Do not repeatedly live-announce:

- `Unsaved` on each keystroke;
- `Saving…` for every autosave cycle;
- `Saved` after every autosave;
- drawing stroke counts;
- filter counts on harmless rerenders.

Live announcements are reserved for meaningful state changes that require attention:

- canonical save failure;
- meaningful degraded capability;
- recovery becoming available;
- Japanese rating persistence failure;
- application storage failure.

Persistent errors remain discoverable in the DOM after the live announcement.

### 10.2 Focus

- note save failure never steals title/body focus;
- drawing save failure remains inside the drawing workflow;
- Japanese rating failure remains on the relevant review/rating surface;
- delete recovery has deterministic Undo focus behavior;
- destructive reset cancellation returns focus to its trigger;
- overlay close behavior continues to return focus to the originating card or create control;
- color is never the sole state indicator.

## 11. Copy and privacy contract

Action-required copy answers, concisely:

1. what happened;
2. whether canonical data is safe/preserved/unconfirmed;
3. what supported action is available.

Examples:

```text
Save failed. Your draft is preserved. Try again.

Drawing couldn't be deleted. The saved drawing is unchanged. Try again.

Saved. Search is temporarily unavailable.
```

Do not expose in user-facing errors, diagnostics, test logs, or retained presentation state:

- raw stack traces;
- database payloads;
- drawing vector points;
- study-review payloads;
- raw internal error objects;
- note body content;
- search query contents in diagnostics;
- internal store names unless already part of an explicit developer-only contract.

## 12. Runtime file boundary

### 12.1 Expected/allowed files

- Create `ui/statePresentation.js`.
- Modify `app.js` for bootstrap/first-run state wiring, existing save/degradation presentation inputs, and supported application recovery intent.
- Modify `index.html` for minimal semantic empty/recovery regions where required.
- Modify `ui/list.js` for board empty/no-match presentation without application-state ownership.
- Modify `ui/editorChrome.js` for deletion/recovery presentation/focus only.
- Modify `ui/kanjiInkView.js` for normalized drawing presentation only.
- Modify `japaneseApp.js` for normalized Japanese state presentation only.
- Modify `styles.css`, `editor.css`, and `japanese.css` for shared/scoped state visuals.
- Add focused unit/integration/E2E tests.
- Update user-flow/recovery documentation only where behavior changes.

### 12.2 Forbidden files by default

The following are out of scope unless a genuine accepted RED proves an existing contract defect that cannot be satisfied at the presentation/application-adapter boundary:

```text
core/storage.js
core/noteLifecycle.js
core/autosave.js
core/searchClient.js
core/search.worker.js
core/studyScheduler.js
core/studyReview.js
core/kanjiInkEntry.js
core/kanjiInkController.js
core/kanjiInkApplication.js
core/commandStack.js
core/history.js
```

A required modification to any forbidden core owner is a stop condition requiring architecture review before implementation continues.

## 13. Failure injection strategy

Production debug/failure flags are forbidden.

Do not add mechanisms such as:

```text
?failSave=true
window.__forceStorageError
persistent localStorage debug flags
```

Preferred verification layers:

```text
unit
→ pure mapper inputs

integration
→ injected persistence/search/action dependencies

browser
→ existing application/database/test boundaries
```

Tests must not leave a permanent production testing backdoor.

## 14. Verification design

### 14.1 Unit

Create:

```text
tests/unit/state-presentation.test.mjs
```

Cover deterministic mappings for:

- empty canonical Notes;
- no-match state;
- dirty;
- saving;
- silent success;
- canonical failure;
- canonical success + derived degradation;
- drawing saving/failure/recovery;
- Japanese zero due;
- Japanese rating failure;
- recovery pending;
- destructive confirmation requirement;
- content-free descriptors.

### 14.2 Integration

Extend existing lifecycle owners where possible. Required evidence:

- note persistence failure produces no memory/history success and preserves dirty draft;
- search failure after note persistence leaves canonical note durable and yields degraded state;
- review rating persistence failure does not advance;
- drawing save failure keeps prior canonical value and recoverable draft;
- drawing delete failure preserves projection/canonical state;
- reset cancellation performs no storage mutation.

### 14.3 Browser

Create one focused owner:

```text
tests/e2e/state-recovery.spec.mjs
```

Required browser flows:

1. fresh database → true empty board → explicit create CTA;
2. notes exist + query no match → no-result, not first-run → clear restores board;
3. note save failure → overlay remains open → exact draft preserved → persistent error → retry success → compact silent `Saved`;
4. derived search degradation clearly states canonical note is saved;
5. drawing save failure → dialog/draft retained → retry success → direct saved projection → no success toast;
6. delete success exposes Undo only after durable success;
7. Japanese no-result preserves query/filter context;
8. Japanese rating failure keeps same item → retry → then advance;
9. application storage failure exposes persistent non-destructive recovery region and no timed destructive modal;
10. reset cancellation preserves data and deterministic focus.

Existing focused suites for editor overlay, drawing, Japanese filters/degraded mode, command registry, and desktop resilience remain regression dependencies rather than being duplicated wholesale.

## 15. Resource/performance contract

Repeated failures must not accumulate unbounded presentation resources.

At most one current presentation is retained per scope:

```text
note overlay → one save/recovery state
drawing dialog/region → one drawing state
Japanese review → one review state
shell → one application recovery state
```

Do not accumulate:

- DOM banners;
- retained notification objects;
- timers;
- event listeners;
- observers;
- retry promises;
- stale raw error objects.

Presentation retention remains O(1) per scoped region.

## 16. Desktop support boundary

Supported automated/reference desktop sizes:

- `1024×768`;
- `1280×720`;
- `1440×900`.

The existing #71 resize/containment contract remains in force.

Native 200% Chrome/Edge evidence may only be recorded as PASS when executed in a real supported desktop browser. Viewport emulation is not native zoom proof. Unsupported/native gaps remain `UNKNOWN — REQUIRES VALIDATION`.

No mobile/tablet navigation, touch-first behavior, virtual-keyboard certification, PWA/native shell, or responsive mobile product contract is added by #72.

## 17. Migration and rollback

#72 requires no database migration.

- IndexedDB remains version 3.
- No note rewrite.
- No `studyReviews` rewrite.
- No `kanjiInkEntries` rewrite.
- No parser/export-format migration.

Rollback is code-only and must retain the current v3 data model and all canonical records.

## 18. TDD implementation order

Implementation should proceed in this order:

```text
1. state-presentation unit RED
2. first-run/no-result browser RED
3. note failure/recovery RED
4. derived degradation RED
5. drawing failure/recovery RED
6. Japanese rating/degraded RED
7. bootstrap/reset recovery RED
8. minimum pure mapper implementation
9. wire existing presentation surfaces
10. remove automatic bootstrap placeholder note
11. focused GREEN suites
12. affected regression suites
13. complete local gate
14. one planned remote push
15. one automatic CI gate
16. stop for review
```

If an accepted regression is already GREEN on current `dev`, record the evidence and do not manufacture a runtime change.

## 19. CI discipline

Remote CI is the final verification gate, not the debugging loop.

For the initial implementation iteration:

- debug and test locally first;
- batch implementation before remote push;
- one planned final implementation push after the complete local gate;
- no empty commits;
- no whitespace-only CI trigger commits;
- no manual workflow dispatch;
- no manual rerun of unchanged deterministic failures;
- if remote CI reports a deterministic failure, stop and report exact evidence;
- any later fix/push iteration requires explicit reviewer authorization.

## 20. Complete verification gate

Before the implementation pull request is considered review-ready:

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

If OS dependency provisioning is impossible only because of a documented read-only local environment, record it as environment-blocked and continue independent repository gates only after reviewer authorization. The writable remote CI runner remains authoritative for dependency provisioning.

## 21. Acceptance criteria

#72 is accepted only when all applicable criteria are evidenced:

- first run performs no automatic note write and presents explicit create actions;
- zero-data and no-match states are distinct;
- healthy note save is silent except compact state;
- note persistence failure preserves exact visible draft and never reports success;
- derived search failure clearly states canonical data is saved;
- drawing save success is confirmed by direct projection, not a toast;
- drawing save failure preserves draft/retry and prior canonical state;
- drawing delete failure keeps the saved projection consistent with durable state;
- Japanese no-result preserves text/filter context;
- Japanese rating failure does not advance the review item;
- Japanese degradation never disables ordinary Notes without a canonical reason;
- durable delete success exposes bounded Undo; failed delete does not expose false success;
- application storage failure uses persistent non-destructive recovery before destructive reset confirmation;
- reset cancellation performs no data mutation and restores focus deterministically;
- visible controls and command palette continue to use the existing command availability/disabled-reason owner;
- live announcements are bounded and do not spam healthy autosave cycles;
- no raw sensitive payload or internal error is exposed;
- repeated failures retain O(1) presentation state per region;
- no schema/search/scheduler/parser/drawing/persistence ownership is duplicated;
- no mobile/touch/native product scope is introduced;
- focused and full repository verification is green on the review head, subject only to explicitly documented environment-only provisioning limits that remote CI passes.

## 22. Stop conditions

Implementation stops and reports for architecture review if satisfying an accepted test appears to require any of the following:

- new IndexedDB schema/store/version;
- changes to note/study/drawing persistence transaction semantics;
- automatic retry/polling/background queue;
- global notification/event bus;
- second command availability owner;
- second drawing canonical owner;
- scheduler semantic change;
- search ranking/index architecture change;
- parser ownership change;
- note/drawing/review payload logging;
- mobile navigation or touch-first product behavior;
- runtime change outside the allowed boundary without a demonstrated accepted RED.

## 23. Definition of Done

Issue #72 moves from implementation to review only after the implementation branch is based on the accepted design baseline or its reconciled successor, the complete current-head verification gate is green, no unresolved P0/P1/P2 state-safety/recovery/accessibility/privacy finding remains, and the pull request contains only bounded #72 work.

#72 is completed only after owner-authorized integration into `dev`. Only then may #73 become dependency-eligible for its final M2 release-gate design/review cycle.
