# Kanji handwriting architecture

Issue: #69  
Scope: M2 desktop-first mouse/pen handwriting input

## User flow

1. Open **More actions → Add Kanji handwriting** for the active note.
2. Draw one character on the square canvas.
3. Run the local recognizer.
4. Select one candidate explicitly; no candidate is auto-selected.
5. Save only after IndexedDB persistence succeeds.
6. Inspect, edit, delete, or undo the attached handwriting from **Details → Supplementary entities**.

The first-release recognizer supports only:

```text
人 入 八 大 犬 火 木 本
```

This is a bounded geometric recognizer, not universal Japanese OCR or stroke-order grading.

## Recognition scale and packaging boundary

The eight embedded geometric templates are the experimental Issue #69 sample pack, not broad recognition coverage. Do not indefinitely append large datasets to the current flat embedded list.

Any recognition expansion requires a separate issue or ADR that defines the character inventory, template provenance and licensing, versioned manifests, lazy worker loading, an evaluation corpus and quality thresholds, performance and bundle budgets, and migration and rollback behavior.

The MVP keeps its flat-file packaging boundary. A future approved package may group templates by version and load groups lazily through a worker, while retaining explicit manifests and a rollback path; that direction is not implemented by this release.

## Module boundaries

```text
ui/kanjiInkView.js
ui/kanjiInkImportCommand.js
        │
        ▼
core/kanjiInkApplication.js
        ├── controller / recognizer
        ├── storage adapter
        ├── search projection
        └── export / import
```

The UI imports the application service and domain limits only. A unit contract rejects UI imports of `core/storage.js`, `openDatabase`, or IndexedDB APIs.

`core/kanjiInkApplication.js` owns database handle lifetime and closes every handle in `finally`. It exposes note-context loading, controller creation, entry delete/restore, lossless export, human-readable export, and atomic import.

## Persisted model

IndexedDB schema version: `3`  
Object store: `kanjiInkEntries`  
Key path: `id`  
Indexes: `noteId`, `updatedAt`

```js
{
  id: string,
  noteId: string,
  schemaVersion: 1,
  revision: integer >= 1,
  character: one Han Unicode character,
  strokes: Array<Array<{ x: number, y: number }>>,
  recognizer: {
    engineId: string,
    engineVersion: string,
    datasetVersion: string,
    selectedRank?: integer // 0..7; omitted only for legacy v1 records
  },
  createdAt: ISO-8601 string,
  updatedAt: ISO-8601 string
}
```

Coordinates are normalized to `[0, 1]`. Raster canvas pixels are a render-only projection and are never the canonical record.

### Literal limits

| Limit | Value |
| --- | ---: |
| Strokes per entry | 32 |
| Points per stroke | 256 |
| Total points per entry | 4096 |
| Serialized entry size | 262,144 bytes |
| Candidates returned | 8 |
| Entries rendered in one inspector view | 64 |
| Import file size | 8 MiB |

Malformed, hostile, oversized, orphaned, and duplicate records fail before durable mutation where possible. Invalid persisted records are isolated and reported rather than silently rewritten.

## Dual representation

The feature maintains two related representations:

- **Canonical note:** ordinary note content remains unchanged.
- **Supplementary handwriting:** normalized vectors plus the confirmed Unicode character live in `kanjiInkEntries`.

Search receives only the confirmed Unicode character projection. Stroke arrays, coordinates, and recognizer candidate lists are excluded from `searchBlob`.

Candidate lists are transient. New records retain only recognizer identity and the zero-based rank of the candidate selected by the user.

## Transactions and recovery

- Create and update validate the note owner before writing.
- Note deletion removes note, review, and handwriting dependents in one transaction.
- Existing note Undo restores captured dependents in one transaction.
- Handwriting delete exposes a feature-local Undo action.
- Import validates the complete v3 bundle before opening a transaction.
- Import uses `add`, not overwrite semantics; any note or entry collision aborts the complete transaction.
- Recognition failure, no-result, and save failure preserve the current drawing.
- Closing a dirty dialog requires explicit discard confirmation.

## Export and import

### JSON

`myNote-kanji-export.json` is the lossless, versioned format. It contains notes, related handwriting entries, export timestamp, and recognizer attribution.

### Human-readable

`myNote-kanji-export.md` contains confirmed characters, note IDs, entry IDs, recognizer attribution, and SVG previews derived from normalized vectors. It intentionally excludes canonical note bodies to avoid duplicating note content in the supplementary report.

### Restore

Only an exact v3 JSON bundle with valid attribution, unique note/entry IDs, valid entries, and resolvable note relationships is accepted.

## Automated evidence

CI covers:

- strict entry validation and size bounds;
- deterministic local recognition for all eight canonical fixtures;
- latency and template-payload bounds;
- application-service and UI/storage boundary contracts;
- IndexedDB v2→v3 additive migration;
- CRUD, orphan prevention, invalid-record isolation, cascade delete, and undo restore;
- strict export validation and atomic import;
- Chromium mouse workflow, reload durability, edit, delete/undo, search, export, import, safe import failure, and 200% zoom visibility;
- zero network requests during recognition.

## Manual release evidence

`UNKNOWN — REQUIRES VALIDATION`: physical Windows 11 + mouse workflow, OS-level 200% display scaling, and subjective handwriting usability must be reviewed manually before merge. The PR remains draft until that review is explicitly approved.
