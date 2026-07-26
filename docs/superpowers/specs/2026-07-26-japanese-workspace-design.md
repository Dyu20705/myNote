# Japanese Learning Workspace — Design Specification

Date: 2026-07-26
Status: Approved design direction; implementation not started
Target repository: `Dyu20705/myNote`
Target branch: `agent/japanese-workspace-design`

## 1. Objective

Extend `myNote` with a Japanese-learning workspace while preserving every existing note and the current generic note workflow.

The feature adds:

- A Japanese Workspace in the existing UI.
- Five Japanese-learning note templates.
- A separate `studyReviews` IndexedDB object store.
- A dashboard for vocabulary, kanji, grammar, output practice, weekly planning, and due reviews.
- A deterministic spaced-repetition review flow with `Again`, `Hard`, `Good`, and `Easy` ratings.

Japanese entries remain ordinary Markdown notes in the existing `notes` store. Study scheduling is stored separately and linked only by `noteId`.

## 2. Non-negotiable data-safety contract

The implementation MUST satisfy all of the following:

1. The existing `notes` object store keeps the same name and key path.
2. Existing note records are not rewritten during database upgrade or application bootstrap.
3. Existing note content, title, tags, timestamps, version, checksum, blocks, links, or AST are not automatically modified for this feature.
4. Existing notes are not automatically classified as Japanese notes, even if their text happens to contain a reserved Japanese tag.
5. No `studyReviews` record is created retroactively for an existing note.
6. Only notes created through a Japanese template action receive a corresponding review record.
7. The default workspace remains the current generic Notes workspace.
8. Export of the existing notes collection remains compatible with the current Markdown and JSON commands.
9. Removing or disabling the Japanese Workspace must leave all ordinary note data readable by the previous generic note flow.

The database upgrade is additive-only: version 2 creates `studyReviews` and indexes without reading, updating, or copying records in `notes`.

## 3. Scope

### 3.1 Included in MVP

- Workspace switcher: `Notes` and `日本語`.
- Japanese dashboard.
- Quick-create actions for all five notebook types.
- Reserved tags for classifying newly created Japanese notes.
- Review queue and review session.
- Deterministic scheduling logic.
- Atomic persistence for Japanese note creation and deletion metadata.
- Undo/redo consistency for Japanese note create and delete operations.
- IndexedDB version upgrade from 1 to 2.
- Core, parser, storage, and UI tests required by repository invariants.
- Documentation updates.

### 3.2 Explicitly excluded

- Cloud synchronization.
- Accounts or remote backup.
- AI-generated definitions, example sentences, corrections, or translations.
- Automatic furigana generation.
- Automatic stroke-order lookup or image download.
- Audio recording or speech recognition.
- Import from Anki or other SRS products.
- Automatic conversion of existing notes.
- Full SM-2 compatibility or migration from another scheduler.
- Separate rich-text editors for vocabulary, kanji, or grammar.

## 4. Existing architecture constraints

The feature must preserve the repository dependency direction:

```text
UI -> Actions -> State -> Core services -> Persistence
```

Consequences:

- UI modules emit events and render data; they do not call IndexedDB.
- Scheduling calculations live in a pure core module.
- Japanese template construction lives in a pure core module.
- IndexedDB access remains within the persistence boundary.
- Searchable metadata still comes through the canonical parser pipeline.
- Review updates use explicit action paths and immutable state transitions.
- Search and backlinks remain incremental.

No new runtime dependency is required.

## 5. Japanese note classification

The current parser accepts letters, digits, underscores, and hyphens in tags. It does not accept slash-separated tags. Therefore this feature uses hyphenated reserved tags:

| Notebook type | Required reserved tag |
|---|---|
| Vocabulary | `#jp-vocabulary` |
| Kanji | `#jp-kanji` |
| Grammar | `#jp-grammar` |
| Output | `#jp-output` |
| Planner | `#jp-planner` |

Optional tags use the same parser-compatible format:

- JLPT level: `#jlpt-n5`, `#jlpt-n4`, ..., `#jlpt-n1`
- Topic: `#topic-family`, `#topic-travel`, `#topic-work`
- Lesson: `#lesson-01`

A note is considered part of the Japanese Workspace only when both conditions hold:

1. It has a `studyReviews` record.
2. Its note content contains the reserved tag corresponding to `notebookType`.

The review record is the ownership marker. A pre-existing note containing `#jp-vocabulary` is not automatically enrolled because it has no review record.

