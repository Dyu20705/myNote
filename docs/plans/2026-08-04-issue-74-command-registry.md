# Issue #74 command registry implementation plan

**Goal:** Replace distributed keyboard and palette ownership with one bounded, DOM-independent command registry and dispatcher while preserving every existing action, persistence, workspace, review, and autosave boundary.

**Base:** `main@1302dfd84d735df52a2eea8c4d0bafa03045e773`

**Branch:** `ux/74-command-registry`

**Inventory:** `docs/COMMAND_OWNERSHIP.md`

**Technology:** Vanilla ES modules, native DOM events, Node.js 22.20.0, npm 11.7.0, Playwright 1.62.0.

## Global constraints

- Preserve `UI → Actions → State → Core → Persistence`.
- Keep one browser composition root in `app.js`.
- Add no runtime dependency, framework, component library, plugin API, macro system, shortcut-remapping UI, schema, migration, search-ranking change, scheduler change, or background worker.
- Registry code must not import storage, IndexedDB, application state singletons, Japanese actions, or rendered DOM nodes.
- Command execution must continue through existing action functions, controllers, command stack, autosave, Japanese coordinator, and lifecycle boundaries.
- The command registry is bounded and internal. It must reject malformed definitions, duplicate IDs, unsupported scopes, unsupported shortcut shapes, and excessive registration deterministically.
- Text editing, form controls, contenteditable surfaces, IME composition, native dialogs, and palette context take precedence over broad application commands.
- Protected browser/platform shortcuts are not intercepted without an accepted application contract.
- `Ctrl/Cmd+K` remains the command-palette shortcut and `/` remains the direct Search shortcut outside editing.
- Review numeric shortcuts remain review-modal commands.
- Content-field `Tab` insertion remains a local editor behavior, not a registry command.
- #68 editor/list redesign, #70 Japanese disclosure, #71 responsive navigation, #72 recovery presentation, and #73 release certification remain out of scope.

## Proposed internal interfaces

The implementation may refine naming during review, but tests lock the following semantic boundary.

```js
const registry = createCommandRegistry({
  maxCommands: 64,
  sequenceTimeoutMs: 450,
  scheduleTimeout,
  cancelTimeout,
});

const unregister = registry.register({
  id: "notes.create",
  title: "New note",
  description: "Create an ordinary note",
  shortcuts: [{ key: "n", primaryModifier: true }],
  scope: "shell",
  isAvailable(context) {
    return context.workspace === "notes";
  },
  unavailableReason(context) {
    return context.workspace === "notes"
      ? ""
      : "Switch to Notes workspace to create an ordinary note";
  },
  run(context) {
    return context.actions.createNote();
  },
});
```

Required registry operations:

```js
registry.register(command);
registry.unregister(id);
registry.snapshot(context);
registry.get(id, context);
registry.execute(id, context);
registry.dispatch(eventDescriptor, context);
registry.resetSequences();
registry.destroy();
```

`dispatch()` returns a bounded result rather than exposing action internals:

```js
{
  handled: true,
  executed: false,
  commandId: "notes.create",
  reason: "Switch to Notes workspace to create an ordinary note",
}
```

The final API must provide equivalent behavior even if exact method names change.

## Target command metadata

Every registered command owns:

- stable unique `id`;
- user-facing `title`;
- concise `description`;
- one or more normalized shortcut descriptors, or an empty list;
- semantic `scope`;
- live `isAvailable(context)` evaluation;
- live `unavailableReason(context)` evaluation;
- one `run(context)` execution owner.

Allowed initial scopes:

- `global`;
- `shell`;
- `editor`;
- `palette`;
- `review-modal`.

The registry may define internal sequence metadata, but sequence state must remain bounded dispatcher state rather than application state.

---

## Task 1: Record the pre-implementation ownership map

**Files:**

- Create `docs/COMMAND_OWNERSHIP.md`.

- [x] Inventory every current `keydown` handler.
- [x] Inventory all base and Japanese provider palette commands.
- [x] Record existing action/controller/persistence owners.
- [x] Record input, IME, modal, sequence, duplicate-ID, unavailable-reason, and parity gaps.
- [x] Define target ownership for registry, palette adapter, composition root, Japanese app, and existing actions.

## Task 2: Establish browser RED evidence against current distributed dispatch

**Files:**

- Create `tests/e2e/command-registry-red.spec.mjs`.

The first RED commit must not add or modify production JavaScript, HTML, or CSS.

### 2.1 Input precedence

- [ ] Focus the title field.
- [ ] Dispatch `Ctrl+N` through a real bubbling keyboard event.
- [ ] Assert no note is created and the current draft/focus remain unchanged.

Current behavior is expected to fail because `Ctrl/Cmd+N` executes before target filtering.

### 2.2 IME precedence

- [ ] Create two notes and keep the newest selected.
- [ ] Start composition on a shell control.
- [ ] Dispatch composing `j`.
- [ ] End composition.
- [ ] Assert the active note does not change.

