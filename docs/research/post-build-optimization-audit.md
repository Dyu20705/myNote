# Post-Build Optimization, Resource, and Reliability Baseline Audit

## 1. Executive Summary

This audit establishes the post-build baseline for `myNote` following the completion and integration of Milestone M3 (Japanese V2, #63 / PR #117).

All milestone delivery goals across M0 (Governance), M1 (Reliable Core), M2 (Desktop Daily Driver), and M3 (Workflows / Japanese V2) are fully integrated into `dev` and verified against the complete repository gate.

### Key Metrics Summary

| Area | Measured Baseline | Target Budget (`docs/PERFORMANCE_BUDGET.md`) | Status |
|---|---|---|---|
| **Production Runtime Payload** | **389.58 KiB** (total uncompressed) | `< 2,048 KiB` | **PASS (Exceeds budget)** |
| **Production External Dependencies** | **0 dependencies** (100% pure ES modules) | `0 runtime dependencies` | **PASS (Zero supply chain risk)** |
| **Network Isolation** | **100% offline-first / local-only** | No remote telemetry/CDNs | **PASS** |
| **Worker Search Query (100 notes)** | Median: `0.026 ms`, p95: `0.146 ms` | `< 20 ms` | **PASS** |
| **Worker Search Query (1,000 notes)** | Median: `0.152 ms`, p95: `0.342 ms` | `< 20 ms` | **PASS** |
| **Worker Search Query (10,000 notes)**| Median: `1.573 ms`, p95: `2.453 ms` | `< 20 ms` | **PASS (12x faster than budget)** |
| **Search Rebuild / Indexing Throughput** | `0.018 – 0.030 ms` per note (`40,000+ notes/sec`) | Bounded | **PASS** |
| **Kanji Max Drawing Codec Serialization** | Median: `54.3 ms` (sample range `52.3 – 59.0 ms`) | `< 1,000 ms` | **PASS (18x faster than budget)** |
| **Kanji Note Context Load (65 entries)** | Median: `5.45 ms` (sample range `4.6 – 6.3 ms`) | `< 2,000 ms` | **PASS (360x faster than budget)** |
| **Kanji Preview Projection (64 drawings)** | `155 ms` | `< 5,000 ms` | **PASS (32x faster than budget)** |
| **V2 Card Compilation** | `0.021 ms` per item (`47,000+ items/sec`) | Bounded | **PASS** |
| **Scheduler State Calculation** | `0.005 ms` per card (`200,000+ cards/sec`) | Bounded | **PASS** |
| **Repository Verification Gate** | 100% PASS (1 content, 239 unit, 100 integration, 117 E2E) | All suites green | **PASS** |

---

## 2. Target Identification & Environment

- **Repository**: `https://github.com/Dyu20705/myNote`
- **Target `dev` Base Commit SHA**: `8220cd74222a92dae8d6e6118b71174669b3b05c`
- **Audit Branch**: `issue/118-optimization-audit`
- **Runtime Environment**: Node.js `v24.18.1`, Linux x86_64, Chromium headless (Playwright `1.62.0`)
- **Governing Issues**: #93 (Post-build optimization parent), #118 (Post-build audit package), #20 (MVP delivery roadmap)

---

## 3. Architecture & Ownership Mapping

The repository adheres strictly to the canonical architectural direction:
```text
UI → Actions → State → Core → Persistence
```

### Logical & Data Store Ownership (IndexedDB Version 5)

| Store Name | Canonical Owner | Key Path | Primary Index | Invariants & Semantics |
|---|---|---|---|---|
| `notes` | Note Lifecycle / Core Model | `id` | `updatedAt`, `pinned`, `archived` | Plain text / markdown notes. Atomic write. |
| `studyReviews` | V1 Legacy Review Model | `noteId` | `nextReviewAt`, `notebookType`, `status` | Preserved for rollback and V1 UI. Never deleted during migration. |
| `kanjiInkEntries` | #69 Kanji Drawing | `id` | `noteId`, `updatedAt` | Note-authoring vector drawings. Independent from review state. |
| `learningItems` | Japanese V2 Core (#105) | `id` | - | Structured Japanese knowledge (`vocabulary`, `kanji`, `grammar`). |
| `cards` | Japanese V2 Core (#105) | `id` | `itemId`, `[itemId, skill]` (unique), `status` | Retrieval targets. Exactly one per item/skill pair. |
| `reviewStates` | Scheduler Adapter (#105) | `cardId` | `due`, `state` | Current scheduler state (`new`, `learning`, `review`, `relearning`). |
| `reviewLogs` | Japanese V2 Core (#105) | `id` | `[cardId, reviewedAt]`, `reviewedAt` | Append-only immutable review evidence. |
| `studyArtifacts` | Japanese V2 Core (#116) | `id` | `noteId` | Study artifacts (`output`, `planner`). Never compiled into cards. |

---

## 4. Performance & Scale Benchmark Evidence

### 4.1. Static Runtime Payload & Distribution

Total uncompressed runtime payload across the entire application is **389.58 KiB**:

```text
index.html:                           16.55 KiB
style.css:                            (embedded/shared)
app.js:                               42.51 KiB
japaneseApp.js:                       25.08 KiB
Core Models & Parsers:                28.21 KiB
Core Storage & Adapters:              45.64 KiB
Core Japanese V2 Infrastructure:      45.65 KiB
Core Kanji Drawing & Projection:      64.76 KiB
UI Controllers & Views:               75.05 KiB
Web Worker (search.worker.js):         7.47 KiB
-----------------------------------------------
TOTAL RUNTIME PAYLOAD:               389.58 KiB
```

### 4.2. Worker Search Indexing & Query Latency

Benchmarked across 3 dataset sizes (50 representative queries per scale):

| Dataset Scale | Rebuild / Indexing Time | Per-Note Index Rate | Query Median Latency | Query p95 Latency | Budget Target |
|---|---|---|---|---|---|
| **100 notes** | `2.97 ms` | `0.030 ms/note` | `0.026 ms` | `0.146 ms` | `< 20 ms` |
| **1,000 notes** | `18.36 ms` | `0.018 ms/note` | `0.152 ms` | `0.342 ms` | `< 20 ms` |
| **10,000 notes** | `228.95 ms` | `0.023 ms/note` | `1.573 ms` | `2.453 ms` | `< 20 ms` |

### 4.3. Kanji Saved-Grid Drawing Resource Evidence

Measured via Playwright test runner against `tests/e2e/kanji-resource.spec.mjs`:

- **Maximum V2 Drawing Codec Serialization** (32 strokes, 4,096 points):
  - Sample measurements: `[54.3, 59.0, 55.7, 52.7, 52.3] ms`
  - Median: `54.3 ms` (Budget: `< 1,000 ms` — **18x headroom**)
- **Context Load & Reload** (65 minimal V2 entries):
  - Sample measurements: `[6.3, 4.6] ms`
  - Median: `5.45 ms` (Budget: `< 2,000 ms` — **360x headroom**)
- **Saved-Drawing Projection Preview Rendering** (64 previews rendered simultaneously):
  - Measured duration: `155 ms` (Budget: `< 5,000 ms` — **32x headroom**)

### 4.4. Japanese V2 Card Compiler & Scheduler Adapter Throughput

- **Card Compilation** (1,000 vocabulary items generating 2,000 cards):
  - Total duration: `20.90 ms` (`0.021 ms` per item / ~47,800 items/sec)
- **Scheduler State Calculation** (2,000 card rating updates):
  - Total duration: `10.17 ms` (`0.005 ms` per card / ~196,600 cards/sec)

---

## 5. Reliability, Security, and Dependency Audit

1. **Supply Chain Risk**:
   - Zero runtime production dependencies (`"dependencies": {}`).
   - Development dependencies are strictly limited to testing (`eslint`, `@playwright/test`, `fake-indexeddb`).
2. **Network Isolation**:
   - Zero outbound or inbound network connections during runtime execution.
   - All persistence, parsing, search indexing, and scheduling occur locally in-browser via IndexedDB and Web Workers.
3. **Data Safety & Rollback Invariants**:
   - Non-destructive V1 migration: original V1 records in `studyReviews` are preserved.
   - Atomic transactions: multi-store mutations commit or abort atomically via IndexedDB transactions.
   - Export/Import integrity: schema version, entity IDs, and referential relations (`Card → Item`, `ReviewState → Card`, `ReviewLog → Card`, `StudyArtifact → Note`) are validated before any write occurs.

---

## 6. Classified Findings and Action Plan

| Finding ID | Domain | Description | Severity | Classification | Rationale / Mitigation |
|---|---|---|---|---|---|
| **F-01** | Scale / Search | Search worker rebuild on dataset update | P3 | `retain` | Rebuilding 10,000 notes takes only 228 ms; incremental updates already handle normal note edits without full rebuilds. |
| **F-02** | UI / List | List virtualization boundary at 500 notes | P3 | `retain` | DOM virtualization kicks in at 500 notes (`ui/list.js`), keeping memory and frame rates stable. |
| **F-03** | Storage | IndexedDB transaction concurrency across tabs | P3 | `retain` | Database version upgrade handling (`DATABASE_UPGRADE_BLOCKED` error) and defensive copies prevent corruption. |
| **F-04** | Security | DevDependency `brace-expansion` vulnerability | P3 | `retain` (tooling-only) | Development tooling only; does not touch production bundle or runtime code. |
| **F-05** | Benchmark | Checked-in automated performance tripwires in CI | P2 | `optimize` / `retain` | Current E2E suite (`kanji-resource.spec.mjs`) already includes assertions on duration limits. Additional tripwires can be added incrementally. |

---

## 7. Recommendations for Milestone M4 Progression

1. **Maintain Architectural Simplicity**: The current zero-dependency, pure ES module architecture has proven to deliver performance well exceeding all defined budgets (e.g. search query latency is 12x faster than target at 10,000 notes).
2. **No Speculative Framework Rewrites**: Avoid introducing virtual DOM frameworks, WebAssembly, or complex state managers that would increase bundle size and complexity without meaningful real-world latency gains.
3. **Gate Status**: Milestone M3 is complete and verified. Milestone M4 audit is established.
