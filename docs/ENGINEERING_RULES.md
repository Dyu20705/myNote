# Engineering Rules

## Non-negotiable boundaries

1. Preserve `UI → Actions → State → Core → Persistence`.
2. Keep the parser/model pipeline authoritative for tags, links, AST data, checksums, and search material.
3. Do not write to storage from UI modules.
4. Do not execute note content through `eval`, `new Function`, `document.write`, raw HTML injection, or equivalent paths.
5. Do not weaken an invariant or remove regression coverage without an approved replacement contract.
6. Persist canonical mutations before committing in-memory state and history success.
7. Keep errors, metrics, and logs free of note content and database dumps.

## Change discipline

- Select one bounded child issue before implementation.
- Make small changes with explicit interfaces and rollback boundaries.
- Preserve compatible behavior unless the issue explicitly changes it.
- Add focused tests when changing parser, model, state, patches, history, persistence, migration, search, backlinks, autosave, or recovery.
- Update current-tree documentation when architecture or operating constraints change.
- Avoid unrelated refactors and speculative abstractions.

## Reliability

- Treat data-loss and silent-corruption paths as release blockers.
- Use deterministic synthetic fixtures rather than personal browser state.
- Preserve retryable drafts and source data after failed durable operations.
- Separate canonical storage failure from rebuildable derived-index failure.
- Record exact commands and results before claiming success.

## Security and privacy

- Treat note content, imported records, and worker messages as untrusted.
- Validate shapes and bound payload sizes at each trust boundary.
- Render user-controlled content as safe text.
- Never expose note titles, bodies, tags, links, identifiers, source JSON, or database dumps through diagnostics.
- Keep destructive recovery explicit and confirmed.

## Performance and memory

- Prefer incremental index and backlink updates.
- Keep heavy parsing and search off the main thread where required.
- Preserve list virtualization for large collections.
- Bound history, caches, listeners, workers, messages, and rendered state.
- Support optimization claims with reproducible measurements.

## Review checklist

- Does the change preserve dependency direction and ownership?
- Is canonical persistence ordered before state and history success?
- Are failure, retry, recovery, and rollback behavior explicit?
- Are security, privacy, performance, memory, accessibility, and compatibility impacts addressed?
- Do focused and full verification commands pass?
- Do issue status, dependencies, documentation, and implementation agree?