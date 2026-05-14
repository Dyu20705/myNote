# Huong dan User Flow va Beta Test

Tai lieu nay mo ta user flow chinh va ke hoach beta test cho myNote theo khung 2-4 tuan.

## 1) Muc tieu beta

- Xac nhan do on dinh cho luong ghi chu hang ngay.
- Xac nhan tinh nhat quan giua edit, autosave, search, backlinks, undo/redo.
- Phat hien som loi race condition, regression hieu nang, va gap UX nghiem trong.

## 2) User flow chinh (Happy path)

### Flow A: Khoi tao va tao ghi chu dau tien

1. Mo ung dung.
2. Nhan Ctrl/Cmd+N de tao note moi.
3. Nhap title va content.
4. Cho autosave hoac nhan Save.
5. Xac nhan trang thai luu o top bar.

Ky vong:

- Note moi xuat hien trong danh sach.
- Reload trang van con du lieu.

### Flow B: Tim kiem va dieu huong

1. Nhap tu khoa vao o search.
2. Dung j/k de di chuyen note.
3. Dung gg/G de nhay dau/cuoi danh sach.
4. Nhan vao note hoac Enter command palette de mo hanh dong nhanh.

Ky vong:

- Ket qua tim kiem cap nhat nhanh, khong giat lag ro rang.
- Note active dong bo giua list va editor.

### Flow C: Wiki-link va backlinks

1. Tao 2 note A va B.
2. Trong note B, them lien ket [[A]].
3. Mo note A va kiem tra panel backlinks.

Ky vong:

- Backlinks hien note B.
- Sua title note A va kiem tra backlinks cap nhat dung.

### Flow D: Undo/Redo

1. Sua noi dung note.
2. Nhan Ctrl/Cmd+Z de undo.
3. Nhan Ctrl/Cmd+Shift+Z hoac Ctrl/Cmd+Y de redo.

Ky vong:

- Noi dung quay lui/chay toi dung thu tu.
- Khong mat dong bo voi search va list.

### Flow E: Export

1. Mo command palette bang Ctrl/Cmd+K.
2. Chon Export all as Markdown.
3. Lap lai voi Export all as JSON.

Ky vong:

- File duoc tai ve thanh cong.
- Noi dung khong rong, cau truc hop le.

### Flow F: Safe mode recovery

1. Gia lap loi storage init (co the bang profile browser loi hoac data xung dot).
2. Xac nhan app vao trang thai Safe mode.
3. Chon hanh dong reset local database.
4. App reload sau reset.

Ky vong:

- Co thong diep huong dan ro rang.
- Reset thanh cong va app khoi tao lai duoc.

## 3) Ke hoach beta 2-4 tuan

### Tuan 1: Smoke + onboarding

- 10-15 tester noi bo.
- Tap trung Flow A, B, E.
- Thu thap bug blocker, crash, mat du lieu.

### Tuan 2: Core reliability

- 20-30 tester.
- Tap trung Flow C, D.
- Them test du lieu vua (>= 500 notes) de check virtualization.

### Tuan 3: Stress va edge cases

- 30+ tester.
- Test note dai, nhieu tags, nhieu wiki-links, thao tac nhanh lien tuc.
- Test reload lien tuc, dong/mo tab, tab hidden/visible.

### Tuan 4: Go/No-Go

- Chot bug critical/phai fix.
- Re-test regression cac bug da fix.
- Danh gia san sang release.

## 4) Test matrix toi thieu

- Browser: Chrome, Edge, Firefox (ban moi).
- Nen tang: Windows va it nhat 1 nen tang phu (macOS hoac Linux).
- Kich thuoc du lieu:
- Nho: < 100 notes.
- Vua: 100-1000 notes.
- Lon: > 1000 notes.

## 5) Tieu chi pass/fail

Pass khi:

- Khong con bug Critical/High lien quan mat du lieu.
- Undo/Redo, search, backlinks khong co loi nhat quan da biet.
- Safe mode recovery hoat dong tren moi moi truong test chinh.

Fail khi:

- Co bug mat du lieu lap lai duoc.
- Co freeze main thread de thay ro trong thao tac co ban.
- Export cho ra file loi hoac thieu du lieu.

## 6) Mau bug report

- Tieu de: [Area] Mo ta ngan gon
- Moi truong: browser + OS + version
- Buoc tai hien: 1..n
- Ket qua thuc te
- Ket qua ky vong
- Tan suat: 100% / ngau nhien
- Dinh kem: screenshot/video va file export neu can

## 7) Logging cho beta

- Danh dau cac bug theo nhom: Data integrity, Search, Backlinks, Undo/Redo, Export, Recovery, Performance.
- Uu tien fix theo muc do: Critical -> High -> Medium -> Low.
- Chot bao cao hang tuan: so bug moi, so bug dong, top regression.

## 8) Checklist cho nguoi test

- Da test tao/sua/xoa note.
- Da test search + dieu huong phim tat.
- Da test backlinks voi wiki-link.
- Da test undo/redo.
- Da test export Markdown/JSON.
- Da test reload trang va kiem tra du lieu con day du.
