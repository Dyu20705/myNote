# myNote Performance Budget

Tai lieu nay dat ngan sach hieu nang de ngan performance drift.
Moi thay doi can doi chieu voi budget truoc khi merge.

## 1) Budget Muc tieu

- Search latency (worker query): < 20ms median tren tap du lieu vua.
- Typing frame budget: < 8ms/frame tren main thread.
- Initial load to interactive: < 250ms trong dieu kien local warm.
- Autosave idle cost: < 50ms median.
- Memory growth: bounded, khong tang vo han theo thoi gian.

## 2) Runtime Constraints

- Search/indexing nặng phai o worker.
- Khong full DOM rerender khi note edit.
- Virtualized list bat buoc khi note count lon (>= 500).
- Khong full rebuild index trong normal editing path.

## 3) Measurement Sources

- Metrics panel trong topbar:
  - render
  - search
  - worker
  - autosave
  - mem

- Profiling bo sung (Phase 2):
  - action timeline
  - effect latency breakdown

## 4) Regression Rules

- Neu budget vuot nguong, khong merge feature moi lien quan.
- Uu tien fix regression truoc khi tiep tuc roadmap.
- Moi optimization claim phai co so lieu do duoc.

## 5) Suggested Test Scenarios

- 100 notes / 1k notes / 10k notes list.
- Note content ngan, vua, dai (bao gom code blocks).
- Search burst queries lien tuc.
- Autosave khi tab visible/hidden transition.

## 6) Known Temporary Limits

- Fixed-row virtualization co sai so voi noi dung cao dong.
- memory metric phu thuoc browser support performance.memory.

## 7) Phase 2 Exit Criteria

- Khong regression vuot budget trong test scenario chinh.
- Co baseline benchmark file de so sanh qua tung refactor.
