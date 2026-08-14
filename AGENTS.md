# Repository Execution Instructions

## Delivery role

The repository uses the asymmetric AI delivery model defined in:

```text
docs/engineering/AI_DELIVERY_MODEL.md
```

For Codex and other implementation agents, the role is implementation-only.

Duy + ChatGPT own product intent, architecture, per-issue design, roadmap sequencing, and review. An implementation agent translates one accepted design into tested code and opens one PR to `dev`, then stops.

## Required reading

Before any implementation task, read these files in order:

1. `AGENTS.md`
2. `docs/ARCHITECTURE.md`
3. `docs/INVARIANTS.md`
4. `docs/engineering/AI_DELIVERY_MODEL.md`
5. the authoritative `docs/design/issues/<issue>-*.md` referenced by the active issue
6. the implementation plan referenced by that design, when present
7. any additional exact repository/Figma evidence explicitly referenced by the design

Do not begin runtime implementation when:

- the issue does not reference an accepted authoritative design;
- the design says the package is blocked;
- a dependency is unmerged/unaccepted;
- another conflicting runtime package is already `status/in-progress`;
- a material design/invariant conflict exists.

## Source-of-truth order

Use this authority order:

```text
1. docs/ARCHITECTURE.md + docs/INVARIANTS.md
2. accepted architecture/product decisions referenced by the design
3. docs/design/issues/<issue>-*.md
4. approved implementation plan referenced by the design
5. GitHub issue tracking metadata
6. accepted Figma nodes referenced by the design
7. runtime implementation
8. automated and recorded manual evidence
```

The GitHub issue is coordination state after an authoritative design is linked. Do not treat older prose in issue history as permission to contradict the accepted design.

Figma is presentation and interaction evidence only when the design references it. Figma is not a second owner for persistence, search, command dispatch, review scheduling, recognition, canonical note state, or drawing persistence.

## Branch and PR contract

Implementation work uses:

```text
dev
  ↑ PR target
issue/<number>-<bounded-name>
```

Rules:

- branch from the current `dev` head;
- one issue = one bounded branch = one PR;
- PR target is `dev`;
- do not push implementation directly to `dev`;
- do not implement directly on `main`;
- do not merge the PR;
- do not begin another issue after opening the PR.

`main` promotion is an owner/release decision outside the implementation-agent role.

## Architecture constraints

- Keep `app.js` as the single browser composition root.
- Preserve dependency direction: `UI → Actions → State → Core → Persistence`.
- Use vanilla HTML, CSS, and ES modules unless an accepted design explicitly changes that contract.
- UI modules must not open IndexedDB directly.
- Canonical writes complete before state, history, derived indexes, or success presentation.
- Parser metadata, search, backlinks, review scheduling, commands, persistence, and drawing lifecycle retain one owner each.
- Ordinary Notes and Japanese Notes share the accepted shell/runtime boundaries.
- Do not create a second viewport/presentation-state authority merely to handle layout.
- Mobile/tablet navigation, touch-first behavior, virtual keyboards, native wrappers, and PWA scope are excluded unless a later accepted design explicitly changes the product boundary.

## Implementation-agent prohibitions

Do not:

- redesign the feature;
- expand the issue;
- reprioritize the backlog;
- create downstream/future work packages;
- mutate Figma;
- invent new acceptance criteria;
- change roadmap authority;
- perform unrelated refactoring;
- introduce speculative abstractions;
- change schema, dependencies, framework, or canonical ownership unless explicitly authorized by the design;
- weaken a test or substitute a looser proxy for an acceptance requirement;
- claim native browser/OS evidence from an emulation that the design labels only as supplemental.

If satisfying the design requires any prohibited action, stop and report the exact conflict. `UNKNOWN` means stop and report, not guess.

## Test-driven workflow

For every behavior change:

1. Add the focused failing assertion required by the design/plan.
2. Run it and record the expected RED evidence.
3. Implement the minimum bounded change.
4. Run the focused test and record GREEN.
5. Run relevant regression packages.
6. Run the complete verification gate.
7. Inspect the final diff against design scope and ownership boundaries.
8. Open one PR to `dev` and stop.

Required final commands:

```sh
npm ci
npx --no-install playwright install --with-deps chromium
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

No command may be reported as passing unless it actually executed successfully in the declared environment.

## UI verification

For UI work, the authoritative issue design defines the exact supported matrix. Current desktop baseline contracts commonly include:

- `1024×768`;
- `1280×720`;
- `1440×900`;
- keyboard and desktop mouse;
- long English/Japanese/code content;
- no horizontal document overflow;
- visible focus and logical focus return;
- draft/query/filter/review preservation where relevant;
- bounded transient surfaces;
- native 200% browser zoom only when directly evidenced or explicitly left `UNKNOWN — REQUIRES VALIDATION`.

Do not award native-environment claims from screenshots or synthetic CSS viewport reduction alone.

## Pull-request evidence

Every implementation PR must include:

- issue number;
- authoritative design path;
- implementation-plan path when present;
- base/head SHA;
- changed files;
- RED/GREEN evidence;
- focused and full verification results;
- acceptance-criteria mapping;
- security/privacy review;
- performance/resource review;
- accessibility review;
- compatibility review;
- migration impact;
- rollback boundary;
- remaining explicit unknowns.

After opening the PR, stop and wait for Duy + ChatGPT review.

## Completion claims

An implementation agent may say the implementation PR is ready for review only when the documented implementation boundary is complete and the required verification has actually passed.

The agent must not claim the GitHub issue, milestone, `dev`, or `main` release is complete. Those are review/integration decisions owned by Duy + ChatGPT and current repository governance.