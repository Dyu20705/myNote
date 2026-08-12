# Japanese study workspace interaction contract

This document defines the browser-facing workspace delivered on top of the Japanese lifecycle contract. It does not redefine persistence, scheduling, parser, template, or dashboard semantics.

Issue #90 supersedes the earlier editor-first Notes/Review subview presentation. The current tree is board-first, edits through the shared centered note overlay, exposes Filter A directly, and starts or resumes Review from one compact board action. All lifecycle, search, filter, dashboard, scheduler, and persistence owners remain unchanged.

## Runtime ownership

The application uses one browser composition root and one shared runtime:

```text
index.html
→ app.js composition root
→ shared store, command stack, history, search client, backlink index, and NoteWorkspaceController
→ createJapaneseApp({ runtime, document })
→ JapaneseWorkspaceCoordinator and Japanese lifecycle actions
→ canonical IndexedDB note/review APIs
```

`app.js` is the only module loaded directly by `index.html`. It creates the shared runtime and injects it into `createJapaneseApp`. `japaneseApp.js` does not retrieve active singleton instances, create a parallel store, command stack, history, worker, or backlink index, or coordinate through rendered note-list elements.

`JapaneseWorkspaceCoordinator` owns initialization, per-workspace query and active-note snapshots, workspace switching, quick-create refresh, enrolled-delete refresh, Japanese slice synchronization, and bounded invalid-review recovery. It calls the injected `NoteWorkspaceController` directly.

The search worker remains responsible only for text indexing and ranking. `searchClient` applies registered result policies after a worker query. Policies have unique bounded IDs, run in registration order, receive defensive result-array copies, and cannot replace `searchClient.query`. The Japanese workspace registers exactly one `JapaneseNoteFilter` policy for enrollment, date, and notebook-type filtering.

## Workspace switching and refresh

- Notes is the default workspace after every bootstrap.
- The Notes and 日本語 controls are native buttons inside a labelled navigation region and expose their selected state through `aria-pressed`.
- Each workspace retains its own search query and last active note when switching.
- The Japanese workspace reuses the shared virtualized board and centered note-editor overlay.
- Switching invokes `JapaneseWorkspaceCoordinator.switchWorkspace`, which restores the target view and calls `NoteWorkspaceController.refresh`.
- Refresh never dispatches synthetic input events, creates a `MutationObserver`, queries `.note-item` elements, or programmatically clicks a rendered note.
- Search results are intersected with the validated enrolled-note ID set.
- Registered Japanese filtering is workspace-aware and returns the worker result unchanged in the ordinary Notes workspace.
- Switching workspaces never enrolls, tags, rewrites, archives, or deletes a note.
- The ordinary Notes count continues to describe all canonical notes.

The note-workspace controller suppresses stale asynchronous query commits. Before an active-note transition it flushes the current draft. If that flush changes canonical content and the search index, it performs the authoritative query again before committing results. A refresh that keeps the same active note updates list-oriented UI only and cannot overwrite an in-progress editor draft.

## Japanese note filters

Japanese Notes exposes common Filter A controls directly above the board and keeps the complete structured controls behind `+ Filter`. All controls are hidden in the ordinary Notes workspace.

- `All`, `Vocabulary`, `Grammar`, and `Kanji` update the existing notebook-type filter immediately and expose native `aria-pressed` state.
- `Reading` is disabled with the explicit reason `Reading filters require the Japanese V2 learning model`. The M2 runtime does not invent a new canonical type or map Reading to an unrelated type.
- `+ Filter` discloses the complete existing canonical date/type controls. There is no Apply action.

- Created from and Created to use native date inputs and form an inclusive range.
- Date comparison uses each note's canonical `createdAt` timestamp converted to the browser's local calendar date.
- Note type is derived through the canonical `validateStudyReview` boundary and supports vocabulary, kanji, grammar, output, planner, or all types.
- Date, type, enrollment, and text search filters compose by intersection while preserving the search worker's result order.
- Missing notes, invalid creation timestamps, missing review metadata, invalid review metadata, and conflicting duplicate notebook-type metadata never gain an inferred match.
- An inverted date range is invalid, marks both date controls with `aria-invalid`, exposes one live validation message, and returns no matches until corrected or cleared.
- Active filters render as individually removable, validated chips outside the advanced disclosure panel.
- `Clear all` is rendered only while at least one structured filter is active.
- Removing a chip or choosing `Clear all` resets only the date and type controls. Neither action changes the workspace search query.
- Filter state is session-local and retained while switching workspaces. It is not persisted or exported.
- The live filter status reports visible Japanese results against the total enrolled Japanese note count.

