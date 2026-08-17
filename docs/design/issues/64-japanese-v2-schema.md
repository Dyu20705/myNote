# V2 Canonical Data Schema Design (Japanese V2.1)

Based on the requirement for simplicity (Simplicity First) and Karpathy Guidelines, here is the V2.1 Schema design.
The goal is to support Atomic item/card-level identity and Exact Undo mechanism.

## Time Storage Strategy (Number vs String)

All timestamp fields (`createdAt`, `updatedAt`, `nextReviewAt`, `reviewedAt`) will be stored as **Number (Unix timestamp in milliseconds)**.
The reason is that the query performance (Range Queries) of IndexedDB on an array of numeric data is extremely fast via `IDBKeyRange.upperBound()`, more compact in size than an ISO 8601 string, and makes it easy to add/subtract intervals without needing to parse the date.

## 1. `Item` (Core Knowledge Entity)
Stores independent academic information. Fully supports all card types including `output` and `sentence`. `reading` and `meaning` are optional.

```typescript
interface Item {
  id: string;              // UUID
  noteId: string;          // Foreign key linked to the original Note (maintains #69 Ink boundary)
  type: "kanji" | "vocabulary" | "grammar" | "output" | "sentence";

  target: string;          // Target word/character (e.g., 食べる, 漢, a sentence)
  reading?: string;        // Reading (Furigana / Kana). Optional
  meaning?: string;        // Meaning. Optional

  createdAt: number;       // Unix timestamp (ms)
  updatedAt: number;       // Unix timestamp (ms)
}
```

## 2. `Card` (Independent Skill Testing Face)
Separates the SRS state for each individual skill.

```typescript
interface Card {
  id: string;              // UUID
  itemId: string;          // Foreign key linked to the Item

  skill: "recognition" | "meaning" | "reading" | "form-recall";

  status: "new" | "learning" | "review" | "suspended";
  nextReviewAt: number;    // Unix timestamp (ms) - Optimized for IDBKeyRange.upperBound
  interval: number;        // Review interval
  ease: number;            // Ease factor
  lapses: number;          // Total number of lapses
}
```

## 3. `ReviewLog` (Review Log with State Snapshot)
Supports O(1) exact undo (immediate state restoration without backward calculation) by saving the exact state of the Card immediately before grading.

```typescript
interface ReviewLog {
  id: string;              // UUID
  cardId: string;          // Foreign key linked to the Card

  rating: "again" | "hard" | "good" | "easy";
  reviewedAt: number;      // Unix timestamp (ms)
  responseTimeMs: number;  // Answer latency (fluency tracking)

  // --- STATE SNAPSHOT (For Exact Undo O(1)) ---
  previousStatus: "new" | "learning" | "review" | "suspended";
  previousInterval: number;
  previousEase: number;
  previousNextReviewAt: number;
}
```
