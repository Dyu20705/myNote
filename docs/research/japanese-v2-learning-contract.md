# Japanese V2 Learning Contract and Scheduler Boundary

This contract defines the canonical learning model, skill semantics, Card generation rules, review behavior, workload constraints, source boundaries, scheduler interface, migration expectations, and durability requirements for Japanese V2.

The contract is derived from the V1 audit and exists to prevent future implementation decisions from silently reintroducing whole-Note scheduling.

## 1. Canonical Domain Model

### 1.1 Note
A Note is an authoring and narrative entity.
A Note:
* provides provenance and contextual material;
* may produce zero or more LearningItems;
* does not own scheduler state;
* does not have an SRS interval;
* does not have a review grade.

### 1.2 KanjiInkEntry
A KanjiInkEntry is a handwriting/authoring artifact.
It:
* may provide handwriting evidence;
* may be referenced by a LearningItem;
* is not itself a review unit;
* does not own scheduler state;
* is not automatically enrolled in SRS.

### 1.3 LearningItem
A LearningItem represents canonical knowledge to be learned.
It owns:
* typed learning content;
* allowed skill mappings;
* source/provenance references;
* lifecycle metadata.
It does not own review timing.

### 1.4 Card
A Card is the smallest independently schedulable learning unit.
A Card belongs to exactly one:
`LearningItem + Skill`
and has at most one corresponding scheduler state.
The identity invariant is:
`(itemId, skill) → at most one active Card`

### 1.5 ReviewState
ReviewState is mutable current scheduler state associated with one Card.

### 1.6 ReviewLog
ReviewLog is append-only historical evidence of a review event.
A review must produce one durable ReviewLog entry and one resulting ReviewState transition atomically.

## 2. Content Quality and Japanese-Primary Context

### 2.1 Context-first
LearningItems should prioritize meaningful Japanese context:
* sentences;
* collocations;
* discourse;
* scenes;
* usage constraints;
* contrasts;
* source provenance.
Isolated translation strings must not become the universal semantic representation of Japanese knowledge.

### 2.2 Meaning representation
Canonical understanding should be anchored in Japanese-first evidence when practical:
* Japanese definitions;
* contextual examples;
* synonyms;
* antonyms/contrasts;
* usage restrictions;
* source notes.
A native-language support field may exist, but it must be typed as support/hint content, not treated as the canonical definition.

### 2.3 Graduated support
For beginner stages such as N5/N4, temporary native-language approximations may be presented as hints.
They must have explicit lifecycle semantics:
`available → reduced → obscured → disabled`
Their visibility must not silently change the underlying LearningItem semantics.
This prevents “temporary translation support” from becoming a permanent dependency.

## 3. Skill Taxonomy

V2 defines the following skills:
`recognition, reading-in-context, meaning, form-recall, constrained-production, free-production, transfer`

### Definitions
**Recognition**
Identify or discriminate a known form.

**Reading-in-context**
Produce or select the appropriate pronunciation/reading for a form in contextual use.

**Meaning**
Demonstrate conceptual understanding without requiring direct translation.

**Form-recall**
Produce the target form from memory, including handwriting when applicable.

**Constrained-production**
Produce a target form/grammar item under explicit constraints.

**Free-production**
Generate novel target-language output.

**Transfer**
Apply previously learned knowledge in a materially different context.

## 4. Skill Mapping and Anti-Explosion Rule
A LearningItem must not automatically create every possible skill Card.
The mapping is explicit and item-type-aware:
`LearningItem type + skill mapping policy ↓ Card Compiler`
Example:
* Kanji → recognition → meaning → optional form-recall
* Grammar → recognition → constrained-production → optional transfer
* Vocabulary → recognition → reading-in-context → meaning

The exact mapping is a domain policy, not a property inferred from available fields.

### 4.1 What “anti-explosion” actually means
The problem is not simply:
`7 skills = 7 cards`
Seven cards are still bounded.
The real risk is the combinatorial generation of:
`item × skill × prompt format × answer format × context × difficulty × direction`
Therefore V2 explicitly prohibits automatic materialization of arbitrary permutations.
One skill maps to at most one canonical Card unless a separate product decision explicitly introduces a second Card identity.

## 5. Card Rendering and Content Versioning
Cards reference LearningItems rather than storing duplicate canonical text.
However, this does not mean historical review surfaces may change silently.
Therefore the system must maintain a content/version identity.
Recommended invariant:
`LearningItem └── contentVersion`
A review log should record which content version was presented when meaningful for analysis/reproducibility.
This addresses an important problem in the earlier contract:
“edits propagate instantly to the flashcard surface”
That is desirable for active content correction, but without versioning it becomes impossible to know what the learner actually reviewed historically.
Therefore:
`current rendering ≠ historical review evidence`
must be explicitly separated.

