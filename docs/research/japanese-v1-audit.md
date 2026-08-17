# Japanese V1 Audit

## 1. Executive Decisions

- **Retain**: `kanjiInkView.js` and `#69` boundary separation. The independent Ink entry lifecycle decoupled from note review scheduling is highly robust and must be preserved.
- **Optimize**: `japaneseApp.js` state updates. Current updates rebuild entire state projections and queues on every review action.
- **Replace**: `core/studyScheduler.js` and `core/studyReview.js` whole-note scheduling. The V1 model schedules the entire Note (document) rather than atomic facts or discrete skills. This must be replaced with item/card-level identity.
- **Deprecate**: Free-form Markdown as the primary learning structure. The current templates (`japaneseTemplates.js`) use markdown headers to separate data, which is brittle for structured retrieval and independent skill assessment.

## 2. Audited Commit and Environment

- **Commit**: `78c09bc9a54ecceb6fb59408c38c5e8d4707c44c`
- **Date**: 2026-08-16
- **Environment**: Node.js 20.x, npm 10.x, Ubuntu Chromium Playwright Sandbox
- **Commands**:
  ```sh
  npm ci
  npx --no-install playwright install --with-deps chromium
  npm run test:content
  npm run lint
  npm run test:unit
  npm run test:integration
  npm run test:e2e
  git diff --check
  ```

## 3. Architecture and Ownership Map

- **UI**: `japaneseApp.js` is the main composition root for the Japanese workspace. It delegates to `ui/japanese-filters.js`.
- **Actions**: `core/japaneseActions.js` mediates between the UI and state, generating command stack actions and history records.
- **State**: `core/japaneseState.js` calculates derived queues (`buildDueReviewQueue`) and dashboard statistics.
- **Core**: `core/studyScheduler.js` executes the spaced repetition algorithm (rating → interval/ease). `core/japaneseTemplates.js` defines Note structure.
- **Persistence**: `core/storage.js` persists Notes and `studyReviews` records to IndexedDB. `studyReviews` are stored separately from Notes but are strictly 1:1.

## 4. User-Journey Matrix

1. **Dashboard & Creation**: User switches to the Japanese workspace. `japaneseApp.js` renders due counts. User clicks Quick Create. `japaneseTemplates.js` generates a new note, and `studyScheduler.js` creates an initial review record.
2. **Review**: User clicks "Start review". `reviewDialog` opens. The note title and content are displayed. User clicks "Reveal", then selects a rating.
3. **Filtering**: User interacts with `ui/japanese-filters.js` to view specific notebook types.

## 5. Learning-Model Findings

- **Consequences of V1 model**:
  - One review record per complete note: All fields (Meaning, Reading, Context) share a single interval/ease.
  - One interval/ease/status for all facts/skills: If a user knows the meaning but forgets the reading, they must rate the entire note 'again', penalizing the known skill.
  - Shared review shape: Vocabulary, Kanji, Grammar, Output, and Planner all use the exact same scheduler logic.
  - Whole-note reveal: The entire Markdown content is revealed simultaneously, providing unwanted hints for free-production.
  - No card identity, review logs, lapses, or response time tracking: The system cannot build a detailed learning profile.
- **Independent skills audit**:
  - `recognition`: Conflated with meaning.
  - `reading in context`: Conflated with isolated reading.
  - `meaning/understanding`: Mixed with form recall.
  - `form recall/handwriting`: Currently manual/unverified. The #69 Ink View provides the drawing canvas, but the review dialog does not present a drawing prompt before revealing the answer.
  - `constrained production`: Unsupported.
  - `free production`: Unsupported.
  - `transfer`: Unsupported.

## 6. Japanese-Primary Content Inventory

- **English template headings**: Headings in templates are almost entirely English (`## Reading`, `## Meaning`, `## Example`, `## Stroke order`), except Kanji title `新しい漢字` and Output title `今日の文`. (Replace/Localize)
- **Dashboard & copy**: Hardcoded English ("Start review", "Resume review", "Search Japanese notes"). (Localize)
- **Language attributes**: Missing explicit `lang="ja"` on note contents within the review modal. (Replace)