If a user manually removes the reserved tag from an enrolled note, the review record is retained but the note is shown as `Needs repair` in the Japanese Workspace. The system does not silently reinsert the tag.

## 6. IndexedDB design

### 6.1 Database upgrade

- Database name remains `myNoteDB`.
- Database version changes from `1` to `2`.
- Existing `notes` store remains unchanged.
- Upgrade code uses existence checks before creating stores.

Upgrade behavior:

```text
oldVersion < 1:
  create notes store and existing indexes

oldVersion < 2:
  create studyReviews store and indexes
```

The `oldVersion < 2` block MUST NOT enumerate, read, normalize, update, or copy existing notes.

### 6.2 `studyReviews` record

```js
{
  noteId: string,
  notebookType: "vocabulary" | "kanji" | "grammar" | "output" | "planner",
  status: "new" | "learning" | "review" | "suspended",
  lastReviewedAt: string | null,
  nextReviewAt: string,
  interval: number,
  ease: number
}
```

Constraints:

- Key path: `noteId`.
- `noteId` must identify an existing note when the record is created.
- `interval` is a non-negative integer number of days.
- `ease` is bounded to `[1.3, 3.0]`.
- `nextReviewAt` and non-null `lastReviewedAt` are ISO-8601 timestamps.
- Initial values:
  - `status = "new"`
  - `lastReviewedAt = null`
  - `nextReviewAt = creation timestamp`
  - `interval = 0`
  - `ease = 2.5`

Indexes:

- `nextReviewAt`
- `notebookType`
- `status`

A compound index is unnecessary for MVP because the expected local dataset is small and the dashboard can filter the bounded result set in memory.

### 6.3 Atomicity and orphan handling

Japanese note creation persists the note and its review record in one IndexedDB transaction spanning `notes` and `studyReviews`.

Japanese note deletion removes the note and its review record in one transaction. Before deletion, the action captures the review record so undo can restore both records.

Generic note deletion checks for a matching review record. If one exists, it follows the Japanese atomic delete path. This prevents orphan records regardless of which UI surface initiated deletion.

At bootstrap, orphan review records are ignored by the dashboard and review queue. The app does not delete them automatically. A future maintenance command may provide explicit cleanup, but automatic cleanup is outside MVP because it would be destructive.

## 7. Core modules

### 7.1 `core/japaneseTemplates.js`

Responsibilities:

- Define the five notebook types.
- Generate deterministic title/content/tag seeds.
- Return ordinary note seeds consumable by `createEmptyNote`.
- Never access DOM, state, time, or IndexedDB directly.

Suggested API:

```js
export const JAPANESE_NOTEBOOK_TYPES = Object.freeze([...]);
export function createJapaneseTemplate(type, options = {}) { ... }
export function reservedTagFor(type) { ... }
```

### 7.2 `core/studyScheduler.js`

Responsibilities:

- Validate review records.
- Create initial review records.
- Calculate the next record from a rating.
- Determine whether a record is due.
- Remain deterministic for a supplied timestamp.

Suggested API:

```js
export function createInitialReview({ noteId, notebookType, nowIso }) { ... }
export function rateReview(review, rating, nowIso) { ... }
export function isDue(review, nowIso) { ... }
```

### 7.3 `core/studyDashboard.js`

Responsibilities:

- Join notes and review records in memory.
- Produce dashboard metrics without mutating inputs.
- Ignore archived notes and orphan review records.
- Identify `Needs repair` records where the expected reserved tag is absent.
- Compute output streak from enrolled, non-archived output notes.
- Compute weekly planner progress from parser AST task nodes.

Suggested API:

```js
export function buildJapaneseDashboard({ notes, reviews, now }) { ... }
```

### 7.4 Persistence boundary

The persistence layer adds functions equivalent to:

```js
listStudyReviewsFromDb(db)
getStudyReviewFromDb(db, noteId)
putStudyReviewToDb(db, review)
putJapaneseNoteWithReviewToDb(db, note, review)
deleteNoteWithReviewFromDb(db, noteId)
restoreNoteWithReviewToDb(db, note, review)
```

Single-record review rating updates use a `studyReviews` transaction. Creation, deletion, undo, and redo operations that affect both entities use a transaction spanning both stores.

## 8. Template definitions

Templates are intentionally Markdown-native. Empty prompts remain visible so the user can fill them without learning a form system.

