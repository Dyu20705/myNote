# Japanese V1 Audit

## 1. Executive Decisions
### Retain
Retain `kanjiInkView.js` and the `#69 KanjiInkEntry` lifecycle boundary.
`KanjiInkEntry` remains an independent authoring/artifact entity and must not become a scheduler entity merely because it contains handwriting data.
Preserve the existing loose coupling between Ink entries and Notes: deleting an Ink entry must not implicitly delete or mutate Note learning state.

### Replace
Replace `core/studyScheduler.js` whole-Note scheduling with Card-level scheduling.
Replace `core/studyReview.js` whole-Note review state with independent state per atomic review Card.
Replace the implicit 1:1 relationship between Note and studyReviews.

### Deprecate
Deprecate Markdown as the canonical representation of structured learning facts.
Markdown remains a narrative/authoring/provenance representation but must no longer be the source of truth for scheduler state or skill identity.
Existing templates in `japaneseTemplates.js` should be treated as migration-compatible authoring formats rather than the canonical learning schema.

### Optimize
Optimize `japaneseApp.js` state projection and review updates.
Avoid rebuilding all derived queues and dashboard projections after every localized review mutation.
Treat this as a measured performance optimization rather than changing persistence semantics prematurely.

## 2. Audit Scope and Evidence
### Audited commit
Commit: 78c09bc9a54ecceb6fb59408c38c5e8d4707c44c Date: 2026-08-16

### Environment
Node.js 20.x npm 10.x Ubuntu Chromium / Playwright sandbox

### Verification commands
`npm ci` `npx --no-install playwright install --with-deps chromium` `npm run test:content` `npm run lint` `npm run test:unit` `npm run test:integration` `npm run test:e2e` `git diff --check`

### Evidence rule
Each architectural finding should be classified as one of:
* **Observed** — directly verified from source/runtime/tests.
* **Inferred** — derived from observed architecture but not directly measured.
* **Unknown** — requires additional validation.

This prevents performance and memory claims from being presented as established facts when only architectural inspection has been performed.

## 3. Architecture and Ownership Map

| Layer | Current V1 owner | Responsibility | V2 disposition |
|-------|------------------|----------------|----------------|
| UI | `japaneseApp.js` | Workspace composition and review interaction | Retain; reduce broad state recomputation |
| UI filtering | `ui/japanese-filters.js` | Notebook/filter presentation | Retain |
| Actions | `core/japaneseActions.js` | UI → domain/state commands | Retain; migrate commands from Note identity to Item/Card identity |
| Derived state | `core/japaneseState.js` | Due queues and dashboard projections | Retain concept; change data source |
| Scheduler | `core/studyScheduler.js` | Whole-Note scheduling | Replace |
| Review flow | `core/studyReview.js` | Whole-Note review semantics | Replace |
| Templates | `core/japaneseTemplates.js` | Markdown authoring | Deprecate as canonical learning structure |
| Persistence | `core/storage.js` | IndexedDB Notes + studyReviews | Extend with V2 learning stores |
| Ink | `kanjiInkView.js` / `#69` | Handwriting authoring/artifact lifecycle | Retain boundary |

### Key architectural observation
V1 has effectively:
`Note ↕ studyReview ↕ whole-document scheduler`

V2 must become:
`Note / KanjiInkEntry ↓ provenance/source ↓ LearningItem ↓ Card ↓ ReviewState ↓ Scheduler ↓ ReviewLog`

## 4. User-Journey Audit
### Dashboard and creation
**Current:**
`Quick Create ↓ Markdown Note ↓ studyScheduler creates Note review`

**V2 target:**
`Quick Create / extraction ↓ LearningItem ↓ Card Compiler ↓ Card + initial ReviewState`
A Note may produce zero, one, or many LearningItems.
A Note is therefore no longer a scheduling identity.

### Review
**Current:**
`Review ↓ Note ↓ reveal full Markdown ↓ rating`
**Problem:**
The user receives multiple forms of information simultaneously. This makes the rating ambiguous because the user may remember one component while using another component as a hint.

**V2 target:**
`Card ↓ skill-specific prompt ↓ user response ↓ reveal / verification ↓ rating`
The review surface must be generated from the Card's skill, not from the entire Note.

### Filtering
Notebook filtering can remain a UI concern, but the resulting queue must be generated from:
`Card → LearningItem → sourceRefs`
rather than directly treating Note membership as review identity.

## 5. Learning-Model Findings
### 5.1 Whole-Note scheduling is the primary architectural defect
V1 stores one scheduling state for heterogeneous information:
Meaning, Reading, Context, Form
This makes the unit of scheduling larger than the unit of learning evidence.
Example:
Reading = forgotten, Meaning = known, Context = known
V1 cannot represent this independently.
The fundamental V2 correction is:
`one knowledge item × one targeted skill = one atomic Card`

### 5.2 Skill conflation
Current V1 behavior:
* recognition is conflated with meaning;
* reading is not independently schedulable;
* contextual reading is not distinguished from isolated reading;
* handwriting is not part of scheduler state;
* constrained production is unsupported;
* free production is unsupported;
* transfer is unsupported.
These are not merely missing UI features. They represent a mismatch between learning evidence and scheduler identity.

### 5.3 Whole-document reveal is a correctness problem
The current review dialog exposes the entire Markdown document before rating.
This means that a card asking for:
`reading`
may unintentionally expose:
`meaning, context, example sentence, other readings`
Therefore the V2 review surface must be skill-specific.

### 5.4 #69 Ink integration
Current status:
* handwriting authoring exists;
* Ink entries are independent;
* Ink deletion is isolated from Note review state;
* Ink entries do not automatically enroll into SRS;
* export support exists.
This boundary should be retained.