Filtering is read-only. It does not write to IndexedDB, update review scheduling, modify note metadata, or rebuild the search index.

## Saved drawing projection

Ordinary and Japanese notes share `#noteDrawingRegion` inside the centered editor overlay. Valid note-linked #69 entries load through `kanjiInkApplication`, appear directly above title/body, and refresh immediately after durable save. The newest entry is primary; older entries require a bounded internally scrollable disclosure. Zero valid entries consume no overlay space.

V2 Edit/Delete and legacy V1 read-only behavior remain owned by #69. Drawing vectors stay in `kanjiInkEntries`; they are not copied into Japanese note content, parser metadata, review enrollment, scheduling, or learning evidence.

## Review entry and study details

Japanese Notes renders one compact `Review N` action using `studyDashboard.dueCount`. It starts or resumes the existing review dialog in one action. Zero-due and unavailable states are disabled with a programmatically associated reason.

`Study details` is an optional disclosure for the six values already derived by `studyDashboard`:

1. due reviews;
2. new vocabulary;
3. due kanji;
4. grammar notes;
5. output streak;
6. current planner progress.

The UI does not recompute these values. It only formats the deterministic result produced by `deriveStudyDashboard`. The six-card dashboard is not a mandatory route or a ceremony before Review.

The Needs repair region is absent when there are no entries. Non-empty diagnostics appear inside Study details, combine bounded dashboard repairs and lifecycle status entries, are deduplicated by code and optional note ID, sorted deterministically, limited to 20 visible rows, and accompanied by the existing omitted count. Diagnostics contain no note title or content.

## Quick create and command palette

One `New Japanese note` disclosure group and the command palette expose the same five registry commands:

- Create vocabulary note.
- Create kanji note.
- Create grammar note.
- Create today’s output note.
- Create this week’s planner.

Each disclosed action carries the same command ID executed by the palette. The command delegates to the lifecycle action boundary. Output and planner creation therefore preserve the canonical duplicate lookup: a valid enrolled current-date/current-week note is selected rather than duplicated.

After durable creation, the coordinator clears the Japanese search query, requests an explicit workspace refresh with the created or existing note as the preferred ID, and the UI opens the shared editor overlay with title focus. The generic Notes New note path uses the same overlay without Japanese enrollment.

The registered commands own their availability and unavailable reason. While creation is pending, both UI and palette paths expose `Japanese note creation is already in progress`. When persisted study-review data is unavailable, the disclosure trigger and actions are disabled while the commands remain discoverable in the palette with `Japanese study data is unavailable`; `ui/palette.js` contains no Japanese-specific global state or side-effect import.

## Enrolled deletion

Generic list, keyboard, and command-palette deletion all enter the same `deleteActiveNote` boundary in `app.js`.

- `createJapaneseApp` registers one enrolled-delete handler with the composition root.
- A validated enrolled note is routed through the atomic note/review lifecycle action.
- An ordinary note falls through to the generic durable note deletion path.
- After enrolled deletion, the coordinator refreshes the current workspace through `NoteWorkspaceController`.
- There is no capture-phase note-list delete bridge or DOM note-ID reconstruction.

## Review session

Japanese Notes is the board-first workspace. `Review N` launches the native review-session dialog directly; there is no permanent Review subview, intermediate Review-ready route, or Start button ceremony. Closing and reopening the dialog does not recreate the review queue.

- Content is hidden until the user explicitly reveals it.
- The current item and progress are derived from immutable review-session state.
- Again, Hard, Good, and Easy are native buttons; number keys 1–4 are equivalent while the revealed dialog is active.
- Escape or Close dismisses the dialog without discarding queue position. The same `Review N` board control resumes the session and receives restored focus when available.
- Successful rating persists the review before state advances.
- Persistence failure keeps the item visible and revealed, retains retry intent, exposes `Save failed; retry rating`, re-enables all rating controls, and does not advance.
- A current note that becomes missing or archived is skipped deterministically. The next valid item is retained with `Skipped missing note` or `Skipped archived note` status.
- Completion has one live `Review complete` announcement and a separate visual `Session complete` panel to avoid duplicate screen-reader output.

