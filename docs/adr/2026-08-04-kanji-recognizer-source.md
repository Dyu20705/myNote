# ADR: Project-owned bounded Kanji recognizer

Date: 2026-08-04

Issue: #69

Status: Accepted for the M2 handwriting MVP

## Context

The handwriting workflow requires a real local recognition path, deterministic candidate ordering, no runtime network access, bounded payloads, reproducible fixtures, and clear redistribution rights for every code and data asset.

The issue lists third-party recognizers and browser APIs as evaluation candidates. Adopting any external recognizer would require an independent audit of both implementation code and bundled pattern/data provenance. A source-code license alone does not establish that every redistributed reference pattern is compatible with this repository.

The first release does not require universal Japanese handwriting coverage. It requires an honest, useful, deterministic path for a disclosed first-release set.

## Decision

Implement a project-owned geometric template recognizer with no third-party code, model, dataset, CDN, telemetry, dynamic loading, or network request.

The first-release set is:

```text
人 入 八 大 犬 火 木 本
```

Why this set:

- it matches the accepted Figma candidate examples;
- it exercises two through five strokes;
- it includes visually related distractors;
- it allows deterministic fixtures and bounded performance measurement;
- all templates are authored directly in this repository as normalized vector paths.

The adapter returns at most eight unique candidate characters and never persists or auto-selects the highest-ranked result. The user must select one candidate explicitly.

The recognizer identifies itself as:

```text
engineId: mynote-geometric-template
engineVersion: 1.0.0
datasetVersion: mynote-kanji-mvp-1
```

## Adopt / adapt / reject record

| Candidate | Decision | Reason |
| --- | --- | --- |
| Project-owned normalized geometric templates | Adopt | Zero external license/provenance ambiguity, deterministic, offline, bounded, testable |
| Third-party JavaScript recognizer or fork | Reject for M2 | Requires a separate code-and-data provenance audit and increases bundle/supply-chain scope |
| Evaluation-only incomplete recognizer/data | Reject for M2 | Coverage and redistribution obligations would become release blockers |
| Browser handwriting API | Reject as dependency | Model availability and browser/platform behavior are not deterministic repository-controlled contracts |
| No-recognizer fallback | Retain | UI exposes an explicit recoverable unsupported/error state without losing strokes |

This ADR does not claim that external candidates are unsafe or incorrectly licensed. It records that they are unnecessary for the bounded M2 outcome and therefore are not imported.

## Algorithm boundary

1. Validate and defensively clone normalized strokes.
2. Normalize the drawing to its own bounding box.
3. Resample each stroke to a fixed number of points.
4. Derive per-stroke geometry: path points, centroid, start/end direction, and relative length.
5. Compare against every local template with stroke-count, centroid, direction, and path-distance penalties.
6. Sort by ascending distance, then stable character order.
7. Return at most eight plain `{ character, score }` records.

Recognition runs asynchronously through the controller so stale results can be rejected by request token even though the current implementation is CPU-local.

## Coverage statement

The M2 recognizer supports only the eight disclosed characters. It is not Japanese OCR, a handwriting grader, stroke-order tutor, or general Kanji recognition engine. Drawings outside the set may produce low-confidence candidates or no result. The UI and documentation must state this boundary.

A future expansion requires a new ADR covering template provenance, fixture capture, measured quality, bundle cost, and migration compatibility.

## Consequences

Positive:

- no external dependency or attribution file is required;
- no runtime request can be made by the recognizer;
- deterministic fixtures can be committed safely;
- recognition cost and memory are bounded;
- rollback does not strand third-party assets.

Negative:

- character coverage is deliberately narrow;
- geometric matching cannot provide universal handwriting accuracy;
- expanding coverage requires authored templates and new fixtures;
- physical Windows mouse validation remains a release-gate activity.

## Verification

The repository must include tests for:

- every supported template returning itself in top-1 for its canonical fixture;
- stable top-8 ordering for identical input;
- visually related distractors;
- malformed and oversized stroke rejection;
- no-result behavior;
- request-token stale suppression;
- zero network activity during recognition;
- initialization, recognition latency, and template payload size.

## Rollback

Reverting the feature removes recognizer use but retains IndexedDB v3 awareness so existing `kanjiInkEntries` records are preserved and ignored rather than deleted or downgraded.