### 8.1 Vocabulary

Default title: `New vocabulary`

```markdown
## Reading

## Meaning

## Example

## Collocations
-

## Related words
- Synonym:
- Antonym:

## Context
- JLPT:
- Topic:
- Lesson:

#jp-vocabulary
```

### 8.2 Kanji

Default title: `新しい漢字`

```markdown
## Character

## Readings
- On:
- Kun:
- Hán Việt:

## Meaning

## Stroke order
- Reference:

## Common compounds
1.
2.
3.

## Notes

#jp-kanji
```

The product stores a stroke-order reference only. It does not fetch or embed third-party stroke-order media in MVP.

### 8.3 Grammar

Default title: `New grammar pattern`

```markdown
## Pattern

## Structure

## Meaning and usage

## Examples
1.
2.

## Similar or confusing patterns
- Similar:
- Difference:

## Notes

#jp-grammar
```

### 8.4 Output journal

Default title: local calendar date in `YYYY-MM-DD` format.

```markdown
## 今日の文
1.
2.
3.

## Corrections
-

## Rewritten version

## Error ledger
-

#jp-output
```

Creating output again on the same local date opens the existing enrolled output note for that date instead of creating a duplicate.

### 8.5 Study planner

Default title: `Japanese study plan — YYYY-Www`, using the local ISO week.

```markdown
## Weekly goals
- [ ] Vocabulary:
- [ ] Kanji:
- [ ] Grammar:
- [ ] Reading or listening:
- [ ] Output practice:

## Review plan
- [ ]

## End-of-week reflection
- Completed:
- Missed:
- Adjustment:

#jp-planner
```

Creating a planner again in the same local ISO week opens the existing enrolled planner note instead of creating a duplicate.

## 9. Parser extension for planner tasks

To support weekly target progress without duplicate regex logic in UI or dashboard orchestration, the canonical Markdown parser recognizes task list lines:

```markdown
- [ ] pending task
- [x] completed task
- [X] completed task
```

AST representation:

```js
{
  type: "task",
  checked: boolean,
  text: string
}
```

This parser extension is generic and safe. It does not rewrite any stored note. Existing notes are not persisted during bootstrap. New or explicitly edited notes may produce task nodes through the normal parser pipeline.

## 10. Scheduling algorithm

The scheduler is deterministic and inspired by SM-2, but intentionally smaller and explicitly specified.

Ratings: `again`, `hard`, `good`, `easy`.

All calculations use a supplied `nowIso`. Day intervals add calendar-duration multiples of 24 hours to that instant for MVP.

### 10.1 Again

```text
status = learning
interval = 0
nextReviewAt = now + 10 minutes
ease = max(1.3, ease - 0.20)
```

### 10.2 Hard

```text
status = learning when previous interval is 0; otherwise review
interval = max(1, ceil(max(previous interval, 1) * 1.20))
nextReviewAt = now + interval days
ease = max(1.3, ease - 0.15)
```

### 10.3 Good

```text
status = review
if previous interval == 0: interval = 1
else if previous interval == 1: interval = 3
else: interval = max(previous interval + 1, round(previous interval * ease))
nextReviewAt = now + interval days
ease unchanged
```

### 10.4 Easy

```text
status = review
if previous interval == 0: interval = 4
else: interval = max(previous interval + 1, round(previous interval * ease * 1.30))
nextReviewAt = now + interval days
ease = min(3.0, ease + 0.15)
```

For every rating:

```text
lastReviewedAt = now
```

Suspended records are excluded from due counts and cannot be rated until resumed.

## 11. UI design

### 11.1 Workspace switcher

Add two top-level controls:

- `Notes`
- `日本語`

Behavior:

- The application opens in `Notes` mode.
- Switching workspaces does not alter the selected note or persist a preference in MVP.
- `Notes` mode preserves the current list, editor, search, keyboard shortcuts, command palette, backlinks, exports, and metrics behavior.
- `日本語` mode reuses the existing note list and editor but filters the list to enrolled Japanese notes.

### 11.2 Japanese dashboard

The dashboard appears above the reused workspace only in `日本語` mode.

Cards:

1. **Due today**
   - Count of non-suspended review records with `nextReviewAt <= now` whose notes exist and are not archived.
   - Primary action: `Start review`.

2. **New vocabulary**
   - Count of enrolled vocabulary records with `status = new`.
   - Primary action: create vocabulary note.

