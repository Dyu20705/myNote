# User-Flow and Beta-Test Guide

This guide defines the core acceptance flows and a four-week internal beta sequence for myNote.

## Beta objectives

- Validate the daily note lifecycle under normal and failure conditions.
- Verify consistency across editing, autosave, search, backlinks, persistence, and undo/redo.
- Detect data-loss defects, race conditions, performance regressions, and blocking accessibility or interaction issues.

## Core acceptance flows

### A. First note and persistence

1. Open the application.
2. Press `Ctrl/Cmd+N`.
3. Enter a title and body.
4. Allow autosave to complete or press `Ctrl/Cmd+Enter`.
5. Confirm the visible local-save status.
6. Close the editor overlay and confirm the card remains on the board.
7. Reload the page.

Expected:

- The note appears in the `PINNED` or `NOTES` board section.
- The acknowledged title and body survive reload.
- No duplicate note is created.

### B. Search and keyboard navigation

1. Enter a query in the search field.
2. Use `j` and `k` to move through results.
3. Use `gg` and `G` to select the first and last result.
4. Open the command palette and execute a supported command.

Expected:

- Results update without visible main-thread stalls.
- Active selection remains synchronized between the board and centered editor overlay.
- Keyboard focus remains visible and predictable.

### C. Wiki links and backlinks

1. Create notes A and B.
2. Add `[[A]]` to note B.
3. Open note A and inspect backlinks.
4. Rename A and repeat the check.
5. Delete and restore one linked note where supported.

Expected:

- B appears as an incoming reference to A.
- Rename, deletion, and restoration do not leave stale reverse edges.

### D. Undo and redo

1. Edit a note.
2. Press `Ctrl/Cmd+Z`.
3. Press `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`.

Expected:

- Changes move backward and forward in the correct order.
- Persistence, search, list rendering, and editor state remain consistent.
- A failed durable mutation does not advance history.

### E. Export

1. Open the command palette with `Ctrl/Cmd+K`.
2. Run **Export all as Markdown**.
3. Run **Export all as JSON**.
4. Inspect both outputs.

Expected:

- Files download successfully.
- Output is non-empty when notes exist.
- JSON parses successfully and Markdown remains human-readable.
- Exported content matches canonical notes.

### F. Recovery

1. Exercise an isolated storage initialization or migration failure fixture.
2. Confirm the application exposes a bounded recovery state.
3. Use the confirmed local reset only after export/recovery options are understood.
4. Reload after reset.

Expected:

- The error explains the affected subsystem without exposing note content.
- Failed operations do not report durable success.
- Reset clears only the application’s local database and legacy key.
- The application can bootstrap cleanly afterward.

## Four-week internal beta sequence

### Week 1 — Smoke and onboarding

- Exercise flows A, B, and E.
- Record blockers, crashes, data loss, confusing first-run states, and keyboard failures.

### Week 2 — Core reliability

- Exercise flows C and D.
- Repeat against a medium collection of at least 500 notes.
- Inject persistence and derived-index failures through deterministic test fixtures where available.

### Week 3 — Stress and edge cases

- Use long notes, many tags, many links, fenced code, rapid edits, and repeated navigation.
- Repeat reload, close/open, hidden/visible tab, and interruption scenarios.
- Observe memory, search latency, and autosave serialization over a long session.

### Week 4 — Go/no-go review

- Resolve every reproducible critical or high-severity data-integrity defect.
- Re-run regression scenarios for fixed defects.
- Record remaining limitations, owners, and release impact.

## Minimum test matrix

- Browsers: current Chrome, Edge, and Firefox.
- Platforms: Windows and at least one of macOS or Linux.
- Collection sizes:
  - Small: fewer than 100 notes.
  - Medium: 100–1,000 notes.
  - Large: more than 1,000 notes.

## Pass criteria

- No reproducible critical/high data-loss defect remains.
- Undo/redo, search, backlinks, export, and persistence have no known consistency failure in the tested scope.
- Recovery behavior works in the primary test environments.
- Core interactions remain within the documented performance budget or have an explicitly accepted measured exception.

## Fail criteria

- Reproducible acknowledged-data loss or silent overwrite.
- Visible main-thread freezes during a core workflow.
- Export produces invalid, empty, or incomplete output for existing canonical data.
- Failure states report success or clear retryable user input.

## Internal defect record

Each defect should include:

- Area and concise summary.
- Browser, operating system, and versions.
- Exact reproduction steps.
- Actual and expected results.
- Frequency.
- Data-integrity, security, accessibility, and performance impact.
- Screenshot/video or synthetic export fixture when safe and relevant.
- Verification command or acceptance flow used after the fix.
