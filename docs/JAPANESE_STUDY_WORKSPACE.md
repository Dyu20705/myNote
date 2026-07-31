# Japanese study workspace interaction contract

This document defines the browser-facing workspace delivered on top of the Japanese lifecycle contract. It does not redefine persistence, scheduling, parser, template, or dashboard semantics.

## Runtime ownership

The application keeps one runtime for both workspaces:

```text
shared DOM shell
→ shared application store, command stack, history, search client, and backlink index
→ bounded search-result policy pipeline
→ Japanese lifecycle actions and immutable state
→ canonical IndexedDB note/review APIs
```

`japaneseApp.js` is a thin UI orchestration layer. It retrieves the active runtime instances created by `app.js`; it does not create a second note store, command stack, history, search worker, or backlink index. UI code never opens or mutates IndexedDB directly. All Japanese writes pass through `createJapaneseActions`.

The search worker remains responsible only for text indexing and ranking. `searchClient` applies registered result policies after a worker query. Policies have unique bounded IDs, run in registration order, receive defensive result-array copies, and cannot replace `searchClient.query`. The Japanese workspace registers exactly one `JapaneseNoteFilter` policy for enrollment, date, and notebook-type filtering.

## Workspace switching

- Notes is the default workspace after every bootstrap.
- The Notes and 日本語 controls are native buttons inside a labelled navigation region and expose their selected state through `aria-pressed`.
- Each workspace retains its own search query and last active note when switching.
- The Japanese workspace reuses the existing virtualized list and editor. Search results are intersected with the validated enrolled-note ID set.
- Registered Japanese filtering is workspace-aware and returns the worker result unchanged in the ordinary Notes workspace.
- Switching workspaces never enrolls, tags, rewrites, archives, or deletes a note.
- The ordinary Notes count continues to describe all canonical notes.

## Japanese note filters

The Japanese workspace exposes additive filters for creation date and notebook type. The controls are hidden in the ordinary Notes workspace.

- Created from and Created to use native date inputs and form an inclusive range.
- Date comparison uses each note's canonical `createdAt` timestamp converted to the browser's local calendar date.
- Note type is derived from validated `studyReviews.notebookType` metadata and supports vocabulary, kanji, grammar, output, planner, or all types.
- Date, type, enrollment, and text search filters compose by intersection while preserving the search worker's result order.
- Missing notes, invalid creation timestamps, missing review metadata, invalid review metadata, and conflicting duplicate notebook-type metadata never gain an inferred match.
- An inverted date range is invalid, marks both date controls with `aria-invalid`, exposes one live validation message, and returns no matches until corrected or cleared.
- Clear filters resets only the date and type controls. It does not change the workspace search query.
- Filter state is session-local and retained while switching workspaces. It is not persisted or exported.
- The live filter status reports visible Japanese results against the total enrolled Japanese note count.

Filtering is read-only. It does not write to IndexedDB, update review scheduling, modify note metadata, or rebuild the search index.

## Dashboard

The Japanese workspace renders exactly six cards from `studyDashboard`:

1. due reviews;
2. new vocabulary;
3. due kanji;
4. grammar notes;
5. output streak;
6. current planner progress.

The UI does not recompute these values. It only formats the deterministic result produced by `deriveStudyDashboard`.

The Needs repair region combines bounded dashboard repairs and lifecycle status entries. Entries are deduplicated by code and optional note ID, sorted deterministically, limited to 20 visible rows, and accompanied by the existing omitted count. Diagnostics contain no note title or content.

## Quick create and command palette

The dashboard and command palette expose the same five actions:

- Create vocabulary note.
- Create kanji note.
- Create grammar note.
- Create today’s output note.
- Create this week’s planner.

Each action delegates to the lifecycle action boundary. Output and planner creation therefore preserve the canonical duplicate lookup: a valid enrolled current-date/current-week note is selected rather than duplicated.

After durable creation, the workspace clears its Japanese search query, selects the created or existing note, refreshes the shared list, and restores editor focus. The generic Notes New note path remains unchanged.

