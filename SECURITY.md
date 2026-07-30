# Security Policy

## Scope

myNote is a local-first browser application. The current security objectives are canonical data integrity, predictable failure behavior, bounded diagnostics, and recoverable local operation.

## Security posture

- Canonical note storage uses IndexedDB.
- No remote synchronization pipeline exists in the current baseline.
- Application logic does not use runtime dynamic code execution.
- Search runs through a validated worker boundary.
- Note metadata extraction is centralized in the parser/model pipeline.
- Note content is treated as untrusted text and is never rendered as raw HTML.

## Known boundaries

- Data is stored in the current browser profile.
- Physical-device compromise is out of scope.
- Browser or privileged-extension compromise is out of scope.
- End-to-end encryption and remote trust are not implemented.

## Private reporting

This repository is maintained for internal development and does not accept public vulnerability reports through unsolicited issues or pull requests. Security findings should be communicated privately to the repository owner and include:

- Reproduction steps using synthetic data.
- Impact and affected boundary.
- Affected files and lines.
- Suggested mitigation when available.

Do not publish proof-of-concept material that could expose user data or destructive recovery steps.

## Hardening checklist

- Validate action and worker payloads before use.
- Preserve `UI → Actions → State → Core → Persistence`.
- Avoid `innerHTML` and equivalent raw-HTML write paths for untrusted text.
- Preserve the parser/model pipeline as the metadata authority.
- Keep worker messages strict and size-bounded.
- Persist canonical mutations before in-memory state and history success.
- Keep errors and logs free of note content and database dumps.

## Recovery

If local storage initialization fails, the application exposes a safe-mode reset path:

- Command palette action: `Safe mode: reset local database`.
- Bootstrap recovery may request confirmation before reset and reload.

Reset clears the application IndexedDB database and its exact legacy localStorage key. It is destructive and must remain explicit.