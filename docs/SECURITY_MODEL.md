# myNote Security Model (Local-First Browser App)

Pham vi:
- Ung dung local-first tren browser.
- Khong co backend public API.
- Input chinh den tu note content va worker messages.

## 1) Threat Surface

- Note content la untrusted input.
- Wiki-links va markdown fragments co the chua payload doc hai.
- Worker channel co the nhan malformed event.data.
- IndexedDB migration co the fail/corrupt state.

## 2) Security Principles

- Escape-by-default cho moi text user-generated.
- Validate input shape truoc khi xu ly.
- Bound size cho payload user-controlled.
- Fail closed khi khong hop le.
- Khong render raw HTML tu note content.

## 3) Concrete Constraints

- Cam su dung innerHTML voi note content.
- Wiki-link render output phai treated as plain text/safe node.
- Worker onmessage phai validate envelope + payload type.
- Query/content length phai bi gioi han.
- DB migration phai co fallback recovery plan.

## 4) Data Integrity Controls

- Note version + checksum duoc duy tri tren model.
- Persistence action can theo transaction boundary.
- History chi commit sau khi persist/index succeed.

## 5) Recovery Model (Required)

Khi migration/persistence fail:
1. Bao loi co ngu canh.
2. Ngung commit history cho action do.
3. Cho phep export backup json.
4. Kich hoat path reset/rebuild an toan (co xac nhan).

## 6) Security Test Requirements

Can co test cho:
- Parser input doc hai (XSS-like strings).
- Worker malformed payload.
- Oversized notes va oversized query.
- Migration failure branch.

## 7) Out-of-Scope (Phase hien tai)

- Multi-user authz/authn.
- Network sync and remote trust model.
- End-to-end encryption key management.
