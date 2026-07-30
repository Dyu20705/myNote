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
- A checked-in benchmark suite is still required before these targets can become enforced release thresholds.