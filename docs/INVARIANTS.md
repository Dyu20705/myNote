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

### Canonical note normalization

- `id`, `title`, `content`, `createdAt`, `updatedAt`, `pinned`, `archived`, va `version` la canonical caller-owned fields; action layer van so huu semantic edits, timestamps, va revisions.
- `normalizeNote` phai canonicalize `title` va `content`, sau do parse `content` dung mot lan.
- `links` va `ast` phai luon duoc rebuild tu ket qua parser hien tai.
- `checksum` phai luon duoc rebuild tu canonical `title`, mot ky tu newline, va exact `content`.
- `searchBlob` phai luon duoc rebuild sau cung tu note da normalize.
- Khong duoc tin cay `links`, `ast`, `checksum`, hoac `searchBlob` do caller cung cap.
- Incoming tags phai duoc merge voi parsed tags vi schema hien tai khong co tag provenance; khong duoc tu dong xoa tag chi vi tag khong con trong content.
- Non-empty blocks va block IDs phai duoc preserve. Missing hoac empty blocks duoc generate voi random UUID, nen hai lan normalize doc lap cua raw blockless note khong bat buoc structural-identical.
- `checksum` chi la deterministic, non-cryptographic change detector; no khong dam bao integrity, authenticity, hay collision resistance.
- Quy tac nay chay tai normalization boundary; khong yeu cau migration hay rewrite persistence hien co.

## 3) State Transition Invariant

- Moi thay doi state phai qua action path ro rang.
- Khong mutate shared object truc tiep.
- Transition phai deterministic voi cung input.
- Store shallow-merge object va functional patches theo thu tu; moi active subscriber duoc notify dung mot lan sau moi successful update.
- Note patch chi thay doi cac approved patch fields, phai preserve field ngoai patch boundary, va phai deep-clone nested transition values khi create, apply, hoac invert.
- Failed command execute khong duoc thay doi undo hay redo stack.
- Failed undo/redo phai restore command vao source stack ban dau, khong thay doi opposite stack, va rethrow original error de caller xu ly hoac retry.
- Successful execute/undo/redo phai giu LIFO ordering, redo invalidation, va configured command bound.
- Pure transition contract khong tu no quyet dinh persistence ordering; durable mutation contract o muc 4 la authoritative cho application actions.

## 4) Persistence Consistency Invariant

Canonical command boundary:

```text
prepare normalized mutation
-> persist canonical IndexedDB upsert/delete
-> commit canonical in-memory state
-> update rebuildable backlinks/search projections
-> commit command/history success
```

Bat buoc:
- IndexedDB mutation la canonical commit point cho create, edit, pin/archive, delete, undo, va redo.
- Canonical persistence phai thanh cong truoc khi canonical note collection duoc insert, replace, hoac remove trong memory.
- Canonical failure phai rethrow qua action/command boundary; failed command khong duoc vao undo stack va khong duoc record trong history.
- Failed edit phai giu editor draft hien tai va `dirty: true`; failed delete phai giu note visible/selected; failed create khong duoc insert undurable note.
- Error/status callback chi duoc nhan operation, subsystem, va error object; khong duoc nhan hoac log note title/body.
- Sau canonical commit, backlinks/search failure la derived degradation: khong rollback canonical data, khong invalidate command/history success, va phai hien thi `Saved locally; search index unavailable`.
- Bootstrap phai co the rebuild backlinks va search tu canonical notes.
- History chi duoc record sau khi canonical lifecycle da hoan thanh; derived degradation van la canonical success.

Autosave:
- `createAutosave` chi duoc giu toi da mot in-flight `onSave()` promise va mot pending trailing-work signal.
- Repeated `queue()` phai coalesce; khong duoc chay hai `onSave()` dong thoi.
- `flush()` phai cancel timer/idle callbacks, doi in-flight save, va chay toi da mot trailing save can thiet.
- Work queued trong trailing save phai con duoc schedule, khong bi mat.
- Internally-started promise rejection phai co handler; awaited `flush()` van phai reject cho caller de chan navigation/mutation tiep theo.
- Editor input phai advance save revision truoc khi queue. Neu revision moi xuat hien trong luc save, durable revision cu duoc commit vao collection nhung khong duoc overwrite editor DOM hoac clear `dirty`; trailing save xu ly draft moi.

Legacy migration:
- `localStorage["my-note-v2"]` chi absent khi `getItem` tra ve `null`; empty string la invalid JSON va phai duoc preserve exact.
- Empty check va conditional writes phai nam trong cung mot IndexedDB `readwrite` transaction de serialize cac tab. Neu transaction nay thay IndexedDB da co note, migration phai return `blocked-existing-data`, khong parse/normalize source, khong merge, va khong thay doi ca hai store.
- Khi deciding transaction thay IndexedDB rong, source phai duoc parse dung mot lan. Candidates duoc normalize fail-fast theo thu tu va moi candidate da tham duoc di qua authoritative `normalizeNote` toi da mot lan; khong bat buoc normalize cac candidate sau failure dau tien.
- Malformed JSON, non-array JSON, bat ky invalid record, hoac duplicate normalized ID phai reject toan bo candidate set truoc bat ky write nao trong deciding transaction; khong duoc import valid subset.
- Valid array, ke ca empty array, phai queue trong chinh deciding `readwrite` transaction. Synchronous queue failure phai abort transaction va rethrow original error; request/transaction failure khong duoc de lai partial write.
- Exact legacy key chi duoc remove sau transaction `complete` va chi khi current value van bang exact raw value da capture. Source mismatch phai preserve current source va reject bang content-free `LEGACY_SOURCE_CHANGED`; persistence failure phai giu source de retry. Retry blocked/failure phai deterministic va retry sau success phai la `absent` no-op.
- Migration outcome chi duoc chua bounded `status`, `count`, va optional safe `errorCode`; khong duoc return hoac log raw source, note, ID, title, content, tag, link, checksum, hay database dump.
- Migration giu `myNoteDB` version 1 va current `notes` store/indexes. IndexedDB va localStorage khong co cross-store transaction hay compare-and-remove primitive: neu cleanup fail hoac source doi sau DB commit, lan retry phai preserve ca hai store va return `blocked-existing-data`, khong duoc import lap hoac tu dong xoa source.

Khong duoc:
- Ghi lich su truoc canonical persistence.
- Undo/redo bo qua persistence update.
- Gop canonical storage failure va derived-index failure thanh mot `Storage unavailable` path.
- Tao polling, background retry loop, optimistic queue, hoac schema change trong autosave boundary.

## 5) Search/Index Consistency Invariant

Cho moi updateNote:
- Remove token cu.
- Add token moi.
- Query sau update phai tuong duong rebuild baseline.

Khong duoc:
- Full rebuild o normal editing path.
- Mismatch giua persisted note va worker index ma khong expose degraded/rebuildable status.

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
- Default command va operation history bound la 300; snapshot history giu toi da 30 entries.
- History phai deep-clone operation, nested patch, va snapshot values tren ingress va egress.
- Khi operation history vuot 80 phan tram configured bound, patch payload cua entries cu co the compact ve `null`, nhung metadata va `patchSize` phai duoc preserve va 120 entries moi nhat phai giu full patch.
- Index structures phai co duong remove/compaction.
- Khong tao unbounded caches khong co eviction.

## 11) Test Invariant

Moi thay doi parser/index/history/persistence/autosave can co test tuong ung:
- Deterministic parse.
- Reversible patch/index transitions.
- Undo/redo khong drift state.
- Canonical persist-before-memory ordering va failure injection.
- Autosave coalescing, serialization, flush, trailing work, va rejection handling.