Current behavior is expected to fail because no composition boundary exists.

### 2.3 Modal isolation

- [ ] Create at least two Japanese notes.
- [ ] Open and reveal a review session.
- [ ] Focus a rating button and press `j`.
- [ ] Assert the background active note/editor does not change.
- [ ] Preserve numeric rating behavior as a positive control.

Current behavior is expected to fail because unrelated dialog keys bubble to global navigation.

### 2.4 Sequence reset

- [ ] With two notes, focus shell context.
- [ ] Press `g`, then `j`, then `g` within 450 ms.
- [ ] Assert `j` moves once and the second `g` merely starts a new sequence.

Current behavior is expected to fail because an intervening key does not reset `lastGAt`.

### 2.5 Unavailable reasons and palette/direct parity

- [ ] Switch to Japanese workspace.
- [ ] Open the palette and assert `New note` remains discoverable but is unavailable with the Notes-workspace reason.
- [ ] Dispatch `Ctrl+N` and assert it uses the same availability decision and does not create a note.
- [ ] Force Japanese study data unavailable and assert quick-create commands remain visible with a concise reason rather than disappearing.

Current behavior is expected to fail because direct `Ctrl+N` bypasses workspace availability, base commands are always enabled, and Japanese unavailable commands are removed from the provider output.

### 2.6 Verify browser RED

Open a draft pull request from the browser-test-only head and run the complete workflow. Accept the checkpoint only when content, lint, unit, and integration gates pass and Playwright fails on the intended command-scope assertions rather than syntax, fixture, or infrastructure failures.

Record exact run ID, head SHA, passing count, failing count, and each behavioral failure in the PR and issue.

## Task 3: Establish registry unit RED evidence

**Files:**

- Create `tests/unit/command-registry.test.mjs`.
- Modify `package.json` to register the suite explicitly.

The second RED commit still must not add production registry code.

### 3.1 Validation and bounds

- [ ] Reject non-object commands.
- [ ] Reject empty or malformed IDs.
- [ ] Reject missing title, description, scope, availability functions, reason function, or run function.
- [ ] Reject unsupported scopes and malformed shortcuts.
- [ ] Reject duplicate IDs without replacing the existing command.
- [ ] Enforce a caller-configurable maximum command count.
- [ ] Return content-free stable error codes.

### 3.2 Availability freshness and reasons

- [ ] Evaluate availability against the current context on every snapshot and execution.
- [ ] Return the current unavailable reason without invoking `run`.
- [ ] Keep unavailable commands present in snapshots.
- [ ] Reject unavailable definitions that return no actionable reason.

### 3.3 Shared execution parity

- [ ] Execute one command by ID and through shortcut dispatch.
- [ ] Prove both paths invoke the same registered `run` closure.
- [ ] Prove palette adapters need only command IDs/snapshots and do not retain a parallel execution function.

### 3.4 Scope and precedence

- [ ] Suppress broad commands in text inputs, textareas, selects, and contenteditable contexts.
- [ ] Suppress application commands while composing.
- [ ] Permit explicitly editor-scoped save while editing.
- [ ] Permit only review-modal commands while the review dialog is active.
- [ ] Permit only palette commands while the palette is active.
- [ ] Preserve native behavior when no accepted command matches.

### 3.5 Sequence lifecycle

- [ ] Arm `gg` with one bounded timer.
- [ ] Execute only on a matching second key in the same valid scope.
- [ ] Reset on a different key, timeout, composition start, focus/scope change, workspace change, modal/palette transition, explicit reset, and destroy.
- [ ] Ensure teardown cancels the timer and cannot execute stale sequence work.

### 3.6 Registration cleanup

- [ ] Unregister removes the exact command.
- [ ] Repeated unregister is safe and does not remove a later command.
- [ ] Destroy clears commands, sequence state, and retained timer work.
- [ ] Provider-like registration cannot leak stale commands.

### 3.7 Verify unit RED

Run the focused suite and the complete unit command. The accepted RED is failure caused by the absent `ui/commandRegistry.js` contract, not an invalid test import path or package-script defect. Record the exact result separately from the browser RED run.

## Task 4: Implement the pure bounded command registry

**Files:**

- Create `ui/commandRegistry.js`.
- Modify `tests/unit/command-registry.test.mjs` only to correct invalid assumptions, never to weaken accepted behavior.

- [ ] Add content-free stable error construction.
- [ ] Validate command definitions and shortcut descriptors defensively.
- [ ] Enforce unique IDs and the maximum count.
- [ ] Store normalized immutable metadata without cloning action closures into a second owner.
- [ ] Evaluate availability and reasons fresh for each context.
- [ ] Implement execution by ID.
- [ ] Implement shortcut matching using explicit primary-modifier semantics.
- [ ] Implement target, editor, composition, palette, and modal precedence.
- [ ] Implement bounded sequence state and deterministic reset/teardown.
- [ ] Make snapshots fresh and mutation-safe.

Run:

