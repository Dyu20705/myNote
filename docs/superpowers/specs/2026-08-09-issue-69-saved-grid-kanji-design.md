# Issue #69 Saved-Grid Kanji Design

## Status and authority

This is a constraint-confirmation record for the owner-approved 2026-08-09 scope in GitHub issue #69. It does not reopen product design. Authority remains:

1. canonical persistence and lifecycle invariants;
2. the current issue #69 body and reconciliation comments;
3. accepted Figma node `43:343`;
4. runtime implementation and direct verification.

Recognition-era PR #83 remains historical compatibility evidence, not the current product contract.

## Goal

Replace the shipped `draw -> recognize -> select -> save` path with a bounded local vector canvas:

```text
open Draw Kanji
-> Pen / Marker / Eraser
-> Undo / Redo / Clear
-> save non-empty drawing + paperStyle:grid
-> reload / edit V2 / delete / export
```

No recognizer, candidate list, Unicode confirmation, remote service, or Japanese review state participates in a new write.

## Smallest implementation boundary

Keep the existing store, note-action boundary, application-service boundary, note-dependent transactions, and supplementary-entry region. Change only the Kanji entity union, its controller, export/import projections, and the Kanji dialog.

Do not change the database version. `kanjiInkEntries` already exists in IndexedDB v3 and can contain both record generations.

## Persisted record union

### Legacy V1

V1 remains a recognition-era record. Its required historical fields are validated, but reads and structured exports preserve cloneable unknown own data fields. It is never upgraded on read.

V1 is readable, grid-renderable, searchable by its already-confirmed `character`, deletable, restorable, and losslessly exportable/importable. It is read-only in the new editor because rewriting it as V2 would discard or reinterpret historical recognition metadata.

### Canvas V2

New and edited current-path records use exactly:

```js
{
  id,
  noteId,
  strokes: [{
    tool: "pen" | "marker",
    width: 0.008 | 0.024,
    points: [{ x, y, t }]
  }],
  paperStyle: "grid",
  createdAt,
  updatedAt,
  schemaVersion: 2
}
```

Coordinates are normalized to `[0, 1]`. Point time starts at `0`, is monotonic within a stroke, and is bounded to 600,000 ms. Existing bounds remain: 32 strokes, 256 points per stroke, 4,096 total points, and 262,144 serialized bytes. Edit history retains at most 100 committed draft states.

`eraser` is an interaction tool, not a persisted stroke tool. An eraser gesture removes intersecting canonical pen/marker strokes; Undo restores the previous canonical draft.

## Controller ownership

`core/kanjiInkController.js` owns:

- selected tool;
- pointer gesture assembly;
- eraser hit testing;
- bounded Undo/Redo snapshots;
- Clear as one undoable change;
- dirty/discard state;
- single-flight persist-before-success save and retry.

The UI owns only pointer coordinate/time adaptation and rendering. Save is available only for a non-empty valid draft. An untouched V2 edit closes cleanly.

## Application, persistence, search, and export

- `core/kanjiInkApplication.js` no longer injects or calls a recognizer.
- Storage dispatches validation by record `schemaVersion` and keeps the existing additive store and atomic note-dependent lifecycle.
- Search projects only the confirmed character of legacy V1 records. V2 contributes no guessed text.
- New structured exports use bundle schema 4 and preserve mixed V1/V2 entries. Existing exact schema-3 recognition exports remain importable.
- Human-readable export derives grid-backed SVG from vectors. V1 may display its stored character and recognition attribution; V2 is labelled `Kanji drawing` and never invents a character.

## Presentation

Accepted node `43:343` supplies the presentation contract:

- centered `900 x 594` desktop dialog, bounded by the viewport;
- `860 x 430` grid canvas;
- minimal header with Close;
- icon-first Pen, Marker, Eraser, Undo, Redo, Clear;
- Pen selected by default;
- icon-first primary Save drawing;
- accessible names and tooltips for every icon;
- concise live failure state, with no recognition/candidate region.

The exact exported Figma SVG assets are stored locally; runtime does not depend on expiring Figma URLs.

## Failure and lifecycle behavior

- Failed persistence keeps the exact draft, selected tool, undo/redo state, and retry intent.
- Dirty close uses the existing same-dialog discard confirmation.
- Pointer cancel and lost capture finalize or cancel one bounded gesture deterministically.
- Resize and device-pixel-ratio changes re-render normalized geometry without mutating it.
- Repeated open/close does not add dialog nodes, stylesheets, commands, or per-open global listeners.
- Malformed entries degrade locally without hiding or changing the owning note.

## Tests

Focused RED/GREEN coverage owns:

1. V1 unknown-field read/delete/restore/export/import preservation.
2. strict V2 tool/width/time/point/size bounds.
3. Pen/Marker drawing, Eraser, Undo/Redo/Clear, empty-save, dirty-close, and failed-save retry.
4. mixed-record storage and bundle compatibility.
5. no V2 Unicode search projection and no recognizer call path.
6. browser draw -> save -> reload -> edit -> delete/export, pointer cancellation, resize/DPR, focus, viewport, zoom, and repeated-open resources.

## Non-goals

- Recognition, OCR, candidate ranking, Unicode insertion, grading, dictionary lookup, general whiteboard features, shapes/layers, mobile/touch redesign, or Japanese V2 learning state.

## Rollback

Rollback is code-only and must remain database-v3 aware. It must not delete or rewrite V1 or V2 records. A rollback client may render V2 as an unsupported preserved entry, but it must not downgrade the database or claim data was saved when persistence failed.
