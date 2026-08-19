# ADR: Japanese V2 Core Learning Architecture and Schema

## 1. Context

The V1 Japanese learning implementation conflated narrative authoring (Markdown notes) with spaced repetition. This violated explicit skill separation (grouping recognition, reading, and meaning into a single pass) and caused significant UX friction.

Based on the Japanese V2 Learning Contract (`docs/research/japanese-v2-learning-contract.md`), the architecture must support atomic review units, targeted skill mapping to prevent card explosion, bounded workload determinism, and interruption-safe V1 migration.

## 2. Decision

We will implement a canonical schema decoupling learning facts from Markdown representation. The local IndexedDB will remain the source of truth, heavily partitioned into targeted stores to optimize scheduler queries.

### 2.1 Identity and Structure

The data model introduces four core entities:

1. **`LearningItem`**: The source of knowledge.
   - `id`: UUID.
   - `type`: `vocabulary` | `kanji` | `grammar`.
   - `content`: Targeted payload (e.g., character, reading, definitions, context sentences).
   - `sourceIds`: Optional array of UUIDs linking back to narrative `Note`s or `#69 KanjiInkEntry` records.
   - `cardMapping`: Explicit enumeration of the skills targeted (e.g., `["recognition", "meaning"]`).

2. **`Card`**: The atomic review unit.
   - `id`: UUID.
   - `itemId`: Foreign key to `LearningItem`.
   - `skill`: The targeted skill (e.g., `recognition`).
   - `suspended`: Boolean indicating if the card is a leech or manually suspended.
   - *Note: Cards do not store duplicated text. They dynamically render content from their parent `LearningItem`.*

3. **`ReviewState`**: The current scheduler standing for a specific Card.
   - `cardId`: UUID.
   - `state`: `new` | `learning` | `review` | `relearning`.
   - `due`: Timestamp.
   - `difficulty`, `stability`, `reps`, `lapses`: Scheduler metrics (aligned for FSRS compatibility).

4. **`ReviewLog`**: Immutable historical ledger of review actions.
   - `id`: UUID.
   - `cardId`: UUID.
   - `grade`: `again` | `hard` | `good` | `easy`.
   - `timestamp`: UTC Timestamp.
   - `durationMs`: Review duration.
   - `interval`: Days elapsed since previous review.

### 2.2 Card Compiler

To prevent card explosion, cards are not generated eagerly for every permutation. A **Card Compiler** factory service listens to `LearningItem` creation/updates. It reads the `cardMapping` configuration and generates exactly the bounded `Card` records requested. If a mapping is removed, the compiler suspends (but does not delete) the orphaned card to preserve history.

### 2.3 Scheduler Adapter Boundary

The core system interacts with the scheduler via an abstract adapter interface, passing `ReviewState` and `ReviewLog` entities. This ensures the engine remains ignorant of the underlying math, supporting a future seamless swap to an embedded FSRS library without rewriting schema.

### 2.4 Data Lifecycle

- **Creation**: Items are created independently or extracted from Notes.
- **Migration**: V1 SM2-like history is migrated by transforming legacy note-embedded review data into immutable `ReviewLog` entries. If V1 logs lack precise granularity, a deterministic fallback assigns baseline stabilities based on total reps.
- **Export**: Full JSON/SQLite schema export is required to mitigate IndexedDB volatility. Dangling `sourceIds` (where a linked note was deleted) are serialized gracefully without aborting the export.
- **Deletion**: Deleting a `LearningItem` cascades suspension (not hard deletion) to its `Card`s to preserve `ReviewLog` integrity for FSRS global optimization.

## 3. Consequences

- **Positive**: Strict adherence to skill separation; clean isolation of authoring vs. learning; robust foundation for FSRS.
- **Negative**: Increased schema complexity; requires robust UI state management to join `LearningItem`, `Card`, and `ReviewState` during daily review sessions.
