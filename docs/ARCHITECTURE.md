# myNote Architecture Baseline (Phase 1 Closed)

Muc tieu tai lieu nay:
- Chot huong kien truc nen tang sau Phase 1.
- Giam architectural drift khi tiep tuc dung AI agent coding.
- Tao baseline de danh gia moi thay doi o Phase 2.

## 1) He thong hien tai (Baseline)

myNote da co cac thanh phan cot loi:
- Persistence: IndexedDB schema v2 + migration tu localStorage. `notes` giu nguyen schema v1; `studyReviews` la store metadata doc lap, lien ket duy nhat bang `noteId`.
- Data model: note co cau truc (version, checksum, blocks, tags, links, ast).
- Parser pipeline: parseDocument la nguon metadata chinh.
- Search engine: worker-based + incremental index updates.
- Backlinks: incremental backlinks index.
- History: command stack undo/redo + patch-based history.
- Rendering: virtualized note list.
- Observability: metrics instrumentation trong UI.
- Tests: parser invariant tests.

## 2) So do kien truc bat buoc

Flow phu thuoc:
UI -> Actions -> State -> Core services -> Persistence

Mo ta:
- UI chi phat su kien, khong truy cap persistence truc tiep.
- Actions la diem vao duy nhat de thay doi state.
- State cap nhat co kiem soat va co the trace.
- Core services xu ly parser, search, backlinks, history.
- Persistence chi duoc goi tu action/effect layer.

## 3) Ownership theo module

- app.js:
  - Bootstrap va dependency wiring.
  - Event to Action routing.
  - Khong chua business logic parser/search phuc tap.

- core/parser:
  - Parse markdown, tags, wiki links, code blocks, tokenization.
  - Tra ve cau truc deterministic.

- core/search.worker + core/searchClient:
  - Index/query bat dong bo.
  - Validate worker payload.
  - Ranking va incremental upsert/remove.

- core/backlinks:
  - Incremental graph relation index.
  - Khong phu thuoc UI.

- core/storage:
  - So huu IndexedDB schema v2, migration, va IO.
  - So huu `notes` va `studyReviews` transactions; upgrade chi them `studyReviews`, khong doc hay rewrite `notes`.
  - Paired note/review mutation commit atomically trong mot transaction; single review update chi dung `studyReviews` va khong tao orphan.
  - Khong duoc mutate UI/state truc tiep.

- core/studyReview:
  - So huu exact persisted review-record validation, enum, va defensive copies.
  - `studyReviews` khong so huu note content hay lifecycle UI; quan he duy nhat voi note la `noteId`.

- core/commandStack + core/notePatch + core/history:
  - Execute/undo/redo theo command boundary.
  - Patch-based ghi lich su thay doi.

- ui/*:
  - Render va interaction thuần UI.
  - Khong parse metadata va khong goi storage.

## 4) Operational update cycle

1. UI event.
2. Action nhan su kien va tao transition.
3. State update (predictable).
4. Effect (persist/index/backlinks) chay async.
5. Render incremental.
6. Metrics cap nhat.

Study review persistence khong them state, scheduler, parser, hay UI behavior trong package nay. Bootstrap khong enroll note cu. Code cu yeu cau IndexedDB v1 khong the mo database da nang cap v2; rollback phai la deployment code tuong thich v2, khong phai schema downgrade hay data rewrite.

## 5) Phase 1 dong lai

Phase 1 duoc xem la hoan tat khi:
- Kien truc baseline nay duoc giu on dinh.
- Khong them feature lon ngoai roadmap Phase 2.
- Moi PR/refactor deu duoc doi chieu voi INVARIANTS.md.

## 6) Gate cho moi thay doi moi

Moi thay doi tu AI agent phai tra loi:
- Co tao dependency moi sai huong khong?
- Co duplicate parsing logic ngoai parser pipeline khong?
- Co them synchronous heavy work tren main thread khong?
- Co mo them memory structure khong gioi han khong?
- Co ro transaction boundary giua state/persistence/history khong?
- Co giu `notes` schema/records bat bien trong upgrade, va co tranh auto-enrollment khong?
- Neu thay doi ca note va review, co dung mot cross-store transaction va terminal rollback khong?
