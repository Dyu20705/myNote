# Japanese V2 Learning Contract and Scheduler Boundary

This document defines the learning model, skill separation, review semantics, workload rules, and scheduler boundaries for Japanese V2, based on the V1 audit (#64) and the Japanese V2 Roadmap (#63).

## 1. Content Quality and Japanese-Primary Context

- **Context-first invariants**: Learning items must prioritize context (sentences, collocations, scenes) over isolated translations.
- **No generic translations**: Canonical learning content must not rely on required Vietnamese translation fields, Sino-Vietnamese approximations, or generic translated `Meaning` fields.
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

## 3. Review Semantics: Atomic Cards vs. Documents

- **Notes are not review units**: A `Note` (Markdown document) is a source of provenance and narrative content. It does not have an interval or ease. It may produce zero or more `LearningItem` entities.
- **Ink entries are not review units**: A `#69 KanjiInkEntry` is raw authoring data. Saving an ink entry does not activate or schedule a review.
- **Atomic Cards**: The scheduler operates strictly on atomic `Card` candidates. One `LearningItem` (e.g., a vocabulary word) can compile into multiple `Card` entities (e.g., one for reading, one for meaning).
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
4. **Leech Protection**: Cards that repeatedly fail (lapse) multiple times must be automatically suspended and flagged as leeches, preventing them from consuming excessive review time.

## 5. FSRS and Anki Boundaries

- **No Anki dependency**: Japanese V2 will not use Anki Desktop, AnkiConnect, `.apkg` files, or direct SQLite access to Anki databases.
- **No two-way sync**: The local IndexedDB is the canonical source of truth.
- **FSRS adoption**: If Free Spaced Repetition Scheduler (FSRS) is adopted, it must be implemented as a local library. It requires:
  - An accepted specification and open-source license.
  - Deterministic fixtures and workload simulation for the parameters.
  - Interruption-safe migration from the V1 SM2-like scheduler.

## 6. Optional Source-Link Behavior

- **Loose coupling**: `LearningItem` entities may store a reference (ID) to a narrative `Note` or a `#69 KanjiInkEntry` to provide provenance.
- **Dangling references**: The learning model must gracefully handle missing or deleted source references. If the original Note is archived or deleted, the `LearningItem` and its `Card`s remain fully functional.
- **Loss-aware export**: Exports must serialize these relationships safely, explicitly handling broken links without corrupting the export schema.