3. **Kanji to practise**
   - Count of due kanji records.
   - Primary action: filter Japanese list to kanji.

4. **Grammar patterns**
   - Total enrolled, non-archived grammar notes.
   - Primary action: create grammar note.

5. **Output streak**
   - Consecutive local calendar days ending today or yesterday with at least one enrolled, non-archived output note created on each day.
   - Primary action: open today’s output note.

6. **Weekly targets**
   - Completed task count and total task count from the enrolled planner note for the current local ISO week.
   - Primary action: open current weekly planner.

A visible `Needs repair` warning lists enrolled records whose note is missing the expected reserved tag. Repair is manual; the UI opens the note and explains the expected tag.

### 11.3 Quick create

Provide five quick-create buttons in Japanese Workspace and matching command-palette commands:

- New vocabulary
- New kanji
- New grammar pattern
- Today’s output
- This week’s plan

### 11.4 Review session

A review session uses a snapshot of due `noteId` values sorted by:

1. `nextReviewAt` ascending.
2. `notebookType` in order: vocabulary, kanji, grammar, output, planner.
3. `noteId` ascending as deterministic tie-breaker.

Session layout:

- Notebook type label.
- Note title as the prompt.
- Content hidden initially.
- `Show answer` reveals the existing Markdown content in a safe text rendering surface.
- Rating buttons appear after reveal: `Again`, `Hard`, `Good`, `Easy`.
- Rating persists the updated review record, updates dashboard state, and advances to the next item.
- Closing the session keeps completed ratings and leaves remaining items due.
- If the underlying note is missing or archived, skip it and show a non-blocking status message.

The review session does not edit note content.

## 12. State design

Add state fields without mutating note objects:

```js
{
  workspace: "notes" | "japanese",
  studyReviews: [],
  japaneseFilter: "all" | "vocabulary" | "kanji" | "grammar" | "output" | "planner",
  reviewSession: {
    active: boolean,
    queue: string[],
    index: number,
    revealed: boolean
  },
  japaneseDashboard: { ...derivedSnapshot }
}
```

`japaneseDashboard` is derived from `notes`, `studyReviews`, and a supplied current time. Review records are immutable application-state values; updates replace records rather than mutating them.

## 13. Action and data flows

### 13.1 Bootstrap

```text
open database v2
-> migrate legacy localStorage exactly as current behavior
-> list existing notes
-> list studyReviews
-> normalize notes in memory using existing behavior
-> rebuild search and backlinks
-> derive Japanese dashboard
-> render default Notes workspace
```

Bootstrap does not create review records.

### 13.2 Create Japanese note

```text
UI template command
-> create template seed
-> create ordinary normalized note
-> create initial review record
-> atomic IndexedDB transaction writes note + review
-> incremental search upsert
-> incremental backlinks upsert
-> update state
-> record history only after persistence/index success
-> open note in Japanese Workspace
```

If the IndexedDB transaction fails, neither record is committed and state remains unchanged.

### 13.3 Edit Japanese note

Editing uses the existing generic note edit flow. Review metadata is not changed by content edits.

If the reserved tag is removed, dashboard derivation marks the item `Needs repair`; it does not mutate content.

### 13.4 Rate review

```text
UI rating
-> scheduler calculates next immutable review record
-> persist studyReviews update
-> replace record in state
-> derive dashboard
-> advance session
```

A rating failure leaves the current card in place and displays `Review save failed`; it does not advance.

### 13.5 Delete and undo

```text
delete action
-> read matching review record
-> atomic delete note + review when review exists
-> incremental search/backlinks remove
-> update state
-> history record after success
```

Undo restores the exact captured note and review record atomically, then restores search and backlinks incrementally.

## 14. Error handling

- Database upgrade failure uses the current safe-mode recovery path.
- Study store read failure does not silently reset data; Japanese Workspace is disabled for the session and generic Notes remains usable when possible.
- Transaction failures are surfaced in the existing save-state area and Japanese Workspace status area.
- Invalid review records are excluded from scheduling and shown as data errors; they are not automatically rewritten.
- Unknown notebook types are rejected at the core boundary.
- Unknown rating values are rejected without persistence.
- Dashboard derivation tolerates missing notes and duplicate input records deterministically.
- No raw note HTML is rendered in the review session.

## 15. Accessibility and keyboard behavior

