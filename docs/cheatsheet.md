# myNote cheatsheet

myNote is a desktop, local-first notes application. The board is the daily surface; note editing and review run in focused overlays.

## Notes board

- `New note` creates a canonical note, then opens the centered editor in create mode.
- Selecting a card opens the same editor in edit mode.
- Cards keep the search/workspace order and are presented in `PINNED` then `NOTES` sections. The board does not create a second sort or search owner.
- Closing the editor flushes the current draft first. A storage failure keeps the editor open with the draft and an explicit error.
- Opening and closing the editor preserves the board query, scroll position, and logical focus return.
- Pin is in the editor toolbar. `Details` contains backlinks and metadata. `More actions` contains less frequent actions such as Archive, `Add drawing`, and recoverable Delete.
- Saved drawings appear directly above title/body. One newest drawing is shown by default; older drawings use a bounded disclosure. Valid V2 drawings expose Edit/Delete without copying vectors into note content.
- A successful delete closes the editor and exposes `Undo delete` on the board.

## Saving

- Autosave is the normal path. Editing changes the compact state to `Unsaved`; durable completion reports `Saved`.
- `Ctrl/Cmd+Enter` explicitly flushes the active note. `Save note` is also available through the command palette.
- `Saved · Search unavailable` means canonical storage succeeded but a derived search refresh failed. The note remains durable.
- `Storage unavailable` means canonical persistence failed. The exact draft stays visible for retry; do not treat it as saved.

## Japanese Notes

- `New Japanese note` exposes the five canonical templates: Vocabulary, Kanji, Grammar, today’s Output, and this week’s Planner.
- Common filters apply immediately: `All`, `Vocabulary`, `Grammar`, and `Kanji`.
- `Reading` is visibly unavailable until the Japanese V2 learning model owns that type. myNote does not infer or remap it to another canonical type.
- `+ Filter` discloses the existing canonical date and complete notebook-type controls. There is no Apply step.
- Active structured filters appear as removable chips. Search remains independent and is not cleared by applying, removing, or clearing structured filters.
- `Review N` starts or resumes the existing reveal-first review in one action. `Review 0` is disabled with its reason.
- `Study details` exposes derived metrics and bounded repair diagnostics without adding a required dashboard step to Review.
- Review content stays hidden until Reveal. After reveal, use `1`–`4` for Again, Hard, Good, and Easy. Closing Review retains queue position and returns focus to `Review N`.

## Keyboard and discovery

| Shortcut | Scope | Action |
| --- | --- | --- |
| `Ctrl/Cmd+K` | Global, including text fields | Open the command palette |
| `Ctrl/Cmd+N` | Notes board | Create an ordinary note |
| `/` | Board shell | Focus Search |
| `Ctrl/Cmd+Enter` | Note editor | Flush the active note |
| `Ctrl/Cmd+Z` | Board shell | Undo, including recoverable deletion |
| `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y` | Board shell | Redo |
| `Ctrl/Cmd+Tab` | Board shell | Switch to the previous active note |
| `j` / `k` | Board shell | Select next / previous visible note |
| `gg` / `G` | Board shell | Select first / last visible note |
| `i` | Board shell | Open/focus the active note editor |
| `Delete` | Board shell | Delete the active note through the shared lifecycle |
| `1` / `2` / `3` / `4` | Revealed Review | Again / Hard / Good / Easy |
| `Escape` | Active dialog/disclosure | Close and restore logical focus |

The command palette is the complete command-help surface. It shows current shortcuts, availability, and unavailable reasons, and dispatches through the same command definitions as visible controls. Text editing and IME composition take precedence over board navigation commands. An open editor, Review, or command palette isolates background commands.

## Data and recovery

- Notes, study-review metadata, and saved Kanji drawings remain local in IndexedDB.
- Markdown and JSON exports contain canonical note content. Japanese review scheduling remains separately owned by `studyReviews`.
- Safe-mode reset is destructive and confirmation-gated. Export or understand recovery options before using it.

Supported interaction scope is desktop keyboard and mouse at `1024×768`, `1280×720`, and `1440×900`. Mobile/tablet navigation, touch-first behavior, native wrappers, and PWA behavior are outside the current package.
