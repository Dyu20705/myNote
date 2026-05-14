# myNote Roadmap Phase 2

Trang thai: Feature freeze co dieu kien.
Muc tieu: tang do tin cay, consistency, security, profiling.

## 0) Scope cua Phase 2

Khong uu tien them feature UI moi.
Tap trung:
- Correctness.
- Failure recovery.
- Security hardening.
- Profiling va tooling.

## 1) Current Baseline Snapshot

- Modular core/ui split.
- Worker-based search with incremental indexing.
- Incremental backlinks index.
- Patch-based history + command stack undo/redo.
- Parser pipeline + AST foundation.
- Virtualized list rendering.
- Runtime metrics panel.
- Parser invariant tests.

## 2) Priority 1: Consistency and Correctness

Muc tieu:
- Khong drift state giua memory, index, persistence.

Cong viec:
- Incremental index consistency tests (upsert/remove vs rebuild equivalence).
- Backlinks consistency tests (rename/delete/title collision cases).
- Autosave race-condition tests (out-of-order completion).
- Persistence recovery tests (migration/db failure scenarios).

Exit criteria:
- Test pass 100% tren local baseline.
- Khong con known stale-index/stale-backlink path.

## 3) Priority 2: Security Hardening

Muc tieu:
- Giam toi da input-based risk trong browser runtime.

Cong viec:
- XSS-focused parser tests (wiki-link payloads, escaped output constraints).
- Malformed worker message tests.
- Oversized note payload tests (size guards).
- Migration failure fallback strategy + test.

Exit criteria:
- Worker reject malformed envelope/payload deterministically.
- Parser output khong mo dynamic HTML execution surface.

## 4) Priority 3: Developer Tooling

Muc tieu:
- De debug va performance triage nhanh, repeatable.

Cong viec:
- Profiling overlay mode (latency detail per action).
- Trace logging (action timeline + effect status).
- Event timeline view (save/index/render chain).
- State inspection snapshot (debug-only).

Exit criteria:
- Co the truy vet 1 action tu UI event den persistence trong <= 1 phut.

## 5) Priority 4: Storage Durability

Muc tieu:
- Tang kha nang phuc hoi du lieu va giam memory drift.

Cong viec:
- Snapshot compaction strategy.
- Journal/recovery design note.
- Corruption detection checksum policy.
- Export checkpoints policy.

Exit criteria:
- Co tai lieu va prototype cho recovery flow chinh.

## 6) Accepted Technical Debt (Tam chap nhan)

- Virtualization row-height fixed.
- Markdown parser lightweight (khong full spec).
- Chua co CRDT/sync.
- Chua co persistent snapshot compaction day du.
- Metrics memory su dung performance.memory (browser-dependent).

## 7) DoD cua Phase 2

Phase 2 hoan tat khi:
- Invariants giu duoc o tat ca test core.
- Security test suite co coverage cho malformed input path.
- Co profiling/tooling du de debug race/latency.
- Co ke hoach durability duoc phe duyet cho Phase 3.
