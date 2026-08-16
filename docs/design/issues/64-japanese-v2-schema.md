# Thiết kế V2 Canonical Data Schema (Japanese V2.1)

Dựa trên yêu cầu tối giản (Simplicity First) và Karpathy Guidelines, dưới đây là bản thiết kế Schema V2.1.
Mục tiêu là hỗ trợ Atomic item/card-level identity và cơ chế Exact Undo.

## Chiến lược lưu trữ thời gian (Number vs String)

Tất cả các trường mốc thời gian (`createdAt`, `updatedAt`, `nextReviewAt`, `reviewedAt`) sẽ được lưu dưới dạng **Number (Unix timestamp theo milliseconds)**.
Lý do là hiệu suất truy vấn (Range Queries) của IndexedDB trên mảng dữ liệu số cực kỳ nhanh thông qua `IDBKeyRange.upperBound()`, kích thước nhỏ gọn hơn so với chuỗi ISO 8601, và dễ dàng cộng/trừ interval mà không cần parse date.

## 1. `Item` (Thực thể kiến thức gốc)
Lưu trữ thông tin học thuật độc lập. Hỗ trợ đầy đủ các loại thẻ bao gồm `output` và `sentence`. `reading` và `meaning` là optional.

```typescript
interface Item {
  id: string;              // UUID
  noteId: string;          // Khóa ngoại liên kết về Note gốc (duy trì #69 Ink boundary)
  type: "kanji" | "vocabulary" | "grammar" | "output" | "sentence";

  target: string;          // Từ/Chữ mục tiêu (VD: 食べる, 漢, một câu văn)
  reading?: string;        // Cách đọc (Furigana / Kana). Tùy chọn
  meaning?: string;        // Ý nghĩa. Tùy chọn

  createdAt: number;       // Unix timestamp (ms)
  updatedAt: number;       // Unix timestamp (ms)
}
```

## 2. `Card` (Mặt kiểm tra kỹ năng độc lập)
Tách biệt trạng thái SRS cho từng kỹ năng riêng lẻ.

```typescript
interface Card {
  id: string;              // UUID
  itemId: string;          // Khóa ngoại liên kết về Item

  skill: "recognition" | "meaning" | "reading" | "form-recall";

  status: "new" | "learning" | "review" | "suspended";
  nextReviewAt: number;    // Unix timestamp (ms) - Tối ưu cho IDBKeyRange.upperBound
  interval: number;        // Khoảng cách ôn tập
  ease: number;            // Hệ số độ khó (ease factor)
  lapses: number;          // Tổng số lần quên
}
```

## 3. `ReviewLog` (Nhật ký ôn tập tích hợp State Snapshot)
Hỗ trợ O(1) exact undo (khôi phục trạng thái tức thì không cần tính toán ngược) bằng cách lưu lại nguyên trạng của Card ngay trước thời điểm chấm điểm.

```typescript
interface ReviewLog {
  id: string;              // UUID
  cardId: string;          // Khóa ngoại liên kết về Card

  rating: "again" | "hard" | "good" | "easy";
  reviewedAt: number;      // Unix timestamp (ms)
  responseTimeMs: number;  // Độ trễ trả lời (fluency tracking)

  // --- STATE SNAPSHOT (Phục vụ Exact Undo O(1)) ---
  previousStatus: "new" | "learning" | "review" | "suspended";
  previousInterval: number;
  previousEase: number;
  previousNextReviewAt: number;
}
```
