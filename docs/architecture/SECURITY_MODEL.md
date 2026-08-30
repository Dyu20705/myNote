# myNote Security Model

## Scope

myNote is a local-first browser application with no public backend API in the current baseline. Primary untrusted inputs are note content, imported legacy data, and worker messages.

## Threat surface

- Note content and Markdown-like fragments may contain hostile text.
- Wiki-link labels may contain payloads intended to escape rendering boundaries.
- Worker channels may receive malformed or oversized messages.
- IndexedDB initialization, transactions, or migration may fail or encounter inconsistent data.
- Browser extensions, a compromised browser profile, and physical-device compromise are outside the current protection boundary.

## Security principles

- Escape user-controlled text by default.
- Validate shape and type before processing.
- Bound user-controlled payload sizes.
- Fail closed on malformed input.
- Never execute note content as code or raw HTML.
- Keep diagnostics content-free and operationally useful.
- Preserve canonical data or expose a recoverable state on failure.

## Required controls

- Do not write note content through `innerHTML` or equivalent raw-HTML paths.
- Render wiki-link labels as safe text or escaped nodes.
- Validate worker envelopes, message types, identifiers, and payload bounds.
- Bound query and content sizes at the relevant boundary.
- Keep persistence writes inside the action/core lifecycle.
- Keep canonical persistence ahead of in-memory state and history success.
- Treat search/backlink failures after persistence as rebuildable degradation.
- Provide an explicit, confirmed safe-mode reset for unrecoverable local initialization failure.

## Data integrity

- The model maintains explicit versions and deterministic checksums.
- IndexedDB transactions define canonical mutation boundaries.
- History records only successful canonical lifecycle operations.
- Migration validates the complete source before writing and never imports a valid subset from an invalid source.
- Migration and storage errors never expose note titles, bodies, tags, links, identifiers, source JSON, or database dumps.

## Recovery model

When persistence or migration fails:

1. Surface a bounded error that identifies the operation and subsystem.
2. Do not commit canonical in-memory state or history for the failed mutation.
3. Preserve retryable editor input and source data where applicable.
4. Keep export available when canonical data can still be read safely.
5. Offer a confirmed local reset only when normal recovery is unavailable.

## Required security tests

- XSS-like note and wiki-link input remains inert.
- Malformed and oversized worker payloads are rejected deterministically.
- Oversized note and query boundaries are enforced.
- Canonical persistence failure does not create in-memory or history success.
- Migration failures are atomic, retry-safe, and content-free.

## Out of scope

- Multi-user authentication or authorization.
- Remote synchronization and remote trust.
- End-to-end encryption and key recovery.
- Protection from a compromised device, browser, or privileged extension.