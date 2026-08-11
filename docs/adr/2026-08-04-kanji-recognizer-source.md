# ADR: Project-owned bounded Kanji recognizer

Date: 2026-08-04

Issue: #69

Status: Superseded on 2026-08-09 by the owner-approved saved-grid canvas decision

## Historical decision

The original M2 design selected a project-owned geometric template recognizer for eight disclosed characters. It avoided third-party code, datasets, browser handwriting APIs, network requests, telemetry, and dynamic loading. Recognition required explicit candidate selection and stored recognizer identity plus the selected rank in V1 `kanjiInkEntries` records.

That decision produced historical V1 data and compatibility contracts. It is no longer runtime product behavior.

## Superseding decision

The 2026-08-09 issue-owner decision replaced recognition with the accepted saved-grid canvas at Figma node `43:343`.

- New and edited current-path records are exact schema-V2 saved-grid vectors.
- V2 stores Pen/Marker geometry and `paperStyle: "grid"`; it stores no character, recognizer, candidate, image, parser metadata, or Markdown payload.
- The recognizer module, fixtures, metrics, and runtime call path are removed.
- The current feature has no network path and does not load a model or dataset.
- Search receives only an already-confirmed character from historical V1 records; V2 contributes no Unicode projection.

## Historical data compatibility

V1 remains a supported read contract, not a current write contract. Required historical fields are validated, cloneable unknown own fields are preserved, and records are never upgraded on read. V1 remains readable, renderable, searchable by its stored character, deletable/restorable, and losslessly exportable/importable, but it is read-only in the V2 editor.

`myNoteDB` remains version `3`, and `kanjiInkEntries` continues to store both versions. New JSON exports use bundle schema `4` for mixed V1/V2 records. Exact historical schema-3 recognition bundles remain importable. Compatibility attribution in those bundle envelopes does not authorize or imply recognition for V2.

## Consequences

- Recognition quality, candidate ordering, supported-character coverage, and recognition latency are no longer release contracts.
- Saved-grid geometry, strict bounds, persist-before-success behavior, retry preservation, mixed-version durability, and no invented Unicode are release contracts.
- No third-party recognizer license or dataset provenance is required for the current runtime.
- Removing the dead recognizer does not permit deleting or rewriting V1 records.

## Rollback

Rollback is code-only and must remain IndexedDB-v3 aware. It must preserve both V1 and V2 `kanjiInkEntries` without deletion, rewrite, or downgrade. A rollback client may treat V2 as an unsupported preserved record, but it must not reinterpret V2 as recognition-era data.