The V2 architecture should therefore treat Ink as:
`learning evidence / authoring artifact`
rather than:
`scheduler entity`
A LearningItem may reference an Ink entry for provenance or verification, but Card lifecycle must not depend on Ink persistence.

## 6. Japanese-Primary Content Audit
### Current deficiencies
Structured template headings are largely English.
UI copy contains English strings.
Review content does not consistently declare Japanese language metadata.
Markdown headings currently carry semantic structure that should eventually move into typed fields.

### V2 requirement
Canonical structured content should use semantic fields rather than headings such as:
`## Reading ## Meaning ## Example`
The renderer may still generate these sections, but the schema—not the heading text—defines their meaning.
The review surface should expose Japanese content as the primary learning signal.
Native-language hints may exist only as explicitly classified support material, not as required canonical meaning fields.

## 7. Kanji Boundary Audit

| Capability | V1 status | V2 target |
|------------|-----------|-----------|
| Target character | Supported | `KanjiContent.character` |
| Primary reading | Partial | Typed content |
| Contextual reading | Partial | Explicit contextual evidence |
| Source sentence | Weak | Explicit source/provenance reference |
| Japanese explanation | Unsupported | Typed understanding/context fields |
| Recognition | Partial | Independent Card |
| Handwriting | Authoring only | Optional Card backed by `#69` verification |
| Usage evidence | Unsupported | Context-bearing LearningItem |
| Ink relation | Supported | Preserve |
| Ink deletion isolation | Supported | Preserve |
| Automatic enrollment | Correctly absent | Preserve |
| Export | Supported | Extend structurally |

### Important invariant
Deleting a KanjiInkEntry must not invalidate:
`LearningItem, Card, ReviewState, ReviewLog`
The source relationship may become dangling, but the learning entity remains valid.

## 8. Correctness Findings
### Observed
Archived Notes are excluded from the due queue.
Missing Note references are classified as orphaned review records rather than crashing the queue.
Ink deletion is isolated from Note/scheduler state.

### Requires stronger V2 guarantees
The V2 system must explicitly guarantee:
`missing source ≠ missing learning item`
and:
`archived source ≠ automatically suspended learning item`
These are separate lifecycle decisions.

### Time semantics
The existing `nowIso` approach provides stable lexical timestamp ordering under normalized UTC ISO timestamps.
However, the V2 contract should define:
* all scheduler timestamps = UTC
* all date arithmetic = scheduler-defined temporal calculation
* UI-local timezone = presentation only
This avoids allowing local calendar semantics to silently alter scheduler behavior.

## 9. Accessibility / UX Findings
### Verified strengths
Numeric rating shortcuts are available.
Review focus management is structured.
Closing the dialog returns focus to the opener.

### Known issue candidates
Missing live announcement of review position/progression.
200% zoom clipping remains unverified.
Japanese-font-specific layout behavior remains unverified.

### V2 requirements
The review interface should expose:
`Card skill, Current position, Remaining workload, State transition, Feedback after rating`
through semantic UI mechanisms rather than visual cues only.

## 10. Performance Findings
### Observed architecture
`analyzeRecords` and related state derivation process the complete Note/review collections for queue/dashboard calculations.

### Complexity
The current queue construction is plausibly:
`O(N log N)`
because of global grouping/sorting.
However:
Frame-drop impact has not been measured.
Therefore the correct classification is:
**P2 — scalability risk, not proven production bottleneck.**

### V2 direction
First introduce indexed entity-oriented queries:
`ReviewState.due, ReviewState.state, Card.status, Card.itemId`
Then benchmark.
Do not prescribe a particular incremental-cache strategy before measurements establish its value.

## 11. Persistence / Migration Findings
### Current
`Note, studyReview (1:1)`

### V2 target
`LearningItem, Card, ReviewState, ReviewLog`

### Migration risk
A single V1 review state cannot be losslessly split into multiple skill-specific histories.
Therefore V1 migration must classify records as:
* exact-history migration
or:
* heuristic-state initialization
The latter must not be presented as reconstructed historical review data.

## 12. Priority Findings
**P0** Whole-Note scheduling is incompatible with V2 skill separation.
**P0** Migration cannot infer independent historical Card performance from aggregate Note-level state without evidence.
**P1** Review content must become skill-specific to avoid accidental hints.
**P1** V2 needs explicit Card/Item identity and lifecycle invariants.
**P2** Global queue derivation creates a scaling risk.
**P2** Handwriting assessment is not yet integrated into review semantics.

## 13. UNKNOWN — REQUIRES VALIDATION
* Long-session `ResizeObserver` memory behavior in `kanjiInkView.js`.
* 200% zoom clipping with Japanese fonts.
* Actual dashboard frame-time distribution at realistic dataset sizes.
* IndexedDB query performance at target learning-item/card volumes.
* Exact recoverability of V1 review history into FSRS-compatible records.
These should remain explicitly unknown until measured.

## 14. V2 Work Package Recommendation
### Work Package 2 — Canonical Learning Data Model
Define and implement:
`LearningItem, Card, ReviewState, ReviewLog, SourceRef, Skill`
with explicit lifecycle, identity, referential-integrity, and migration invariants.
Maintain the `#69 KanjiInkEntry` boundary.
The output of WP2 should be a stable domain contract that the scheduler, review UI, migration layer, and export layer can consume without depending on Markdown structure.

## 15. Deferred / Separate Work Packages
The following should not be bundled into WP2:
* large-scale performance optimization;
* FSRS parameter optimization;
* handwriting assessment algorithm;
* cloud sync;
* full localization;
* dashboard redesign.
This keeps the schema milestone architecturally focused.
