# myNote editor and note-list interaction contract

Issue: [#68](https://github.com/Dyu20705/myNote/issues/68)

Implementation branch: `ux/68-editor-list-rationalization`

Base revision: `7ea7a8333bee51548b3fd48a70703422c7f97822`

Design source: Figma pattern `42:167` (Inspector & Note Actions), plus the accepted Notes route hierarchy. Repository lifecycle, save-status, and command behavior remain authoritative where sample design copy differs.

## 1. Boundary

This package changes ordinary note presentation and interaction hierarchy only. Canonical note normalization, Markdown parsing, search ranking, persistence, history, autosave, command execution, Japanese enrollment, scheduling, schemas, and migrations retain their existing owners.

The package adds no dependency, rich-text mode, new persistence path, parser replacement, search heuristic, Japanese information architecture, responsive one-pane navigation, or Kanji handwriting implementation.

## 2. Note-card presentation

`ui/notePresentation.js` creates a bounded plain-text preview for list scanning. It is deliberately not the canonical parser.

The preview helper:

- scans at most `8192` characters by default;
- emits at most `160` characters by default;
- removes common presentation delimiters, HTML-looking tags, comments, fence markers, link destinations, and unsafe control characters;
- preserves meaningful visible labels and code text;
- normalizes repeated whitespace;
- returns an empty string for empty or syntax-only content;
- never fabricates `Empty note`;
- never mutates the canonical input string;
- rejects hostile bounds with `NOTE_PRESENTATION_OPTIONS_INVALID`.

`createNoteCardPresentation()` exposes only existing note data: title, bounded preview, formatted update date, at most four tags, pinned state, and archived state.

`ui/list.js` renders exactly one native button per visible note. There is no sibling permanent delete control. The active note uses `aria-current="true"`, an inset rail, stronger border, and stronger type weight. Virtualization, ordering, active restoration, and controller-owned keyboard navigation remain unchanged.

## 3. Editor context header

The editor context header owns:

- the editable title;
- the sole live `#saveState` region;
- the `Details` disclosure;
- the `More actions` disclosure.

Routine save status remains restrained secondary text. The permanent primary Save button is removed from the rendered UI. Explicit save remains available through:

- autosave;
- `Ctrl/Cmd+Enter` in the editor;
- the `Save note` command in More actions;
- the shared command palette.

The application header owns note count only. This avoids two competing save-status regions.

A hidden bootstrap-only `#saveButton` adapter remains in static HTML because the existing composition root still binds its historical control during module initialization. `ui/editorChrome.js` removes the adapter immediately after composition. Automated browser evidence requires zero runtime `#saveButton` elements. The adapter has no visible presentation, keyboard access, state, persistence, or independent action ownership and can be deleted when the composition root is decomposed in a later internal refactor.

## 4. Details inspector

`Details` opens a labelled complementary region with:

- Backlinks;
- Metadata;
- Supplementary entities.

Empty Backlinks and Supplementary sections remain hidden. The inspector does not show an empty placeholder. Metadata exposes restrained current presentation facts such as local storage, update label, tags, and current pinned/archive state.

The inspector imports no store, search client, history, lifecycle, or persistence module. It observes already-rendered presentation and invokes no durable mutation.

Close, Escape, and deterministic fallback return focus to the opener, active note card, or title.

## 5. Note actions

`ui/noteActionRegistry.js` is a bounded presentation registry. Descriptors contain only:

```js
{
  commandId,
  tone,
  order,
  placement
}
```

The registry:

- defaults to at most 16 actions;
- rejects malformed descriptors, duplicates, and limit overflow;
- resolves current title, description, availability, and unavailable reason from the #74 command-registry snapshot;
- omits command IDs that are not currently registered;
- never stores or executes behavior closures;
- uses stale-safe unregister closures.

The current More actions surface resolves:

- `editor.save`;
- `notes.pin`;
- `notes.archive`;
- `notes.delete`.

Delete is explicitly labelled and styled as destructive. The action description states that deletion is recoverable through Undo. Every action invokes the existing command ID; the menu performs no direct persistence.

The `supplementary` placement is reserved for bounded entity extensions such as #69 Kanji handwriting without requiring a second command owner.

## 6. Recoverable deletion

Successful delete through More actions uses the existing `notes.delete` command, command stack, note lifecycle, and enrolled-Japanese delete handler. The UI then displays one bounded deletion-recovery notice.

`Undo delete` invokes `history.undo` through the shared command runtime. On success, the notice closes, the exact note is restored through existing undo/lifecycle behavior, and focus returns to the restored active card or editor title.

No new recycle-bin storage, tombstone schema, or irreversible shortcut is introduced.

## 7. Focus and dismissal

- Details and More actions are native buttons with visible focus.
- Opening one closes the other.
- Close buttons and Escape restore focus to the opener.
- Clicking outside the action popover closes it without stealing focus.
- Menu actions use current availability and cannot execute when unavailable.
- The command palette remains the complete keyboard-help and direct-dispatch parity surface.
- IME, modal, palette, and text-editing precedence remain owned by #74.

## 8. Static-server composition

`command.css` and `editor.css` are first-class application assets. The static server allowlist and security contract explicitly require both stylesheets to return `200` with CSS MIME type while repository-sensitive paths remain forbidden.

This fixes a previously hidden deployment defect where composed stylesheets existed in HTML but were rejected by the application-only static server.

## 9. Verification evidence

Intentional RED:

- run 230 (`30901959507`): repository content and lint green; all 167 existing unit tests passed; 9 new tests failed because `ui/notePresentation.js` and `ui/noteActionRegistry.js` were intentionally absent.

Systematic debugging:

- run 244 (`30903348787`): content, lint, unit, and integration green; 37 E2E passed and 9 failed;
- failure evidence identified four shared causes: stylesheet allowlist rejection, non-explicit selected attribute value, stale permanent-Save test paths, and ambiguous accessible-name locators;
- fixes were applied at the ownership boundary rather than weakening assertions.

GREEN implementation:

- run 251 (`30904385618`) on head `75f86cee06a5e3262a4b64b1b84c25ed574ced1e` completed successfully;
- repository content, ESLint, unit, integration, Playwright Chromium, and failure-artifact gates all passed;
- failure artifact upload was skipped because no E2E failure remained.

The final documentation head requires a fresh workflow before review and merge.

## 10. Known limits and rollback

- Physical screen-reader, forced-colors, Safari, Firefox, macOS, and Windows verification remain release-gate evidence.
- Mobile one-pane navigation belongs to #71.
- Japanese Notes/Review information architecture belongs to #70.
- Kanji handwriting entities and storage belong to #69.
- Empty/loading/error/recovery route mapping belongs to #72.
- Existing dependency-audit and GitHub Actions Node-runtime warnings are unchanged.
- Rollback is one PR revert. No schema, migration, canonical note, review record, search index, or user-data rollback is required.
