# ADR: Japanese V2 Core Learning Architecture and Schema

## 1. Context
The V1 Japanese learning implementation coupled narrative authoring with spaced repetition state. Review behavior was derived directly from Markdown notes, which made skill separation difficult and caused recognition, reading, and meaning to be reviewed as a single unit.

The Japanese V2 Learning Contract requires:
* atomic review units;
* explicit skill separation;
* bounded card generation;
* deterministic daily workload;
* interruption-safe V1 migration;
* preservation of historical review data;
* scheduler independence from authoring and presentation;
* a persistence model capable of supporting FSRS or another scheduler in the future.

Therefore, V2 will establish a canonical learning domain model independent of Markdown representation and independent of any specific scheduling algorithm.

---
## 2. Decision
IndexedDB remains the **local source of truth** for learning data.
Markdown `Note`s remain an authoring/narrative representation and are treated as source material rather than scheduler state.

The canonical model consists of:
1. `LearningItem`
2. `Card`
3. `ReviewState`
4. `ReviewLog`
5. `SourceRef`

The scheduler operates only on `Card` + `ReviewState` + review input/output and does not depend on Markdown or UI models.

---
## 2.1 LearningItem
`LearningItem` represents a canonical unit of knowledge.

```ts
type LearningItemType =
  | "vocabulary"
  | "kanji"
  | "grammar";

interface LearningItem {
  id: UUID;
  type: LearningItemType;
  content: LearningItemContent;
  skills: Skill[];
  sourceRefs: SourceRef[];
  status: "active" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
`content` is type-specific and must not become an unbounded generic object.

Example:
```ts
interface VocabularyContent {
  writtenForm: string;
  reading?: string;
  meanings: string[];
  contexts?: string[];
}

interface KanjiContent {
  character: string;
  meanings: string[];
  readings?: string[];
  onyomi?: string[];
  kunyomi?: string[];
}

interface GrammarContent {
  pattern: string;
  meaning: string[];
  contexts: string[];
}
```

### Rationale
`LearningItem` answers:
> “What knowledge is being learned?”

It does **not** answer:
> “How and when should this knowledge be reviewed?”

That distinction is fundamental.

---
## 2.2 Skill
Skills must be a closed domain concept rather than arbitrary strings.

```ts
type Skill =
  | "recognition"
  | "reading"
  | "meaning";
