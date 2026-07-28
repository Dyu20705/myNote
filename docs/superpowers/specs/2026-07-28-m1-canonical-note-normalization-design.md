# M1 canonical note normalization design

## Scope

Issue #39 defines the ownership contract enforced by `core/model.js::normalizeNote`. The change covers one model aggregation boundary, dedicated unit tests, the unit-test script, and the authoritative invariant documentation. It does not change the note schema, IndexedDB, migration behavior, parser behavior, actions, history, search or backlink workers, export, tasks, or UI.

## Ownership contract

### Canonical caller-owned fields

The caller owns `id`, `title`, `content`, `createdAt`, `updatedAt`, `pinned`, `archived`, and `version`.

- A string `title` is trimmed; an empty, whitespace-only, or non-string title becomes `Untitled`.
- A string `content` is preserved exactly, including CRLF or CR line endings. Non-string content becomes `""`. Parser-internal line-ending normalization does not rewrite stored content.
- String IDs and timestamps are preserved. Missing IDs and timestamps retain the current UUID/current-time defaults.
- Flags retain the current `Boolean` coercion.
- A positive integer `version` is preserved. Missing, null, string, fractional, zero, or negative versions become `1`.
- Action boundaries own timestamp changes and revision increments. Normalization validates or defaults fields but does not invent a user edit.

### Compatibility-preserved fields

Incoming tags and existing non-empty blocks remain compatibility-preserved stored fields.

- Incoming tags are trimmed, lowercased, filtered, and deduplicated in first-seen order. Parser-produced content tags are then merged in parser order.
- Incoming or system tags such as `daily` survive when they are absent from content. The current schema has no provenance that can safely distinguish those values from formerly content-derived tags, so normalization does not remove them.
- Tags found only inside closed or unclosed fenced code remain excluded because all content-derived tags come from the existing parser result.
- Existing non-empty `blocks` arrays and block IDs are preserved structurally. Missing or empty blocks retain the current `buildBlocks(content)` behavior.
- Generated blocks intentionally receive random UUIDs. Separate normalizations of a blockless raw note are therefore not required to be structurally identical.

This design does not claim to solve tag provenance or block identity. Either change requires a separately approved data-model and migration decision.

### Rebuildable derived fields

`links`, `ast`, `checksum`, and `searchBlob` are rebuildable projections. Caller-supplied values for these fields are ignored.

- `normalizeNote` calls `parseDocument(content)` once. `links` and `ast` come exclusively from that one result for the final content.
- `checksum` uses the existing hash algorithm with this exact input:

  ```js
  hashText(`${normalizedTitle}\n${normalizedContent}`)
  ```

  The values are the final normalized title and exact stored content.
- The checksum is a deterministic change detector. It is not a cryptographic integrity, authenticity, collision-resistance, or security guarantee.
- `searchBlob` is rebuilt from the final normalized title, exact content, merged tags, and rebuilt links through the existing `buildSearchBlob` helper.
- A fully specified note with fixed identity, timestamps, version, blocks, and canonical content is idempotent: normalizing an already normalized result produces the same structure.

## Data flow and architecture

The existing dependency direction remains:

```text
UI → Actions → State → Core → Persistence
```

`core/parser` remains the sole parser for content-derived metadata. `normalizeNote` is the aggregation boundary that resolves caller-owned fields, consumes one parser result, preserves compatibility fields, and replaces rebuildable projections. Persistence remains a passive consumer of the normalized record and is not modified.

Bootstrap continues to normalize loaded records in memory and rebuild search/backlinks from those values. It does not bulk-persist records merely because a derived field was corrected. A future ordinary save may persist corrected projections in the existing schema.

## Implementation approach

Three approaches were considered:

1. Add provenance-aware tag fields and migrate existing notes. This would make tag removal precise but requires schema and migration work outside #39.
2. Replace every stored tag and block from content. This would lose system tags and stable block identities.
3. Preserve compatibility fields while rebuilding only projections that are provably derived. This is the selected approach because it fixes current metadata drift without irreversible schema commitments or data loss.

The minimal implementation resolves final canonical values before constructing the returned object. It parses final content once, merges tags, preserves or generates blocks, assigns parser links/AST, hashes final title/content, and then builds the search blob from the nearly complete object. No new helper or dependency is required.

## Error and edge behavior

- `normalizeNote(null)`, `normalizeNote(undefined)`, and representative non-object inputs return `null`.
- `hashText` retains its existing string-input contract.
- No new exception, network, worker, persistence, rendering, or executable-content path is introduced.
- Generated IDs, timestamps, and block IDs remain intentionally nondeterministic only when their caller-owned or compatibility-preserved values are absent.

## Test design

`tests/unit/model.normalization.test.mjs` uses Node's built-in test runner, strict assertions, fixed synthetic canonical values, and real model/parser code. Required RED cases prove that current production code accepts stale links, AST, and checksum and hashes a raw rather than normalized title. Additional coverage locks down rebuilt search material, invalid inputs, deterministic tag ordering, fenced-code isolation, block preservation/generation, version validation, canonical-field preservation, content line endings, hash determinism, and the correctly bounded idempotence contract.

Expected values are literal or hand-derived where practical. Parser equality is used only to assert the explicit cross-module ownership contract, not to recreate the model implementation. UUID assertions check shape, count, uniqueness, and preservation rather than exact generated values.

## Existing-data compatibility and rollback

There is no database version bump, migration, automatic rewrite, bulk persistence, or schema field change. Existing records remain readable. Corrected derived fields may appear in memory at bootstrap and may later be saved through an ordinary user-authorized write.

Rollback is a code revert of the model change, tests, test-script entry, design, plan, and invariant documentation. Records saved while this change is active remain schema-compatible because canonical content and field names do not change; no data downgrade is required.

## Security, privacy, performance, and accessibility

Tests contain synthetic values only and do not log full note objects or bodies. The change adds no credential, provider, network, raw-database, browser-profile, attachment, or code-execution boundary.

Normalization remains bounded by one note. It performs one parser aggregation call plus linear tag, hash, and search-blob work, adds no cache, and performs no database scan or write. There is no user-visible UI or accessibility change.
