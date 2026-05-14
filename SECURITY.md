# Security Policy

## Pham vi (Scope)

myNote la ung dung trinh duyet local-first. Muc tieu bao mat chinh la toan ven du lieu (data integrity), hanh vi co the du doan, va phuc hoi an toan.

## Tu the bao mat (Security Posture)

- Local-first storage using IndexedDB.
- No remote sync pipeline in current baseline.
- No runtime dynamic code execution in app logic.
- Worker boundary for search to reduce main-thread blast radius.
- Input parsing is centralized in parser pipeline.

## Bien gioi da biet (Known Boundaries)

- Data is stored in the current browser profile.
- Physical device compromise is out of scope.
- Browser extension compromise is out of scope.

## Bao cao loi bao mat (Reporting)

Report vulnerabilities privately with:

- Reproduction steps
- Impact assessment
- Affected files and lines
- Suggested mitigation (if available)

Do not publish proof-of-concept that can expose user data before maintainers acknowledge.

## Danh sach hardening (Hardening Checklist)

- Validate all action payloads before persistence.
- Keep dependency direction: UI -> Actions -> State -> Core -> Persistence.
- Avoid introducing `innerHTML` write paths for untrusted text.
- Preserve parser as single source for tags/links/search blob.
- Keep worker message schema strict and bounded.

## Phuc hoi (Recovery)

If storage init fails, app enters safe mode state and provides reset path:

- Command palette action: `Safe mode: reset local database`
- Bootstrap fallback prompt can trigger reset and reload

Reset clears local IndexedDB and legacy localStorage key for this app.
