# myNote Invariants (Must-Hold Rules)

Tai lieu nay la hop dong ky thuat bat buoc voi AI agent va contributor.
Neu vi pham, thay doi do phai bi tu choi.

## 1) Dependency Direction Invariant

Bat buoc:
UI -> Actions -> State -> Core -> Persistence

Khong duoc:
- UI goi IndexedDB truc tiep.
- Parser mutate state.
- Worker mutate DOM.
- Command stack bypass state manager.

## 2) Parser Source-of-Truth Invariant

Metadata (tags, links, code blocks, token, ast) phai di qua parser pipeline.

- Tag va wiki-link metadata chi duoc trich xuat ngoai fenced code, ke ca fence chua dong.
- Moi fenced code chi xuat hien mot lan duoi dang code node, khong lap lai thanh paragraph.
- Tokenization van bao gom noi dung code de giu kha nang tim kiem.

Khong duoc:
- Regex duplicate metadata extraction o UI, history, search orchestration.
- Vua parse trong parser, vua parse lai o noi khac de "cho nhanh".

## 3) State Transition Invariant

- Moi thay doi state phai qua action path ro rang.
- Khong mutate shared object truc tiep.
- Transition phai deterministic voi cung input.

## 4) Persistence Consistency Invariant

Command boundary:
execute -> persist/index -> commit history

Khong duoc:
- Ghi lich su truoc khi persist/index thanh cong.
- Undo/redo bo qua persistence update.

## 5) Search/Index Consistency Invariant

Cho moi updateNote:
- Remove token cu.
- Add token moi.
- Query sau update phai tuong duong rebuild baseline.

Khong duoc:
- Full rebuild o normal editing path.
- Mismatch giua persisted note va worker index.

## 6) Backlinks Consistency Invariant

- Backlinks phai cap nhat incrementally theo note upsert/remove.
- Reverse edges phai dung sau rename/retitle/delete.

Khong duoc:
- De stale backlinks sau khi note thay doi.

## 7) Rendering Invariant

- Virtualized rendering bat buoc cho list lon.
- Khong full rerender toan bo list cho moi keypress.
- Event listeners phai duoc quan ly de tranh leak.

## 8) Security Invariant

- Khong render raw HTML tu note content.
- Wiki-link output phai escaped/safe by default.
- Worker message phai validate shape va bound payload.

## 9) Performance Invariant

- Khong synchronous heavy parsing/indexing tren main thread.
- Search query phai async qua worker.
- Metrics instrumentation phai duoc giu enabled o dev.

## 10) Memory Invariant

- Undo/history phai bounded.
- Index structures phai co duong remove/compaction.
- Khong tao unbounded caches khong co eviction.

## 11) Test Invariant

Moi thay doi parser/index/history can co test tuong ung:
- Deterministic parse.
- Reversible patch/index transitions.
- Undo/redo khong drift state.