Review content is assigned through `textContent`; Markdown is not rendered as raw HTML.

## Generic Notes compatibility

Browser regressions cover the ordinary Notes workspace after the Japanese UI factory is composed:

- create and durable edit;
- autosave and explicit save;
- search filtering after save;
- editor-draft preservation during an overlapping autosave and refresh;
- keyboard list navigation;
- pin and archive commands;
- JSON export;
- recovery-reset cancellation;
- save-triggered reload persistence;
- Japanese filter isolation while switching between workspaces.

The shared command palette retains its original API and accepts additive command providers. The static server allowlist exposes `app.js`, the imported `japaneseApp.js` module, and `japanese.css`; repository-sensitive paths remain forbidden. Japanese controller and policy modules are served through the existing bounded `/core/*.js` and `/ui/*.js` rules.

## Accessibility and responsive behavior

- Workspace controls, common filters, advanced filter disclosure and chips, quick-create action-group buttons, Review entry, study-details disclosure, and ratings use native form elements and buttons.
- The filter region, dashboard, Needs repair region, palette, and review dialog have explicit accessible names.
- Filter result counts and range validation share one polite status region.
- Invalid date controls expose `aria-invalid` without silently rewriting user input.
- Focus enters Review at Reveal or the first rating and returns to `Review N` or the 日本語 workspace control after close.
- Clearing all structured filters or removing the type chip restores focus to `All`; removing a date chip restores focus to `+ Filter`. Text search remains unchanged.
- The native modal dialog prevents interaction with the background while open.
- Keyboard users can switch workspaces, filter notes, create notes from the command palette, reveal, rate, close, and resume without pointer input.
- Narrow layouts wrap Filter A controls and reduce optional dashboard and rating grids to fewer columns and then one column.
- Reduced-motion preference disables smooth scrolling behavior.

## Performance and retained resources

The Japanese UI adds a fixed set of listeners, one dashboard subscription, one filter subscription, one search-result policy, and five bounded command registrations. It adds no polling, background timer, retry loop, worker, or unbounded collection.

The search-result pipeline retains at most 16 policies and copies only bounded search-ID arrays at policy boundaries. A note-array replacement re-derives the bounded Japanese slice using the lifecycle contract. Ordinary keystrokes do not replace the note array and therefore do not trigger full Japanese re-derivation. Japanese text search reuses the existing worker result and applies one O(ids + notes + reviews) Japanese policy while preserving order.

Controller refresh retains one request-local ID array and one monotonically increasing request token. A nested autosave-derived refresh is suppressed while an active controller refresh owns the transition; the outer refresh reuses the updated search index and remains the only state commit authority.

## Failure and recovery

- Missing injected runtime instances, an unavailable policy registration API, or missing required controls fail initialization instead of constructing parallel state.
- Duplicate, malformed, excessive, or invalid-output search policies fail with bounded content-free errors.
- Canonical storage failures remain owned by lifecycle actions.
- Derived search/backlink failures retain durable success and surface bounded degradation.
- Invalid filter metadata is excluded rather than repaired or inferred.
- Invalid persisted study reviews are converted by the coordinator into bounded `study-data-unavailable` state. The 日本語 workspace remains accessible, Study details exposes the non-empty diagnostics, Japanese quick-create/Review mutations remain disabled with reasons, and ordinary Notes remains operational.
- Rating failure is explicit and retryable; there is no automatic retry.
- The ordinary safe-mode reset remains available and requires confirmation.

## Rollback

Rollback is a one-PR revert of:

- the single-entrypoint composition changes;
- `NoteWorkspaceController` and `JapaneseWorkspaceCoordinator`;
- the injected Japanese UI factory;
- removal of the delete and degraded DOM bridges;
- the Japanese filter domain policy and controller;
- the bounded search-result policy pipeline and search-client registration API;
- browser regressions, focused unit coverage, package test registration, and this document.

No schema downgrade, note rewrite, review deletion, or migration is required.
