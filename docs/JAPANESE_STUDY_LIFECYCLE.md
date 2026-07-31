# Japanese study lifecycle contract

This document defines the non-UI application boundary for the Japanese study workspace. It composes the schema-v2 review store, templates, scheduler, parser-owned task nodes, and pure dashboard derivation without changing the ordinary note model.

## Ownership

```text
UI and application bootstrap
→ Japanese actions
→ immutable Japanese state transitions
→ canonical note/review persistence
→ rebuildable backlinks and search
→ bounded operation history
```

`core/japaneseState.js` owns pure state derivation and review-session transitions. `core/japaneseActions.js` owns durable orchestration. Neither module owns DOM rendering, styling, network access, timers, or an ambient clock.

Canonical notes remain caller-owned application state. The Japanese state module returns only the Japanese slice: workspace selection, validated reviews, enrolled note IDs, dashboard metrics, bounded diagnostics, caller time context, and review-session state.

## Bootstrap

Bootstrap receives already-loaded canonical notes and study reviews plus explicit `nowIso`, `localDate`, and `isoWeek` values.

It must:

- preserve ordinary notes exactly;
- validate and defensively copy review records;
- derive enrolled note IDs only from valid note/review pairs;
- expose deterministic dashboard and due-queue data;
- start in the ordinary Notes workspace;
- perform no persistence write and no automatic enrollment.

Invalid, duplicate, orphaned, or archived records remain visible through bounded status entries. Bootstrap never deletes, repairs, tags, rewrites, or enrolls a note.

## Durable ordering

Every Japanese mutation follows this ordering:

```text
validate and prepare exact values
→ commit canonical IndexedDB mutation
→ commit immutable application state
→ update rebuildable backlinks/search
→ record operation history
```

Canonical persistence failure leaves state, derived indexes, history, and command-stack success unchanged. Derived-index failure after canonical success does not roll back durable data; it adds a bounded `derived-index-unavailable` status.

## Create

Creating a Japanese note prepares one template note and one initial review with matching identifiers. The pair is inserted in one transaction before state changes.

Output and planner creation first use the canonical enrolled-template lookup. A valid existing current-date output or current-week planner note is selected instead of duplicated.

Undo deletes the pair atomically. Redo restores the exact captured note and review using collision-safe add semantics. The command stack records success only after the complete durable lifecycle succeeds.

## Delete and restore

The generic delete action checks whether the target note has a validated review:

- enrolled note: use atomic note-and-review deletion;
- ordinary note: use the existing note-only deletion route;
- missing note: return without mutation.

Undo restores the exact captured values. Redo repeats the same deletion route. Orphan reviews are never silently removed when their note is absent.

## Rating and retry

A rating transition is calculated by the pure scheduler using caller-supplied time. The updated review is persisted before replacing state or advancing the queue.

On success:

- the validated review replaces the previous review;
- dashboard and enrolled-note projections are re-derived;
- the current review session advances;
- history is recorded after durable success.

On persistence failure:

- the previous review remains canonical in state;
- the current queue position remains selected;
- `pendingRating` retains only `noteId`, rating, and supplied time for an explicit retry;
- the bounded message is `Save failed; retry rating`;
- the original storage error is rethrown.

There is no background retry loop.

## Due queue and status bounds

The due queue includes only valid, non-archived note/review pairs that are due by instant. It is ordered deterministically by persisted `nextReviewAt` spelling and then note ID.

Status entries are sorted by code and note ID, capped at 20 distinct entries, and accompanied by an omitted-entry count. Each invalid or duplicate source record is counted exactly once.

## Complexity and retained state

For `n` notes and `r` reviews, bootstrap and full re-derivation use `O(n log n + r log r)` time and `O(n + r)` call-local memory. Review-session transitions are `O(1)` except when starting a session, which rebuilds the deterministic due queue.

There is no unbounded cache, listener, timer, queue, retry structure, or snapshot in this boundary. The existing command and history limits remain authoritative.

## Compatibility and rollback

No database schema or stored record shape changes. Ordinary note editing, export, search, backlinks, and migration remain compatible.

Rollback is a one-PR revert of the state/action modules, focused tests, suite registration, and this document. Review data remains valid schema-v2 data and must not be deleted or downgraded.