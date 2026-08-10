# myNote Performance Budget

This document defines the performance constraints used to prevent unmeasured latency, memory, and storage drift.

## Target budgets

| Operation | Target |
|---|---:|
| Worker search query | `< 20 ms` median on the representative medium dataset |
| Main-thread typing work | `< 8 ms` per frame |
| Warm local startup to interactive | `< 250 ms` |
| Autosave work | `< 50 ms` median |
| Long-session memory growth | Bounded; no unbounded increase over time |

These values are baseline targets, not unsupported guarantees. Benchmark reports must record environment, build mode, dataset shape, warm-up, sample count, statistic, and raw result location.

## Kanji saved-grid regression budgets

Issue #69 owns the current saved-grid direction. These are conservative automated regression tripwires for bounded work, not cross-device product guarantees.

| Operation | Deterministic fixture | Threshold |
| --- | --- | ---: |
| Validate and codec-serialize one maximum-capacity V2 drawing | 32 strokes, one 256-point stroke, 4,096 total points; 1 exact combined-operation warm-up plus 5 measured samples | each sample `< 1,000 ms`; canonical entry `≤ 262,144 bytes`; codec envelope `≤ 8 MiB` |
| Load and reload one note context | 65 valid minimal V2 entries; 2 synchronization calls | each call `< 2,000 ms` |
| Render the initial saved-drawing window | the same 65-entry note with Details open | exactly 64 previews and `< 5,000 ms`; older-entry disclosure visible |

The canonical entry and tagged codec envelope are different representations and therefore have different byte limits. The exact command is `npx --no-install playwright test tests/e2e/kanji-resource.spec.mjs --project=chromium`. It runs the Playwright Chromium project against the repository's static source server; the 2026-08-10 focused run was on Windows, while CI hardware and native browser builds remain environment-specific. The test writes its bounded codec, context-load, and preview duration arrays to the `kanji-resource-evidence` annotation and command output so each run carries its own raw audit trail. Machine-specific timing samples are not normative history and results from materially different machines are not directly comparable.

## Runtime constraints

- Heavy search and indexing work runs in a worker.
- Editing does not rerender the complete note list.
- Lists with at least 500 notes use virtualization.
- Normal editing uses incremental index and backlink updates rather than full rebuilds.
- History, caches, listeners, worker messages, and rendered state remain bounded.
- Performance changes must not weaken persistence, recovery, security, or accessibility contracts.

## Measurement sources

The runtime metrics surface tracks:

- Render latency.
- Search latency.
- Worker latency.
- Autosave latency.
- Available memory information where the browser exposes it.

Additional benchmark work should separate main-thread time, worker time, persistence time, and total user-perceived latency.

## Regression policy

- Do not merge a related change when a measured budget regression is unexplained.
- Fix correctness, data-integrity, and performance regressions before expanding the affected feature surface.
- Every optimization claim requires a reproducible command and measured before/after evidence.
- Results from materially different environments are not treated as equivalent.

## Representative scenarios

- 100, 1,000, and 10,000 note collections.
- Short, medium, and long note bodies, including fenced code and links.
- Repeated search bursts.
- Rapid note switching and editing.
- Autosave across visible, hidden, and restored tab states.
- Long sessions that exercise history, indexing, and listener cleanup.

## Known limitations

- Fixed-row virtualization may be inaccurate for highly variable row heights.
- `performance.memory` is browser-specific and may be unavailable.
- A checked-in benchmark suite is still required before the general non-Kanji targets above can become enforced release thresholds; the Kanji section already has focused checked-in regression tripwires.
- The Playwright 720×450 CSS viewport is equivalent responsive-layout evidence only. Native browser 200% zoom, OS-level display scaling, and physical Windows pen input remain `UNKNOWN — REQUIRES VALIDATION`.