- Workspace controls use buttons with active state exposed through `aria-pressed` or tab semantics.
- Dashboard cards retain visible text labels; color is not the only status indicator.
- Review session is keyboard accessible:
  - `Space` or `Enter`: show answer.
  - `1`: Again.
  - `2`: Hard.
  - `3`: Good.
  - `4`: Easy.
  - `Escape`: close session.
- Rating shortcuts are active only while the review dialog owns focus.
- Existing global shortcuts retain their current behavior outside the review session.

## 16. Performance constraints

- No full search-index rebuild during template creation, editing, rating, or deletion.
- Rating a review does not reparse the note.
- Dashboard derivation is linear in the number of loaded notes and reviews and runs only after relevant state changes, not on editor keypress.
- Review queue is bounded by the number of due records at session start.
- No unbounded cache is introduced.

## 17. Test strategy

### 17.1 Database migration safety

- Create a version-1 database containing representative note records.
- Snapshot records before upgrade.
- Open with version 2.
- Assert deep equality of every `notes` record before and after upgrade.
- Assert `studyReviews` exists.
- Assert no review records were auto-created.

### 17.2 Template tests

For each notebook type:

- Output is deterministic for supplied date/week inputs.
- Exactly one correct reserved tag is present.
- Output is an ordinary note seed.
- Unsupported types throw a deterministic error.
- Daily output and weekly planner duplicate-prevention lookups only consider enrolled notes.

### 17.3 Scheduler tests

- Initial record values are exact.
- Each rating produces the specified interval, status, timestamp, and ease adjustment.
- Ease lower and upper bounds hold.
- `Good` and `Easy` intervals always increase after established review intervals.
- Suspended records are not due.
- Equal inputs produce deep-equal outputs.
- Input records are not mutated.

### 17.4 Parser tests

- Task list parsing is deterministic.
- `[ ]`, `[x]`, and `[X]` states are recognized.
- Malformed task syntax remains a paragraph.
- Existing tag, wiki-link, code-block, and patch invariant tests continue to pass.

### 17.5 Dashboard tests

- Due count excludes future, suspended, archived, orphaned, and invalid records.
- New vocabulary count uses both enrollment record and notebook type.
- Kanji due count is correct.
- Grammar total ignores archived notes.
- Output streak handles today, yesterday, gaps, duplicates, and local date boundaries.
- Weekly task progress reads only the current enrolled planner AST.
- Missing expected tag produces `Needs repair` without content mutation.

### 17.6 Persistence and history tests

- Japanese creation commits both records or neither.
- Delete removes both records or neither.
- Undo restores exact note and exact review record.
- Redo removes both again without drift.
- Generic note create/edit/delete behavior remains unchanged.
- Search and backlinks remain equivalent to their existing incremental baseline.

### 17.7 UI acceptance tests

- App boots into Notes workspace.
- Existing notes remain visible and editable in Notes workspace.
- Existing notes do not appear in Japanese Workspace without enrollment records.
- Every template creates the expected Markdown note and review record.
- Dashboard cards navigate to the correct action or filter.
- Review content is hidden before reveal.
- Rating updates the due count and advances the queue.
- Closing and reopening review preserves already saved ratings.
- No unsafe HTML execution path is introduced.

## 18. Definition of Done

The feature is complete only when:

1. Version-1 migration safety test proves existing note records remain deep-equal after upgrade.
2. No bootstrap path creates review metadata for existing notes.
3. All five template actions work through UI and command palette.
4. Japanese Workspace dashboard displays all six required metrics.
5. Review session supports `Again`, `Hard`, `Good`, and `Easy` with the specified deterministic algorithm.
6. Japanese create/delete/undo/redo keep `notes`, `studyReviews`, search, backlinks, state, and history consistent.
7. Existing generic note behavior and exports remain functional.
8. Parser, scheduler, dashboard, storage, and invariant tests pass.
9. Architecture and data-safety documentation are updated.
10. Manual verification confirms that opening an existing user database does not modify or enroll old notes.

## 19. Recommended implementation decomposition

Implementation should be split into reviewable vertical steps:

1. IndexedDB v2 migration and isolated study persistence with migration safety tests.
2. Pure templates and scheduler modules with unit tests.
3. Parser task-node support and dashboard derivation with tests.
4. State/actions for Japanese create, delete, undo, rating, and bootstrap loading.
5. Workspace switcher, dashboard, quick create, and review session UI.
6. Integration verification, documentation, and regression checks.

Each step must preserve a runnable generic Notes application. No step may depend on converting existing note records.