## Review session

A review session is a native modal dialog.

- Content is hidden until the user explicitly reveals it.
- The current item and progress are derived from immutable review-session state.
- Again, Hard, Good, and Easy are native buttons; number keys 1–4 are equivalent while the revealed dialog is active.
- Escape or Close dismisses the dialog without discarding queue position. The dashboard button becomes Resume review and receives restored focus.
- Successful rating persists the review before state advances.
- Persistence failure keeps the item visible and revealed, retains retry intent, exposes `Save failed; retry rating`, re-enables all rating controls, and does not advance.
- A current note that becomes missing or archived is skipped deterministically. The next valid item is retained with `Skipped missing note` or `Skipped archived note` status.
- Completion has one live `Review complete` announcement and a separate visual `Session complete` panel to avoid duplicate screen-reader output.

Review content is assigned through `textContent`; Markdown is not rendered as raw HTML.

## Generic Notes compatibility

Browser regressions cover the ordinary Notes workspace after the Japanese UI is loaded:

- create and durable edit;
- autosave and explicit save;
- search filtering;
- keyboard list navigation;
- pin and archive commands;
- JSON export;
- recovery-reset cancellation;
- save-triggered reload persistence;
- Japanese filter isolation while switching between workspaces.

The shared command palette retains its original API and accepts additive command providers. The static server allowlist exposes only the two declared root assets `japaneseApp.js` and `japanese.css`; repository-sensitive paths remain forbidden. Japanese filter and search-policy logic is served through the existing bounded `/core/*.js` and `/ui/*.js` rules.

## Accessibility and responsive behavior

- Workspace controls, filter controls, quick-create controls, review actions, and ratings use native form elements and buttons.
- The filter region, dashboard, Needs repair region, palette, and review dialog have explicit accessible names.
- Filter result counts and range validation share one polite status region.
- Invalid date controls expose `aria-invalid` without silently rewriting user input.
- Focus enters the modal at Reveal or the first rating and returns to Start/Resume after close.
- Clearing filters restores focus to the note-type control.
- The native modal dialog prevents interaction with the background while open.
- Keyboard users can switch workspaces, filter notes, create notes from the command palette, reveal, rate, close, and resume without pointer input.
- Narrow layouts reduce filter, dashboard, quick-create, and rating grids to fewer columns and then one column.
- Reduced-motion preference disables smooth scrolling behavior.

## Performance and retained resources

The filter UI adds two date-input listeners, one type-change listener, one clear listener, and one shared-store subscription. It adds no polling, background timer, cache, retry loop, worker, or unbounded collection.

The search-result pipeline retains at most 16 policies and copies only bounded search-ID arrays at policy boundaries. A note-array replacement re-derives the bounded Japanese slice using the lifecycle contract. Ordinary keystrokes do not replace the note array and therefore do not trigger full Japanese re-derivation. Japanese text search reuses the existing worker result and applies one O(ids + notes + reviews) Japanese policy while preserving order.

## Failure and recovery

- Missing runtime instances, an unavailable policy registration API, or missing required filter controls fail initialization instead of constructing parallel state.
- Duplicate, malformed, excessive, or invalid-output search policies fail with bounded content-free errors.
- Canonical storage failures remain owned by the lifecycle actions.
- Derived search/backlink failures retain durable success and surface bounded degradation.
- Invalid filter metadata is excluded rather than repaired or inferred.
- Rating failure is explicit and retryable; there is no automatic retry.
- The ordinary safe-mode reset remains available and requires confirmation.

## Rollback

Rollback is a one-PR revert of:

- the workspace and filter markup and CSS;
- the Japanese browser entrypoint and filter controller;
- the Japanese filter domain policy and pure selector;
- the bounded search-result policy pipeline and search-client registration API;
- active-runtime getters and their tests;
- additive palette command providers;
- static-server root-asset declarations;
- browser regressions, focused unit coverage, and this document.

No schema downgrade, note rewrite, review deletion, or migration is required.