## 6. Review Semantics
The scheduler operates only on Cards.
A review flow is:
`select Card ↓ render skill-specific prompt ↓ capture response ↓ reveal / verify ↓ user rating ↓ Scheduler ↓ ReviewState transition ↓ append ReviewLog`
A Note is never submitted directly to the scheduler.

## 7. Review Surface Invariants
The review surface must reveal only information appropriate to the target skill before the learner commits a response.
Examples:
**Reading Card**
Prompt: Japanese sentence with target word
Expected response: reading
The meaning should not be unnecessarily exposed beforehand.

**Meaning Card**
Prompt: Japanese word/context
Expected: conceptual understanding

**Form Recall Card**
Prompt: meaning/context/audio
Expected: target Japanese form
Potentially verified by `#69` handwriting input.

## 8. Workload Rules
The workload engine must be bounded and deterministic under a defined policy.
Priority Default ordering:
1. Learning/Relearning
2. Overdue Review
3. Due Review
4. New Cards up to the configured daily limit

This ordering is a product policy and must be configurable without changing the persistence model.

## 9. Session Determinism
A session must resolve a concrete review queue at session start or through another explicitly defined deterministic batching mechanism.
The session must not silently reshuffle already-selected cards merely because another review was completed.
Required session metadata:
`sessionId, createdAt, queue policy, selected Card IDs`
This enables interruption-safe resume behavior.

## 10. Sibling Burying
Cards produced from the same LearningItem are siblings.
Default policy:
`review sibling A ↓ siblings B/C/... are buried ↓ not presented again during the same session`
The default burial target is the next eligible review period/day according to workload policy.
Important distinction:
`buried ≠ suspended`
Buried is temporary queue suppression.
Suspended is an explicit scheduler lifecycle state.

## 11. Leech Protection
A Card becomes a leech after exceeding a configurable lapse threshold.
Example:
`lapses >= threshold ↓ auto-suspend ↓ Leech Resolution UI`
Resolution should require remediation of the underlying learning material where appropriate:
* improve context;
* add mnemonic;
* simplify the item;
* correct ambiguous content;
* split overloaded knowledge.
Un-suspension must be explicit.

## 12. Fuzzing and Determinism
Scheduling fuzzing is compatible with deterministic workload only if randomness is reproducible.
Therefore:
`schedule randomness + stable seed = deterministic schedule`
Recommended seed inputs include:
`cardId, schedulerVersion, review event identity`
The system must never use unseeded ambient randomness if deterministic migration, replay, testing, or export/import reproducibility is required.
This is a crucial correction to the original contract.
FSRS implementations expose fuzzing/jitter as a scheduling option, so the contract should define reproducibility rather than merely saying “random variance.”

## 13. Scheduler Boundary
The learning domain must not depend on FSRS implementation details.
Conceptually:
`ReviewInput ↓ Scheduler interface ↓ ScheduleResult ├── next ReviewState └── ReviewLog`
The persistence layer stores the result.
The scheduler itself should remain a pure or near-pure computation boundary.

## 14. FSRS Boundary
FSRS may be used as the scheduling implementation, but V2 must not make the rest of the application directly depend on an FSRS-specific API.
The system must retain:
`domain model ≠ scheduler implementation`
FSRS-specific state may live inside the scheduler-related representation.
Current FSRS implementations expose concepts including:
difficulty; stability; due; elapsed days; scheduled days; reps; lapses; state; last review; learning/relearning progression.
Therefore the V2 schema must preserve enough information to integrate FSRS without falsely declaring all such fields universally meaningful to every future scheduler.

## 15. Review History and FSRS Migration
This section requires the strongest correction from the original contract.

### Exact-history migration
If V1 provides sufficiently reliable:
* Card/Note identity;
* timestamps;
* grades;
* interval data;
* chronological ordering;

then the migration layer may normalize this history into V2 ReviewLogs and use the resulting history as scheduler/optimizer input where supported.
FSRS's optimizer explicitly works from review-history records, including card identity, review time, rating, and state.

### Heuristic migration
If V1 only provides aggregate state such as:
`reps, interval, ease, lastDue`
without reliable per-review chronology/ratings, then exact historical reconstruction is impossible.
The system must instead:
`preserve raw V1 data ↓ mark migration as heuristic ↓ construct safe initial state`
It must not claim that the original ReviewLog history was reconstructed.
Example quality classification:
`exact, partial, heuristic, unmigratable`