```sh
node --test tests/unit/command-registry.test.mjs
```

Expected: focused unit GREEN.

## Task 5: Convert the palette into a registry rendering adapter

**Files:**

- Modify `ui/palette.js`.
- Modify `index.html` only for bounded command metadata/help markup.
- Modify `styles.css` only for existing-system command metadata, unavailable reason, and help presentation.
- Add focused palette unit/browser coverage as needed.

- [ ] Remove process-global command providers and ID override merging.
- [ ] Accept a registry snapshot function and execute-by-ID callback.
- [ ] Render title, description, shortcut label, and unavailable reason.
- [ ] Keep unavailable commands visible and focusable with `aria-disabled="true"`.
- [ ] Prevent unavailable execution from click or Enter.
- [ ] Add deterministic keyboard selection if required by the accepted palette interaction.
- [ ] Retain the opener and restore focus after Escape, command execution, and outside click when still valid.
- [ ] Preserve native dialog semantics and avoid a second modal dispatcher.

## Task 6: Register and migrate ordinary application commands

**Files:**

- Modify `app.js`.
- Modify `core/state.js` only to remove transient `lastGAt` if no other owner uses it.
- Modify focused composition/ownership tests.

- [ ] Create one registry and dispatcher in `app.js`.
- [ ] Register ordinary create, daily, Search, save, code insertion, pin, archive, delete, recent, undo, redo, export, recovery reset, palette open/close, list navigation, boundary navigation, and editor-focus commands.
- [ ] Preserve all existing action closures and lifecycle routing.
- [ ] Replace direct global command branches with one registry dispatch call.
- [ ] Track composition through the smallest bounded composition boundary required by browser behavior.
- [ ] Remove `lastGAt` from application state after sequence ownership moves.
- [ ] Keep content-field `Tab`, blur save, input dirty state, visibility save, and beforeunload outside the registry.
- [ ] Confirm `Ctrl/Cmd+N` is unavailable outside Notes workspace and while unsafe editing contexts own the key.
- [ ] Confirm native undo/redo wins in text editing while application undo/redo remains available in accepted shell scope.

## Task 7: Register Japanese and review-modal commands

**Files:**

- Modify `japaneseApp.js`.
- Remove `registerPaletteCommands` usage.
- Modify focused Japanese browser tests.

- [ ] Inject the one registry boundary through the existing runtime object.
- [ ] Register five Japanese quick-create commands with live availability and unavailable reasons.
- [ ] Register accepted workspace-switch commands.
- [ ] Register review reveal, Again, Hard, Good, Easy, and close commands in review-modal scope.
- [ ] Preserve numeric rating shortcuts and native Escape dialog close behavior.
- [ ] Prevent every unrelated background command while the review dialog is open.
- [ ] Unregister all Japanese commands during `destroy()` without retaining listeners or stale definitions.
- [ ] Preserve degraded-mode read-only behavior and enrolled-delete routing.

## Task 8: Add compact discoverability and reconcile documentation

**Files:**

- Modify `README.md`.
- Modify `docs/UX_QUALITY_BASELINE.md` or create a focused command interaction document.
- Modify `docs/COMMAND_OWNERSHIP.md` from inventory status to implemented reconciliation.
- Modify `index.html` and existing CSS only as needed for one compact help surface.

- [ ] Expose a compact keyboard-help path through the registry inventory.
- [ ] Generate or directly reconcile documented shortcuts from the same bounded command definitions without adding a build-time generator dependency.
- [ ] Use platform-appropriate Ctrl/Cmd labels.
- [ ] Document input, IME, sequence, palette, modal, unavailable, and focus-return behavior.
- [ ] Document limits, cleanup, failure behavior, unsupported remapping, security boundary, and rollback.

## Task 9: Full verification and review

### Focused verification

```sh
node --test tests/unit/command-registry.test.mjs
npx playwright test tests/e2e/command-registry-red.spec.mjs
```

Rename the browser file away from `-red` when implementation is GREEN and documentation no longer describes it as a temporary test checkpoint.

### Complete repository gate

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

### Review checklist

Reject the implementation if any of the following remains:

- more than one command registry or global dispatcher;
- silent duplicate-ID override;
- unbounded registration/provider retention;
- stale availability or stale unavailable reason;
- direct persistence access from the registry;
- command definitions discovering DOM nodes to determine behavior;
- broad modified shortcuts bypassing input/IME/modal precedence;
- background navigation while a dialog is active;
- sequence state in application state or an uncleared timer;
- separate palette execution functions that bypass registry execution;
- Japanese commands removed instead of disabled with reasons;
- focus not restored after palette/dialog close;
- #68 editor/list redesign or #70 Japanese information architecture absorbed into this package;
- schema, migration, dependency, search, scheduler, or user-data change.

## Rollback

Revert the single issue #74 pull request. The prior direct keyboard and palette handlers return as one code rollback. No database downgrade, note rewrite, review deletion, search-index migration, export conversion, or user-data action is required.