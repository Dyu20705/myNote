# Japanese Study Dashboard Contract

This document defines the pure parser and dashboard boundary introduced by work package #49. Application state, actions, persistence, and UI consume this contract but do not reimplement it.

## Canonical task nodes

The canonical parser recognizes these line forms outside fenced code:

```text
- [ ] task text
- [x] completed task text
- [X] completed task text
```

The AST shape is exact:

```js
{ type: "task", checked: false, text: "task text" }
```

Leading indentation is normalized by the existing line parser. The marker must use a hyphen, one space, a three-character checkbox, and either end the line or be followed by whitespace. Unsupported or malformed task-like lines remain ordinary paragraph nodes. Task text continues to participate in canonical tag, wiki-link, and token extraction. Task-looking content inside closed or unclosed fenced code remains code.

## Dashboard input

`deriveStudyDashboard` accepts one exact plain object:

```js
{
  notes,
  reviews,
  nowIso,
  localDate,
  isoWeek,
}
```

The caller supplies every time boundary. The module does not read the system clock, locale, timezone configuration, persistence, state, DOM, or network.

Malformed top-level input rejects with a fresh content-free `TypeError` whose code is `INVALID_STUDY_DASHBOARD_INPUT`. Malformed note and review records inside valid arrays are isolated into bounded repair diagnostics instead of aborting the complete derivation.

## Deterministic join

The derivation validates notes and reviews independently, groups them by `noteId`, and selects one canonical record from each duplicate group using a stable content key. Array order does not affect the result.

Only valid review records joined to valid, unarchived notes contribute metrics. Orphan reviews and archived enrolled notes are reported and excluded. Ordinary notes without a review remain ordinary notes and are not enrolled automatically.

## Metrics

The result has this exact shape:

```js
{
  dueCount,
  newVocabulary,
  dueKanji,
  grammarTotal,
  outputStreak,
  plannerProgress: { completed, total },
  needsRepair,
  needsRepairOmitted,
}
```

- `dueCount`: all valid, unarchived, non-suspended enrolled reviews due at `nowIso`.
- `newVocabulary`: valid, unarchived vocabulary reviews with status `new`.
- `dueKanji`: valid, unarchived kanji reviews due at `nowIso`.
- `grammarTotal`: all valid, unarchived grammar enrollments, including suspended records because this is an inventory metric.
- `outputStreak`: consecutive valid output-note calendar-date titles ending at `localDate`. Suspension does not remove an existing output artifact from the streak.
- `plannerProgress`: canonical task-node completion for the lexicographically smallest valid enrolled planner matching `isoWeek`. Suspension does not erase planner content.

The dashboard reuses `isDue`, `createJapaneseTemplate`, `validateStudyReview`, and `parseDocument`; it does not duplicate their validation or parsing rules.

## Needs repair

Repair entries are stable, sorted, aggregated by code and optional `noteId`, and capped at `STUDY_DASHBOARD_REPAIR_LIMIT` (`20`). `needsRepairOmitted` reports the number of distinct entries beyond the bound.

Current repair codes are:

- `archived-note`
- `duplicate-current-planner`
- `duplicate-note`
- `duplicate-output-date`
- `duplicate-review`
- `invalid-note`
- `invalid-output-title`
- `invalid-planner-title`
- `invalid-review`
- `orphan-review`

Diagnostics never mutate or automatically repair caller data. They do not insert tags, enroll notes, delete orphan records, or rewrite stored content.

## Complexity and retained state

For `n` notes and `r` reviews, derivation is `O(n log n + r log r)` in the worst case because duplicate groups and deterministic output are sorted. All maps, sets, and arrays are call-local and released after the result is produced. No cache, listener, timer, retry loop, or background task is retained.

## Compatibility and rollback

The change is additive. Existing notes and study-review records keep their stored shape. Rollback is a code-only revert of the parser task branch, dashboard module, tests, and this document; no schema downgrade, record rewrite, or cleanup is required.