## 7. Kanji Boundary Audit

- **target character**: Supported via Note Title.
- **primary word and contextual reading**: Partially supported (Text-only in Markdown template).
- **source sentence/provenance**: Unsupported natively (relegated to `## Common compounds`).
- **Japanese-primary explanation**: Unsupported.
- **recognition vs handwriting vs usage evidence**: Unsupported. The review system has no awareness of the #69 ink entry.
- **optional relation to #69 entry**: Supported (Kanji Ink region automatically links to Active Note ID).
- **behavior when related entry deleted**: Supported. Deleting ink entry shows a local undo prompt; it does not affect the Note or Review state.
- **no automatic enrollment from entry**: Supported. Ink entries do not create review scheduler items.
- **search/export compatibility**: Supported. Ink view provides `export.kanji-json` and `export.kanji-markdown`.

## 8. Correctness and Failure Findings

- **Archived Notes**: `buildDueReviewQueue` correctly filters out archived notes.
- **Missing/Orphaned Notes**: Handled safely. If a review has no matching Note, it's categorized as `orphan-review` and skipped.
- **Timezone/Day boundaries**: Managed via `nowIso` string comparison, ensuring stable intervals regardless of local time changes.

## 9. Accessibility/UX Findings

- **Keyboard-only**: The review flow supports numeric shortcuts (`1`, `2`, `3`, `4`) for rating, bound cleanly in `japaneseApp.js`. Focus is managed well within the `reviewDialog`.
- **Focus return**: Closing the dialog correctly returns focus to the `reviewOpener` button.
- **Zoom/Narrow**: The review dialog handles overflow, but the hardcoded padding might clip at 200% zoom. (`UNKNOWN — REQUIRES VALIDATION`).
- **Live announcements**: The review dialog lacks dynamic `aria-live` announcements for progression (e.g., "Item 2 of 5").

## 10. Performance and Resource Baseline

- **Queue Construction**: `analyzeRecords` groups and sorts all notes and reviews. This is `O(N log N)` on total dataset size. For a large vocabulary list, this synchronous block could cause frame drops.
- **Dashboard Derivation**: `deriveStudyDashboard` processes all notes/reviews on every action.
- **Memory**: The entire notes array and reviews array are kept in memory and cloned frequently during state updates.

## 11. Persistence, Migration, and Export

- **Notes**: Retain.
- **`studyReviews` fields**: Deprecate whole-note reviews. Replace with granular Item/Card reviews.
  - *Migration risk*: Mapping 1 note review to N card reviews requires heuristics.
- **Output/Planner records**: Deprecate spaced repetition for planners.
- **Export**: Currently raw Markdown and JSON. Future requires loss-aware structural export.

## 12. P0–P3 Findings

- **P1**: Learning model conflates recognition and recall, severely limiting spaced repetition effectiveness.
- **P2**: Queue derivation runs synchronously over the entire dataset, creating a scaling bottleneck.
- **P2**: Review dialog provides no mechanism for handwriting or independent skill verification before revealing the answer.

## 13. UNKNOWN — REQUIRES VALIDATION

- Exact memory leak footprint of `ResizeObserver` in `kanjiInkView.js` over long sessions.
- Review dialog visual layout clipping on strict 200% zoom with Japanese fonts.

## 14. Exact Recommendation for Japanese V2 Work Package 2

**Work Package 2**: Design the V2 Canonical Data Schema.
Create the schema definitions for `Item`, `Card`, and `ReviewLog` entities that decouple atomic facts from the Markdown Note representation, while maintaining the #69 Ink integration boundary.

## 15. Bounded Follow-up Proposals

- Separate the `studyScheduler.js` interval logic to operate on a `Card` ID rather than a `Note` ID.
- Add `lang="ja"` attributes to the review dialog's content container.
- Optimize `buildDueReviewQueue` to use incremental updates or IndexedDB indexes instead of full-array sorting.
