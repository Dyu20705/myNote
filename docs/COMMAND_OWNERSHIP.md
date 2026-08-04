# myNote keyboard command ownership

Issue: [#74](https://github.com/Dyu20705/myNote/issues/74)

Audit base: `main@1302dfd84d735df52a2eea8c4d0bafa03045e773`

Active branch: `ux/74-command-registry`

## 1. Purpose

This document records every keyboard and command-palette owner present before issue #74 implementation, the conflicts created by distributed ownership, and the target ownership boundary. It is an inventory and design constraint, not evidence that the target registry already exists.

## 2. Current handler inventory

Code search for `keydown`, `event.key`, and composition handling found three keyboard owners. No `keyup`, `keypress`, `compositionstart`, `compositionupdate`, or `compositionend` handler exists on the audited base.

### 2.1 `app.js`: editor-local keyboard handlers

Each Title and Content field owns a `keydown` listener.

| Input | Shortcut | Current effect | Current boundary |
| --- | --- | --- | --- |
| Title or Content | `Ctrl/Cmd+Enter` | Flush autosave | Direct call to the autosave owner |
| Content only | `Tab` | Insert two spaces | Local text-editing behavior; marks the draft dirty |

`Tab` insertion is a local editor behavior rather than an application command. It remains editor-owned unless a later accepted editor contract changes it. Explicit save/flush is an application command and must move to the shared registry while continuing to call the existing autosave owner.

### 2.2 `app.js`: global window keyboard handler

The single window listener currently owns the following shortcuts directly:

| Shortcut | Current effect | Existing action owner |
| --- | --- | --- |
| `Ctrl/Cmd+K` | Open command palette | `createPalette()` adapter |
| `Ctrl/Cmd+N` | Create ordinary note | `createNote()` |
| `Ctrl/Cmd+Z` | Undo last application command outside inputs | `undoLastCommand()` / command stack |
| `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y` | Redo outside inputs | `redoLastCommand()` / command stack |
| `Ctrl/Cmd+Tab` | Switch to recent note | `switchRecentNote()` |
| `Escape` while palette is open | Close palette | Palette adapter |
| `/` | Focus Search outside inputs | `focusSearch()` |
| `j`, `k` | Move note selection | `NoteWorkspaceController` |
| `G` | Jump to final filtered note | `NoteWorkspaceController` |
| `g`, `g` within 450 ms | Jump to first filtered note | `NoteWorkspaceController` plus `store.lastGAt` |
| `i` | Focus editor body | `focusEditor()` |
| `Delete` | Delete active note | `deleteActiveNote()` and enrolled-delete boundary |

The current target filter suppresses unmodified application shortcuts only for `input` and `textarea`. It does not recognize `select`, contenteditable elements, focused buttons, IME composition, native dialog ownership, or other modal surfaces. Several modified shortcuts are evaluated before the target filter and therefore execute while the user is editing.

The `gg` sequence stores `lastGAt` in application state. It has no explicit timer or reset on an intervening key, focus change, workspace change, modal open, or composition start. A sequence started with `g`, followed by `j`, then another `g` within 450 ms can incorrectly execute the boundary jump.

### 2.3 `ui/palette.js`: palette-local keyboard and provider ownership

The palette input owns:

| Shortcut | Current effect |
| --- | --- |
| `Escape` | Close palette |
| `Enter` | Execute the first title-filtered command |

The palette overlay also closes on an outside click.

`ui/palette.js` additionally owns a process-global `Set` of command provider functions. Provider commands override base commands silently when IDs collide. The provider collection and command count are unbounded. Command objects require only the fields consumed by callers; there is no centralized validation for ID, title, description, shortcuts, scope, availability, unavailable reason, or execution function.

The palette receives a separate base command array from `app.js`, merges provider output at open time, filters only by title, and invokes `command.run()` through the composition root. Direct shortcuts do not resolve through this command inventory.

### 2.4 `japaneseApp.js`: Japanese provider and review-local keyboard owner

`japaneseApp.js` registers five palette-only quick-create commands:

- Create vocabulary note.
- Create kanji note.
- Create grammar note.
- Create today’s output note.
- Create this week’s planner.

When Japanese study data is unavailable, the provider returns an empty array. The unavailable commands disappear instead of exposing a reason.

The Japanese review dialog owns numeric rating keys after content is revealed:

| Shortcut | Rating |
| --- | --- |
| `1` | Again |
| `2` | Hard |
| `3` | Good |
| `4` | Easy |

The handler is attached to the native dialog, but unrelated keys bubble to the global window handler. With a rating button focused, `j`, `k`, `/`, `i`, `G`, `g`, or `Delete` can reach background application commands because focused buttons are not excluded and modal state is not evaluated. The rating handler also has no IME composition guard.

Native `Escape` closes the review dialog through browser dialog behavior. Focus restoration is owned by the dialog `close` handler and must remain deterministic after registry integration.

## 3. Current palette inventory

`app.js` defines thirteen base palette commands:

| Current ID | Title | Current execution owner |
| --- | --- | --- |
| `new` | New note | `createNote()` |
| `daily` | Open daily note | `openDailyNote()` |
| `search` | Focus search | `focusSearch()` |
| `code` | Insert code block | `insertCodeBlock()` |
| `pin` | Toggle pin active note | `mutateActiveNote()` |
| `archive` | Archive active note | `mutateActiveNote()` |
| `delete` | Delete active note | `deleteActiveNote()` |
| `recent` | Switch recent note | `switchRecentNote()` |
| `undo` | Undo last command | `undoLastCommand()` |
| `redo` | Redo last command | `redoLastCommand()` |
| `export-md` | Export all as Markdown | `exportMarkdown()` |
| `export-json` | Export all as JSON | `exportJson()` |
| `recovery-reset` | Safe mode: reset local database | `resetLocalData()` |

`japaneseApp.js` contributes five provider commands with IDs `japanese-create-vocabulary`, `japanese-create-kanji`, `japanese-create-grammar`, `japanese-create-output`, and `japanese-create-planner`.

Direct keyboard dispatch and palette execution currently share action functions in some cases but do not share command definitions, availability decisions, shortcut metadata, disabled reasons, or scope evaluation.

## 4. Confirmed conflict and lifecycle gaps

1. `Ctrl/Cmd+N` executes before input precedence is evaluated and can replace the active draft while the user is typing.
2. `Ctrl/Cmd+K` and `Ctrl/Cmd+Tab` also bypass the current input filter; their final policy must be explicit rather than accidental.
3. No IME composition boundary exists.
4. `shouldHandleGlobalKey()` protects only `input` and `textarea`; it does not protect selects, contenteditable surfaces, or focused controls.
5. The native review dialog does not isolate background application commands.
6. `gg` does not reset after an intervening key or context transition.
7. Duplicate command IDs are accepted and provider commands overwrite prior definitions.
8. Provider and command registration are unbounded.
9. Unavailable commands disappear or silently no-op instead of exposing a current reason.
10. Palette and direct shortcuts have separate dispatch paths.
11. Command shortcut labels are not owned by command metadata.
12. Palette close does not retain and restore a general opener; review-dialog focus restoration is separate and must not regress.
13. Command-provider errors, malformed commands, and stale provider cleanup have no deterministic public contract.
14. Sequence state is stored in application state even though it is transient input-dispatch state.

## 5. Target ownership map

### 5.1 `ui/commandRegistry.js`: one DOM-independent command authority

The new module owns:

- bounded command registration and unregister cleanup;
- command-shape validation;
- unique IDs;
- allowed scope validation;
- normalized platform shortcut metadata;
- fresh availability and unavailable-reason evaluation;
- execution by command ID;
- shortcut matching and dispatch decisions;
- text-input, form-control, contenteditable, IME, and modal precedence policy;
- bounded sequence state, timeout, reset, and teardown;
- a read-only command snapshot consumed by palette/help adapters.

It must not import IndexedDB, storage, state singletons, Japanese actions, or DOM nodes. Context, active scope, platform, focused-target classification, composition state, modal state, and action callbacks are injected by the composition boundary.

The registry is an internal application contract, not a public extension or plugin API.

### 5.2 `ui/palette.js`: rendering and focus adapter only

The palette owns:

- open/close presentation;
- query input and filtered rendering;
- displaying shortcut labels;
- displaying unavailable reasons without removing commands;
- invoking registry execution by ID;
- palette-local focus movement and deterministic focus return;
- outside-click and palette-local Escape behavior.

It no longer owns a global provider set, command merging, ID override behavior, command validation, or execution functions.

### 5.3 `app.js`: composition and ordinary command registration

The composition root owns:

- creating exactly one registry and dispatcher;
- registering ordinary Notes, shell, editor, navigation, history, export, and palette commands with existing action closures;
- deriving current workspace, focused-target class, modal state, and platform context;
- installing exactly one global keyboard listener plus bounded composition tracking where required;
- passing the registry boundary to `createJapaneseApp()`;
- removing superseded direct command branches and `store.lastGAt` ownership.

Canonical action functions, autosave, command stack, workspace controller, note lifecycle, and persistence remain unchanged owners of behavior and data.

Content-field `Tab` insertion remains local editor behavior. `beforeunload`, `visibilitychange`, clicks, and autosave blur are lifecycle/event handlers rather than commands and remain outside the registry.

### 5.4 `japaneseApp.js`: Japanese command registration and modal context

The Japanese application registers:

- five quick-create commands with live availability and reasons;
- workspace commands where accepted;
- review reveal, rating, and close commands in review-modal scope.

It supplies review-session context and action callbacks but does not create a second dispatcher or palette provider system. Numeric ratings remain modal-local and cannot permit background list/editor commands.

### 5.5 Existing action and persistence owners

The registry never performs durable work directly.

| Command category | Preserved execution owner |
| --- | --- |
| Ordinary create/edit/pin/archive/delete | Existing application action functions and command stack |
| Enrolled Japanese delete | Existing injected enrolled-delete/coordinator boundary |
| Save/flush | Existing autosave owner |
| Undo/redo | Existing command stack and refresh boundary |
| List movement/boundaries | `NoteWorkspaceController` |
| Japanese quick create/delete/review | `JapaneseWorkspaceCoordinator` and Japanese actions |
| Search | Existing Search focus and search worker/controller boundaries |
| Export | Existing in-memory export functions |
| Persistence | Existing storage/lifecycle modules only |

## 6. Required scope model

The initial implementation may refine names, but it must represent these semantic scopes without DOM discovery inside command definitions:

- `global`: safe shell commands explicitly allowed across non-modal contexts;
- `shell`: navigation/search/workspace commands outside editing and modal contexts;
- `editor`: commands explicitly safe while title/content editing;
- `palette`: palette-local commands;
- `review-modal`: review-only commands while the native review dialog is open.

Precedence is:

1. IME composition and native text editing.
2. Open modal/dialog owner.
3. Open palette owner.
4. Focused editor/form-control owner.
5. Shell/global application commands.
6. Native browser/platform behavior when no accepted application command matches.

A command may opt into a narrower high-precedence context; broad commands cannot bypass the precedence policy merely because they use a modifier.

## 7. Sequence contract

The `gg` sequence becomes dispatcher-owned transient state:

- the first accepted `g` arms the sequence for at most 450 ms;
- a matching second `g` in the same valid scope executes the first-boundary command;
- any different key, composition start, focus/scope change, modal/palette transition, workspace transition, timeout, blur, or dispatcher teardown resets the sequence;
- sequence keys never arm or execute while typing or composing;
- state is bounded to one pending sequence and one timer;
- sequence state is absent from canonical application state and persistence.

## 8. Verification boundary

Issue #74 must add:

- unit tests for registry validation, limits, duplicate rejection, availability freshness, unavailable reasons, shared execution, scope precedence, sequence reset, and cleanup;
- browser tests for input precedence, IME composition, modal isolation, sequence reset, palette/direct availability parity, and focus return;
- existing Notes, Japanese, review, editor-shell, persistence, and deletion regressions;
- current README and UX command documentation reconciled with the runtime inventory.

No implementation claim is made by this inventory. The first branch checkpoint intentionally adds failing tests before the registry and migration work.