# ADR: Japanese V2 Core Learning Architecture and Schema

**Status:** Proposed
**Date:** 2026-08-20
**Author:** Antigravity

## 1. Context

The V1 Japanese learning implementation conflated narrative authoring (Markdown notes) with spaced repetition. This violated explicit skill separation (grouping recognition, reading, and meaning into a single pass) and caused significant UX friction.

Based on the Japanese V2 Learning Contract (`docs/research/japanese-v2-learning-contract.md`), the architecture must support atomic review units, targeted skill mapping to prevent card explosion, bounded workload determinism, and interruption-safe V1 migration.

## 2. Decision

We will implement a canonical schema decoupling learning facts from Markdown representation. The local IndexedDB will remain the source of truth, heavily partitioned into targeted stores to optimize scheduler queries.

### 2.1 Identity and Structure

The data model introduces three core entities (consolidating Card and ReviewState to optimize IndexedDB cursor queries):

1. **`LearningItem`**: The source of knowledge.
   - `id`: UUID.
   - `type`: `vocabulary` | `kanji` | `grammar`.
   - `content`: Targeted payload (e.g., character, reading, definitions, context sentences).
   - `sourceIds`: Optional array of UUIDs linking back to narrative `Note`s or `#69 KanjiInkEntry` records.
   - `cardMapping`: Explicit enumeration of the skills targeted (e.g., `["recognition", "meaning"]`).

2. **`Card`**: The atomic review unit containing its embedded scheduler state.
   - `id`: UUID.
   - `itemId`: Foreign key to `LearningItem`.
   - `skill`: The targeted skill (e.g., `recognition`).
   - `suspended`: Boolean indicating if the card is a leech or manually suspended.
   - `state`: `new` | `learning` | `review` | `relearning`.
   - `due`: Timestamp (Indexed for fast `due <= NOW` fetching).
   - `difficulty`, `stability`, `reps`, `lapses`: Scheduler metrics (aligned for FSRS compatibility).
   - *Note: Cards do not store duplicated text. They dynamically render content from their parent `LearningItem`.*

3. **`ReviewLog`**: Immutable historical ledger of review actions, carrying transition deltas for FSRS.
   - `id`: UUID.
   - `cardId`: UUID.
   - `grade`: `again` | `hard` | `good` | `easy`.
   - `timestamp`: UTC Timestamp.
   - `durationMs`: Review duration.
   - `interval`: Days elapsed since previous review.
   - `lastState`: The state of the card before this review.
   - `lastDifficulty`, `lastStability`: The scheduler metrics before this review.

### 2.2 Card Compiler

To prevent card explosion, cards are not generated eagerly for every permutation. A **Card Compiler** factory service listens to `LearningItem` creation/updates.
- **Additions**: It reads the `cardMapping` configuration and generates exactly the bounded `Card` records requested. If a user adds a new skill mapping later, a new Card is created.
- **Removals**: If a mapping is removed, the compiler suspends (but does not delete) the orphaned card to preserve history.
- **Updates in Active Queue**: If a `LearningItem`'s content is updated while its `Card`s are in the active review queue, the UI is notified to re-render the dynamic reference safely without invalidating the scheduling transaction.

### 2.3 Scheduler Adapter Boundary

The core system interacts with the scheduler via an abstract adapter interface, passing `Card` and `ReviewLog` entities. This ensures the engine remains ignorant of the underlying math, supporting a future seamless swap to an embedded FSRS library without rewriting schema.

### 2.4 Data Lifecycle

- **Creation**: Items are created independently or extracted from Notes.
- **Migration**: V1 SM2-like history is migrated by transforming legacy note-embedded review data into immutable `ReviewLog` entries. If V1 logs lack precise granularity, a deterministic fallback assigns baseline stabilities based on total reps.
- **Export**: Full JSON/SQLite schema export is required to mitigate IndexedDB volatility. Dangling `sourceIds` (where a linked note was deleted) are serialized gracefully without aborting the export.
- **Deletion (Soft vs. Hard Purge)**: Deleting a `LearningItem` cascades suspension (soft deletion) to its `Card`s to preserve `ReviewLog` integrity for FSRS global optimization. To prevent infinite storage bloat in IndexedDB, a **Hard Purge** background task runs periodically to permanently delete suspended cards and logs either after an FSRS optimization run has consumed them, or after a specific retention threshold (e.g., 1 year).

## 3. Alternatives Considered

- **Embedded SQLite via WASM**: Considered instead of IndexedDB for native SQL joins (which would have allowed keeping `Card` and `ReviewState` as separate tables). Rejected due to bundle size constraints, WASM initialization overhead, and complexity of integration with the existing persistence layer. The workaround (embedding state directly into `Card`) achieves the required O(1) fetch performance natively in IndexedDB.
- **Strict 1:1 Separation of Card and ReviewState**: Considered separating them for purity, but rejected because querying due cards would result in an N+1 query pattern in IndexedDB, causing severe UI latency.

## 4. Consequences

- **Positive**: Strict adherence to skill separation; clean isolation of authoring vs. learning; robust foundation for FSRS (transition deltas, immutability); ultra-fast IndexedDB queries via embedded Card states.
- **Negative**: Increased schema complexity; requires robust UI state management to join `LearningItem` and `Card` during daily review sessions; requires a background garbage collection (Hard Purge) worker.
