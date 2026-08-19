# Japanese V2 Learning Contract and Scheduler Boundary

This document defines the learning model, skill separation, review semantics, workload rules, and scheduler boundaries for Japanese V2, based on the V1 audit (#64) and the Japanese V2 Roadmap (#63).

## 1. Content Quality and Japanese-Primary Context

- **Context-first invariants**: Learning items must prioritize context (sentences, collocations, scenes) over isolated translations.
- **No generic translations**: Canonical learning content must not rely on required Vietnamese translation fields, Sino-Vietnamese approximations, or generic translated `Meaning` fields as permanent anchors.
- **Graduated context for beginners**: To prevent extreme friction for N5/N4 learners, the system permits a "graduated context" where native-language approximations are allowed as temporary hints. These hints must automatically fade out, become obscured, or get explicitly suspended as the user progresses in mastery.
- **Understanding anchors**: Meaning should be anchored via Japanese definitions, contextual examples, synonyms, contrasts, and explicit source provenance.

## 2. Skill Separation

V2 enforces independent tracking and assessment of distinct learning skills. Success in one skill does not imply success in another.

- **recognition**: Identifying the form (e.g., seeing a Kanji and recognizing it).
- **reading in context**: Producing the correct phonetic reading (furigana/kana) for a character/word within a specific sentence.
- **meaning/understanding**: Comprehending the concept without necessarily producing translation.
- **form recall/handwriting**: Producing the physical strokes from memory (verified via #69 Kanji Ink).
- **constrained production**: Producing a specific word or grammar point given a structured constraint (e.g., fill-in-the-blank, cloze).
- **free production**: Generating novel output.
- **transfer**: Applying the knowledge in untrained contexts.

**Mapping Strategy (Anti-Explosion)**: A single `LearningItem` must not automatically generate all 7 possible cards. The system requires an explicit mapping strategy based on item type. For example, a complex Kanji might only generate `recognition` and `meaning` cards, whereas a grammar point might only generate `constrained production`. This targeted mapping prevents exponential workload inflation.

## 3. Review Semantics: Atomic Cards vs. Documents

- **Notes are not review units**: A `Note` (Markdown document) is a source of provenance and narrative content. It does not have an interval or ease. It may produce zero or more `LearningItem` entities.
- **Ink entries are not review units**: A `#69 KanjiInkEntry` is raw authoring data. Saving an ink entry does not activate or schedule a review.
- **Atomic Cards**: The scheduler operates strictly on atomic `Card` candidates. One `LearningItem` (e.g., a vocabulary word) can compile into multiple `Card` entities (e.g., one for reading, one for meaning).
- **Dynamic Rendering**: `Card` entities hold references to their parent `LearningItem` rather than storing duplicate copies of the text. This ensures that any typo corrections or edits made to the `LearningItem` or its source `Note` propagate instantly to the flashcard surface upon rendering, eliminating synchronization bugs.
- **Independent state**: Every active `Card` maintains an independent `ReviewState` and an immutable `ReviewLog`.

## 4. Workload Rules and Session Determinism

To prevent overwhelming the user, daily review sessions must follow bounded deterministic logic:

1. **Queue Priority**:
   1. Learning/Relearning (items currently in the active learning steps)
   2. Overdue reviews
   3. Due reviews
   4. Bounded new cards (capped by a daily limit)
2. **Sibling Burying**: Cards originating from the same `LearningItem` (siblings) must be buried (delayed until the next day) if one sibling has already been reviewed in the current session.
3. **Time Budgets**: Sessions should optionally respect time-boxing constraints.
4. **Leech Protection & Resolution**: Cards that repeatedly fail (lapse) multiple times must be automatically suspended. The UI must provide a "Leech Resolution" loop, prompting the user to reformulate the `LearningItem` (e.g., by adding a better mnemonic, breaking down the context, or editing the sentence) before the card can be un-suspended.
5. **Scheduling Fuzzing**: The scheduler must apply a small degree of random variance ("fuzzing") to intervals to prevent large clusters of cards (like siblings or items learned on the same day) from coming due simultaneously in the future.

## 5. FSRS and Anki Boundaries

- **No Anki dependency**: Japanese V2 will not use Anki Desktop, AnkiConnect, `.apkg` files, or direct SQLite access to Anki databases.
- **Data Durability and Export**: While the local IndexedDB acts as the canonical source of truth during runtime, the system acknowledges the volatility of browser storage (silent evictions). A robust JSON/SQLite export system or a cloud-sync fallback must be implemented so users are never at risk of losing their entire review history.
- **FSRS adoption**: If Free Spaced Repetition Scheduler (FSRS) is adopted, it must be implemented as a local library. It requires:
  - An accepted specification and open-source license.
  - Deterministic fixtures and workload simulation for the parameters.
  - **Interruption-safe Migration**: Migrating from the V1 SM2-like scheduler must feed the historical `ReviewLog` (including exact timestamps, intervals, and grades) directly into the FSRS optimizer. If logs are unavailable or malformed, an explicit, non-destructive fallback strategy must be applied so FSRS does not start entirely from scratch.

## 6. Optional Source-Link Behavior

- **Loose coupling**: `LearningItem` entities may store a reference (ID) to a narrative `Note` or a `#69 KanjiInkEntry` to provide provenance.
- **Dangling references**: The learning model must gracefully handle missing or deleted source references. If the original Note is archived or deleted, the `LearningItem` and its `Card`s remain fully functional.
- **Loss-aware export**: Exports must serialize these relationships safely, explicitly handling broken links without corrupting the export schema.