## 16. Migration Safety
Migration must be:
* idempotent;
* interruption-safe;
* resumable;
* non-destructive;
* versioned.

Recommended:
`Migration ↓ read checkpoint ↓ process bounded batch ↓ commit ↓ checkpoint`
If interrupted:
`restart ↓ resume from checkpoint`
This is stronger than simply saying “interruption-safe”.

## 17. Source References
A LearningItem may reference:
`Note, KanjiInkEntry, other provenance source`
These are source references, not scheduler dependencies.
Therefore:
`source deleted ↓ LearningItem remains valid`
unless the product explicitly defines the source as required canonical content.

## 18. Dangling References
A dangling SourceRef is valid and serializable.
Example:
`LearningItem └── SourceRef(note: 123) X deleted`
The system must render:
`source unavailable`
rather than:
`learning item invalid`

## 19. Data Durability
IndexedDB is the runtime source of truth, but it must not be the only durable copy.
V2 must provide at least one of:
* robust export/import
* or: sync-backed durable storage
before the system is considered production-safe for long-term review history.

Preferred baseline:
`IndexedDB + versioned JSON export`
SQLite export may be added when there is a concrete interoperability requirement.
This avoids committing prematurely to two export formats.

## 20. Review Transaction Invariant
A successfully submitted review must atomically produce:
`one ReviewLog + one resulting ReviewState`
Conceptually:
`read state ↓ calculate ↓ write ReviewLog ↓ write ReviewState ↓ commit`
Partial success must be impossible or recoverable through an explicit transaction/reconciliation mechanism.

## 21. Historical Integrity
ReviewLog is append-only under normal operation.
Historical records must not be rewritten merely because:
* LearningItem content was corrected;
* Note content changed;
* a source was deleted;
* scheduler implementation was upgraded.
Scheduler migrations must create explicit migration metadata rather than silently rewriting history.

## 22. Scheduler Versioning
Every scheduler-generated state/log must identify:
`schedulerId, schedulerVersion`
This permits:
`FSRS vX → FSRS vY`
without making old review history semantically ambiguous.
A future scheduler migration should explicitly declare whether it:
* replays history
* or: initializes from existing state

## 23. Formal Domain Invariants
These should be implementation-testable invariants.

**Identity**
`(itemId, skill) → ≤ 1 canonical Card`

**Referential integrity**
`Card.itemId → LearningItem.id`
`ReviewState.cardId → Card.id`
`ReviewLog.cardId → Card.id`

**Separation**
`Note ≠ LearningItem`
`LearningItem ≠ Card`
`Card ≠ ReviewState`
`ReviewState ≠ ReviewLog`

**History**
`ReviewLog = append-only`

**Scheduling**
`only active Cards may enter review queues`

**Source independence**
`Source deletion must not automatically delete learning state`

**Transaction**
`successful review → exactly one historical review event → exactly one resulting scheduler state`

**Content**
`Card contains identity + skill`
`LearningItem contains canonical learning content`

## 24. Non-Goals
V2 contract does not guarantee that the first implementation will support:
* all seven skills;
* free production assessment;
* transfer assessment;
* handwriting recognition automation;
* cloud synchronization;
* automatic FSRS parameter optimization;
* every possible learning-item type.
A skill may exist in the taxonomy without immediately having an implemented Card renderer.
This prevents the contract from becoming a disguised feature roadmap.

## 25. Acceptance Criteria for V2 Core
V2 Core is architecturally complete when:
* no Note has scheduler state;
* no InkEntry has scheduler state;
* Cards have independent identities;
* Card skill is explicit;
* ReviewState is per Card;
* ReviewLog is append-only;
* Card generation is idempotent;
* removed mappings do not destroy review history;
* dangling source references are safe;
* a review update is transactionally durable;
* V1 migration distinguishes exact from heuristic history;
* scheduler implementation is replaceable behind an adapter;
* workload selection has deterministic semantics;
* scheduling fuzzing is reproducible;
* content versioning is sufficient to identify historically reviewed material.

## 26. Recommended Architecture
```text
                    AUTHORING
                        │
          ┌─────────────┴─────────────┐
          │                           │
         Note                    KanjiInkEntry
          │                           │
          └─────────────┬─────────────┘
                    SourceRef
                        │
                        ▼
                  LearningItem
                        │
                        │ Skill Policy
                        ▼
                  Card Compiler
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
          Card                 Card lifecycle
            │                       │
            ▼                       ▼
       ReviewState          Scheduler Adapter
            │                       │
            ▼                       ▼
      ReviewResult ├───────┐    ReviewLog
                           ▼
                      ReviewState
```
