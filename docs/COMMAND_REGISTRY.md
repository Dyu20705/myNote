# myNote command registry runtime contract

Issue: [#74](https://github.com/Dyu20705/myNote/issues/74)

Implementation branch: `ux/74-command-registry`

Base revision: `1302dfd84d735df52a2eea8c4d0bafa03045e773`

## 1. Runtime ownership

`ui/commandRegistry.js` is the only owner of application command metadata, normalized shortcuts, semantic scope, live availability, unavailable reasons, execution by ID, direct keyboard dispatch, bounded sequence state, registration limits, and cleanup.

The registry is DOM-independent. It imports no application state, storage, IndexedDB, Japanese action, or rendered element. `app.js` injects current workspace, focused target classification, platform, composition state, palette state, modal state, and existing action closures.

`ui/palette.js` consumes read-only registry snapshots, renders commands and reasons, invokes commands by ID, and restores focus. It does not maintain a parallel base command list or shortcut dispatcher.

## 2. Bounded command shape

Every registration has this internal shape:

```js
{
  id,
  title,
  description,
  shortcuts,
  scope,
  isAvailable(context),
  unavailableReason(context),
  run(context)
}
```

Constraints:

- IDs use dotted lowercase application namespaces.
- Duplicate IDs reject with `COMMAND_DUPLICATE`.
- Malformed commands reject with content-free error codes.
- Unsupported scopes reject with `COMMAND_SCOPE_UNSUPPORTED`.
- Registration is bounded to 128 commands by default.
- A command with no direct shortcut may use an empty shortcut array and remain palette-discoverable.
- Unavailable commands remain in snapshots and must return a non-empty current reason.
- Unregister closures cannot remove a later registration.
- `destroy()` clears commands, sequence state, and timers.

## 3. Scope precedence

Supported scopes are:

- `global`;
- `shell`;
- `editor`;
- `palette`;
- `review-modal`.

Precedence:

1. IME composition suppresses every application command.
2. An open review modal permits only review-modal ownership.
3. An open palette permits only palette-local ownership.
4. A focused text or form control suppresses broad application commands.
5. Editor commands explicitly safe for the editor may execute there.
6. Shell and global commands execute only when their scope is valid.
7. Native browser behavior remains untouched when no command matches.

`Ctrl/Cmd+K` is the sole global command intentionally allowed from a focused text field. It provides an escape hatch into command discovery. Create, delete, undo, redo, list navigation, sequences, and other shell commands remain suppressed while typing.

## 4. Sequence contract

`gg` is registry-owned transient state:

- one accepted `g` arms one sequence and one timer;
- the second `g` within 450 ms and the same context executes first-note navigation;
- any intervening key resets the pending sequence;
- context, focus, workspace, modal, palette, composition, blur, timeout, explicit reset, unregister, or teardown resets it;
- sequence state is not persisted or stored in application state.

## 5. Registered ordinary commands

The composition root registers commands for:

- command-palette open and close;
- ordinary note create;
- daily note;
- Search focus;
- editor save/flush;
- insert code block;
- pin and archive;
- delete through the existing lifecycle;
- recent-note switching;
- undo and redo;
- next, previous, first, and last note navigation;
- editor focus;
- Markdown and JSON export;
- safe-mode local reset.

All commands call existing actions, controllers, autosave, command stack, lifecycle, and export boundaries. The registry performs no durable mutation.

## 6. Japanese and review compatibility

The five existing Japanese quick-create providers are registered into the same bounded registry through a compatibility adapter in `ui/palette.js`. The adapter:

- validates the initial provider result;
- assigns namespaced registry IDs;
- evaluates provider availability live;
- retains unavailable commands with `Japanese study data is unavailable`;
- unregisters every command during cleanup.

The dashboard buttons continue to call the existing Japanese coordinator action owner. Review numeric shortcuts remain modal-local as approved by issue #74, while registry modal context prevents every background command from executing. Full Japanese Notes/Review information architecture and direct Japanese command registration are owned by #70.

## 7. Palette discovery

The command palette is the compact keyboard-help surface:

- open with `Ctrl/Cmd+K`;
- search title, description, and unavailable reason;
- display platform-aware shortcut labels;
- display unavailable commands rather than hiding them;
- prevent disabled command execution;
- preserve Arrow, Enter, Escape, outside-click, and focus-return behavior;
- isolate all background commands while open.

Presentation follows the accepted Figma command-palette pattern while repository shortcut behavior remains authoritative.

## 8. Verification evidence

Intentional RED:

- browser run 211 (`30897531895`): `35` passed, `6` failed on the accepted command conflicts;
- unit run 213 (`30898009779`): existing `157/157` passed and all `10` new registry tests failed because `ui/commandRegistry.js` was intentionally absent.

GREEN implementation:

- run 225 (`30901067573`) on head `6308a7aeb5e9f4ff3bda09e4946d6e716a824598`;
- repository content `3/3`;
- ESLint clean;
- unit `167/167`;
- integration `44/44`;
- E2E `41/41`;
- failure artifact skipped.

The final documentation head requires its own fresh workflow result before merge.

## 9. Limits and rollback

- User-defined remapping, macros, plugins, and public command APIs are not implemented.
- Physical macOS Cmd testing, screen readers, and browser/platform conflict certification remain release-gate evidence.
- Existing dependency-audit and GitHub Actions Node-runtime warnings are unchanged.
- Rollback is one PR revert. No note, review, schema, migration, search, or user-data rollback is required.
