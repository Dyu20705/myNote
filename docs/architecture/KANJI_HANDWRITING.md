# Kanji saved-grid architecture

Issue: #69

Scope: M2 desktop-first mouse/pen saved-grid drawing

Presentation authority: accepted Figma node `43:343`

The 2026-08-09 owner decision replaced runtime handwriting recognition with a saved-grid vector canvas. Recognition, OCR, candidates, Unicode confirmation, and remote services are not part of the current write path.

## User flow

1. Open **More actions → Add Kanji handwriting** for the active note.
2. Draw on the grid with Pen or Marker; Eraser removes intersecting strokes.
3. Use bounded Undo, Redo, or Clear as needed.
4. Save a non-empty valid drawing only after IndexedDB persistence succeeds.
5. Reload, edit a V2 drawing, delete/undo, or export it from the supplementary entry surface.

The accepted desktop dialog is a viewport-bounded `900 × 594` surface with an `860 × 430` grid canvas, icon-first tools with accessible names and tooltips, Pen selected by default, and a concise live failure state. It has no recognition or candidate region. Mobile/touch redesign remains out of scope.

## Module boundaries

```text
ui/kanjiInkView.js
ui/kanjiInkImportCommand.js
        │
        ▼
core/kanjiInkApplication.js
        ├── core/kanjiInkController.js
        ├── core/kanjiInkEntry.js
        ├── storage adapter
        ├── V1-only search projection
        └── mixed-record export / import
```

The UI adapts pointer coordinates/times and renders state. It imports the application service and domain limits, but never opens IndexedDB. The controller owns tools, normalized geometry, eraser hit testing, bounded history, dirty/discard state, and single-flight persist-before-success save/retry. The application service owns database-handle lifetime and closes handles in `finally`.

No module in this feature performs a network request, loads a remote model/dataset, or sends handwriting off-device.

## Database and persisted record union

`myNoteDB` remains at IndexedDB version `3`. The additive `kanjiInkEntries` store remains unchanged with key path `id` and indexes `noteId` and `updatedAt`; it may contain both record generations.

### Legacy V1 compatibility

V1 is the historical recognition-era record containing a confirmed `character`, vector `strokes`, `revision`, and recognizer metadata. Reads validate its required historical fields while preserving cloneable unknown own data fields. V1 is never upgraded on read or rewritten as V2.

V1 remains readable, grid-renderable, searchable by its already-confirmed character, deletable, restorable, and losslessly exportable/importable. It is read-only in the current editor because rewriting it would discard or reinterpret historical metadata.

### Saved-grid V2

New records and current-path edits use this exact shape:

```js
{
  id: string,
  noteId: string,
  strokes: Array<{
    tool: "pen" | "marker",
    width: 0.008 | 0.024,
    points: Array<{ x: number, y: number, t: integer }>
  }>,
  paperStyle: "grid",
  createdAt: ISO-8601 string,
  updatedAt: ISO-8601 string,
  schemaVersion: 2
}
```

V2 contains no Unicode character, recognizer provenance, candidate data, parser metadata, image, base64 payload, or Markdown vector payload. Coordinates are normalized to `[0, 1]`; each stroke starts at `t: 0`, and time is monotonic within that stroke. Eraser is an interaction tool and is never persisted.

### Resource bounds

| Limit | Value |
| --- | ---: |
| Strokes per entry | 32 |
| Points per stroke | 256 |
| Total points per entry | 4,096 |
| Stroke duration | 600,000 ms |
| Serialized entry size | 262,144 bytes |
| Committed draft history states | 100 |
| Entries projected into search | 128 |
| Export notes / entries | 50,000 each |
| Import file size | 8 MiB |

Malformed, hostile, oversized, orphaned, and duplicate records fail before durable mutation where possible. Invalid persisted entries are isolated and reported rather than silently repaired.

## Search, transactions, and recovery

- Canonical note Markdown remains unchanged; handwriting is supplementary data.
- Search projects only the confirmed character stored in legacy V1 records. V2 contributes no guessed text.
- Create and update validate the note owner before writing.
- Note deletion removes the note, review, and handwriting dependents in one transaction; Undo restores the captured valid dependents atomically.
- Handwriting deletion has feature-local Undo.
- Import validates the complete bundle before durable mutation and uses `add`; any note or entry collision aborts the complete transaction.
- Save is single-flight. A failed save keeps the exact draft, selected tool, Undo/Redo state, and retry intent; success is not shown before persistence completes.
- Dirty close uses the same-dialog discard confirmation. Pointer cancellation/lost capture ends one bounded gesture deterministically.
- Resize and device-pixel-ratio changes re-render normalized geometry without mutating canonical strokes.

## Export and import

New `myNote-kanji-export.json` bundles use schema `4` and preserve mixed V1/V2 entries. Exact historical schema-3 recognition bundles remain importable and may contain only V1 entries. The top-level recognizer attribution remains in the bundle contract for schema-3 compatibility; it does not imply recognition of V2 drawings.

`myNote-kanji-export.md` renders grid-backed SVG from normalized vectors. V1 may show its stored character and historical attribution. V2 is labelled `Kanji drawing` and never invents a character. Canonical note bodies are not duplicated in this supplementary report.

## Verification and rollback

Automated coverage owns strict V1/V2 validation, V1 unknown-field preservation, mixed-record CRUD/delete/restore/import/export, V1-only search projection, Pen/Marker/Eraser/history behavior, empty-save and failed-save retry, database v2→v3 migration, atomic lifecycle failure, and the browser draw/save/reload/edit/delete/export path. Runtime evidence must also cover focus return, resize/DPR, required desktop viewports, 200% browser zoom, no horizontal document overflow, repeated-open resource cleanup, and no recognizer call path.

Physical Windows 11 mouse/pen usability and OS-level 200% display scaling remain `UNKNOWN — REQUIRES VALIDATION` until recorded manual evidence exists.

Rollback is code-only and must remain database-v3 aware. It must preserve both V1 and V2 records without deletion, rewrite, or downgrade. A rollback client may expose V2 as an unsupported preserved entry; it must not claim a save succeeded when persistence failed.