```
Additional skills may be introduced later, but they must be explicitly added to the domain contract.

Examples:
* Vocabulary → `recognition`, `reading`, `meaning`
* Kanji → `recognition`, `reading`, `meaning`
* Grammar → `recognition`, `meaning`

The exact mapping is determined by the V2 Learning Contract rather than inferred dynamically from UI state.

### Important invariant
A single `Card` represents **exactly one skill for exactly one `LearningItem`**.

Therefore:
```text
LearningItem × Skill → 0..1 Card
```
not:
```text
LearningItem × arbitrary question permutation → N Cards
```
This prevents combinatorial card explosion.

---
# 2.3 SourceRef
`sourceIds: UUID[]` should be replaced with typed references.

```ts
interface SourceRef {
  type: "note" | "kanji-ink-entry";
  id: UUID;
}
```
This avoids an ambiguous foreign-key array.

Example:
```json
{
  "sourceRefs": [
    {
      "type": "note",
      "id": "..."
    },
    {
      "type": "kanji-ink-entry",
      "id": "..."
    }
  ]
}
```
A broken source reference is valid domain state and must not invalidate the learning item.

---
# 2.4 Card
`Card` is the atomic scheduling entity.

```ts
interface Card {
  id: UUID;
  itemId: UUID;
  skill: Skill;
  status:
    | "active"
    | "suspended"
    | "orphaned"
    | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
A `Card` does not duplicate learning content.
It resolves presentation through:
```text
Card
  → LearningItem
      → skill-specific content
```

### Card invariants
1. `itemId` must refer to an existing `LearningItem`.
2. `(itemId, skill)` is unique.
3. An `orphaned` card is retained for historical integrity.
4. An inactive card must not enter the review queue.
5. A card may exist without a current source Note.

---
# 2.5 ReviewState
`ReviewState` contains the **current mutable scheduler state**.

```ts
interface ReviewState {
  cardId: UUID;
  state:
    | "new"
    | "learning"
    | "review"
    | "relearning";
  due: Timestamp;
  reps: number;
  lapses: number;
  elapsedDays: number;
  scheduledDays: number;
  difficulty?: number;
  stability?: number;
  lastReviewAt?: Timestamp;
  step?: number;
  scheduler:
    | "fsrs"
    | "legacy-sm2"
    | "manual";
  schedulerVersion: string;
  updatedAt: Timestamp;
}
```

### Why this is better
The original ADR called this generic:
> “Scheduler standing”

but immediately embedded FSRS concepts.
That creates a false abstraction.

Instead, the schema should distinguish:
* **generic lifecycle fields**;
* **scheduler state fields**;
* **scheduler identity/version**.

FSRS implementations currently expose state such as `due`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `state`, and `last_review`; some implementations also maintain learning/relearning steps. 

The critical addition is:
```ts
schedulerVersion
```
because historical state is meaningless unless we know **which scheduler semantics produced it**.

---
# 2.6 ReviewLog
`ReviewLog` must be an immutable event, not merely an interval record.

```ts
interface ReviewLog {
  id: UUID;
  cardId: UUID;
  grade:
    | "again"
    | "hard"
    | "good"
    | "easy";
  reviewedAt: Timestamp;
  durationMs?: number;
  stateBefore:
    | "new"
    | "learning"
    | "review"
    | "relearning";
  stateAfter:
    | "new"
    | "learning"
    | "review"
    | "relearning";
  elapsedDays: number;
  scheduledDays: number;
  scheduler: string;
  schedulerVersion: string;
  previousStateSnapshot?: SchedulerStateSnapshot;
  nextStateSnapshot?: SchedulerStateSnapshot;
  source:
    | "user"
    | "migration"
    | "import"
    | "system";
}
```

Where:
```ts
interface SchedulerStateSnapshot {
  difficulty?: number;
  stability?: number;
  due?: Timestamp;
  reps?: number;
  lapses?: number;
  state?: string;
  lastReviewAt?: Timestamp;
}
```

### Why snapshots matter
The log should allow:
```text
ReviewLog[]
      ↓
Replay
      ↓
Reconstructed scheduler state
```
rather than:
```text
ReviewLog[]
      ↓
approximate current state
```
This matters because current FSRS implementations explicitly support replay/rescheduling from review history.

---
# 2.7 Card Compiler
The Card Compiler is responsible for materializing the bounded set of cards implied by the skill mapping.

```text
LearningItem
      ↓
Skill Mapping
      ↓
Card Compiler
      ↓
0..N Cards
```

The compiler is **idempotent**.
For a given `(itemId, skill)`:
```text
same input → same Card identity
```
It must not generate duplicate cards on repeated compilation.

### Compiler rules
| Mapping change                     | Action                                          |
| ---------------------------------- | ----------------------------------------------- |
| skill added                        | create Card + initial ReviewState               |
| skill unchanged                    | preserve existing Card + ReviewState            |
| skill removed                      | mark Card `orphaned`                            |
| item archived                      | archive all active Cards                        |
| item deleted from canonical domain | prohibit hard deletion if historical logs exist |

### Critical correction
The original ADR says:
> “If a mapping is removed, the compiler suspends ... the orphaned card”

`orphaned` and `suspended` should be different.
* **Suspended** = user/system intentionally pauses an active card.
* **Orphaned** = card no longer has an active mapping.
* **Archived** = parent learning object intentionally retired.

That distinction becomes important for analytics and migration.

---
# 2.8 Scheduler Adapter
The application must depend on a scheduler interface, not on FSRS.

```ts
interface Scheduler {
  schedule(
    state: ReviewState | null,
    input: ReviewInput,
    now: Timestamp
  ): ScheduleResult;
}
```

```ts
interface ReviewInput {
  grade: "again" | "hard" | "good" | "easy";
  reviewedAt: Timestamp;
  durationMs?: number;
}
```

```ts
interface ScheduleResult {
  nextState: ReviewState;
  log: ReviewLog;
}
```

The scheduler is therefore:
```text
Review UI
    ↓
ReviewInput
    ↓
Scheduler Adapter
    ↓
ScheduleResult
    ↓
IndexedDB transaction
    ├── ReviewState
    └── ReviewLog
```

The scheduler must not directly mutate IndexedDB.
This keeps scheduling deterministic and testable.

---
# 2.9 Persistence Strategy
IndexedDB should be organized around **query patterns**, not by entity count alone.

Recommended stores:
```text
learningItems
cards
reviewStates
reviewLogs
```

Recommended indexes:
```text
cards:
  itemId
  itemId + skill
  status

reviewStates:
  due
  cardId
  state

reviewLogs:
  cardId + reviewedAt
  reviewedAt
```

The most important scheduler query is:
```text
active ReviewState
WHERE due <= now
ORDER BY due
LIMIT workload
```
Therefore `due` must be a first-class indexed access path.
Do not create separate stores merely because an entity “looks important”. The storage design should follow actual read/write patterns.

---
# 2.10 Workload Determinism
Daily review workload must be bounded independently from storage size.

The scheduler query must support:
```ts
getDueCards({
  now,
  limit,
  skills?,
  types?
})
```

The system must never interpret:
```text
number of cards in IndexedDB
```
as:
```text
today's workload
```

A review session therefore has:
```text
workload policy
+
due queue
+
session snapshot
```
The session should operate on a deterministic queue snapshot so that interruption does not silently change the selected workload.

---
# 2.11 Transaction Boundary
A successful review is an atomic persistence operation.

```text
BEGIN TRANSACTION
1. Read ReviewState
2. Scheduler computes next state
3. Append ReviewLog
4. Replace ReviewState
COMMIT
```

The system must never allow:
```text
ReviewLog written
+
ReviewState not updated
```
or:
```text
ReviewState updated
+
ReviewLog missing
```
unless recovery logic explicitly handles the transaction failure.
This is particularly important for interruption-safe UX.

---
# 2.12 Migration
V1 migration must be **lossless where evidence exists** and **explicitly heuristic where evidence does not exist**.

### Rule 1 — Preserve original data
Raw V1 data must never be destroyed during migration.

### Rule 2 — Replay when sufficient history exists
If V1 contains enough temporal review information:
```text
V1 review history
      ↓
normalized ReviewLog
      ↓
scheduler replay
      ↓
current ReviewState
```

### Rule 3 — Heuristic migration only when necessary
If V1 contains only aggregated counters such as:
```text
reps = 37
```
but no timestamps/grades, the system cannot reconstruct actual FSRS history.
It may create a baseline state, but it must mark the migration as heuristic:
```ts
source: "migration"
migrationQuality: "heuristic"
```

Do **not** describe this as migrated FSRS history.
It is an estimated starting state.
This distinction is important for future optimizer usage.

---
# 2.13 Deletion and Retention
Hard deletion of historical scheduling entities is prohibited once a `ReviewLog` exists.

Lifecycle should instead be:
```text
LearningItem
    ↓
archived
    ↓
Cards archived/orphaned
    ↓
ReviewLogs retained
```

This preserves the historical dataset required for analytics and future scheduler optimization.
If physical deletion is ever required for privacy/data-reset purposes, it must be an explicit destructive operation separate from normal domain deletion.

---
# 2.14 Export and Recovery
The application must support deterministic export of:
```text
LearningItems
Cards
ReviewStates
ReviewLogs
SourceRefs
schemaVersion
migrationVersion
```

Example:
```json
{
  "schemaVersion": 2,
  "migrationVersion": 3,
  "exportedAt": "...",
  "learningItems": [],
  "cards": [],
  "reviewStates": [],
  "reviewLogs": []
}
```

Dangling `SourceRef`s are preserved rather than causing export failure.
Import must validate:
1. schema version;
2. entity IDs;
3. card/item relationships;
4. `(itemId, skill)` uniqueness;
5. review-state/card consistency;
6. review-log/card references.

---
# 2.15 Core Invariants
These should be treated as architectural invariants, not implementation details.

### Identity
```text
(itemId, skill) → at most one Card
```

### Referential integrity
```text
Card.itemId → LearningItem.id
ReviewState.cardId → Card.id
ReviewLog.cardId → Card.id
```

### History preservation
```text
ReviewLog is append-only
```

### Scheduler consistency
```text
Card ∉ active mapping
→ Card.status = orphaned
→ Card cannot enter review queue
```

### Atomic review
```text
one successful review
→ exactly one ReviewLog
→ exactly one resulting ReviewState update
```

### Content separation
```text
Card contains no canonical learning content
```

### Scheduler independence
```text
Learning domain ≠ scheduler implementation
```

---
# 3. Consequences
## Positive
* Narrative authoring and spaced repetition become independent domains.
* Recognition, reading, and meaning can be reviewed independently.
* Card count is explicitly bounded.
* Scheduler state can evolve without rewriting learning content.
* Review history becomes suitable for replay and future optimization.
* V1 migration can distinguish exact migration from heuristic reconstruction.
* Interrupted reviews can be recovered transactionally.
* FSRS can be introduced without making the entire schema FSRS-specific.

## Negative
* The schema is more complex than the V1 note-embedded model.
* Daily review requires joins between `Card`, `LearningItem`, and `ReviewState`.
* Migration becomes a first-class subsystem rather than a simple data transform.
* Historical event storage grows indefinitely unless retention/export policies are eventually introduced.
* Scheduler versioning introduces additional compatibility requirements.

---
# 4. Architectural boundary
The most important V2 boundary should be:

```text
                    AUTHORING DOMAIN
                         │
                         ▼
                    LearningItem
                         │
                         │ skill mapping
                         ▼
                  ┌───────────────┐
                  │ Card Compiler │
                  └───────┬───────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
            Card                 ReviewState
              │                       │
              └───────────┬───────────┘
                          ▼
                    Scheduler Adapter
                          │
                          ▼
                     ReviewLog
```

And **Markdown must terminate at `LearningItem`**.
It should never become a dependency of:
```text
Card
ReviewState
Scheduler
ReviewLog
```
