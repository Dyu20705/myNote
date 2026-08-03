# Repository Execution Instructions

## Required reading

Before any UX or UI task, read these files in order:

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `docs/INVARIANTS.md`
4. `docs/UX_DESIGN_HANDOFF.md`
5. `docs/UX_ISSUE_EXECUTION.md`
6. The complete GitHub issue body for the active work package

Do not begin implementation when the active issue is blocked by an unmerged dependency.

## Source-of-truth order

Use this authority order:

```text
Canonical domain and persistence contracts
→ merged GitHub issue decisions
→ accepted Figma specification
→ runtime implementation
→ automated and recorded manual evidence
```

Figma is the presentation and interaction specification. It is not a second owner for persistence, search, command dispatch, review scheduling, recognition, or canonical note state.

## Design access

The design file, canonical node identifiers, supported viewports, and acceptance boundaries are listed in `docs/UX_DESIGN_HANDOFF.md`.

For UI work:

- Use the Figma MCP server and request node-specific design context.
- Read variables and component metadata before translating a screen.
- Capture a screenshot of the exact target node before implementation.
- Compare the running application against the target at the required viewport after implementation.
- If design context cannot be retrieved, stop and report the missing access. Do not guess from memory or recreate a generic dark interface.
- Candidate frames are not implementation authority. Only frames marked `Accepted` may drive runtime implementation.

## Architecture constraints

- Keep `app.js` as the single browser composition root.
- Preserve dependency direction: `UI → Actions → State → Core → Persistence`.
- Use vanilla HTML, CSS, and ES modules. Do not introduce a UI framework or component-library dependency.
- UI modules must not open IndexedDB directly.
- Canonical writes complete before state, history, derived indexes, or success presentation.
- Search, backlinks, review scheduling, and command availability retain one owner each.
- Ordinary Notes and Japanese Notes share the accepted shell and runtime.
- Mobile/tablet navigation, touch-first behavior, virtual keyboards, native wrappers, and PWA scope are excluded.

## Work-package discipline

- Implement one GitHub issue per branch and pull request.
- Follow the dependency order in `docs/UX_ISSUE_EXECUTION.md`.
- Do not mix design-system, command, editor, Japanese, Kanji, resize, and recovery packages in one pull request.
- Add the smallest focused abstraction that gives one owner to the changed behavior.
- Do not perform unrelated refactoring.
- Preserve rollback boundaries and forward-compatible stored data.

## Test-driven workflow

For every behavior change:

1. Add a focused failing test.
2. Run it and record the expected failure.
3. Implement the minimum change.
4. Run the focused test.
5. Run the relevant unit/integration/browser package.
6. Run the complete release gate before opening a pull request.

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

## UI verification

Required desktop baselines:

- `1024×768`
- `1280×720`
- `1440×900`
- 200% browser zoom
- keyboard and desktop mouse

For every UI pull request:

- verify no horizontal document overflow;
- verify long English, Japanese, mixed, and code content;
- verify visible focus and logical focus return;
- verify disabled reasons and IME precedence where commands are involved;
- verify draft, active note, query/filter, and review state are not reset by presentation changes;
- attach before/after screenshots or Playwright evidence for changed routes.

## Safety and completion claims

Do not claim completion from screenshots alone. A work package is complete only when:

- its issue acceptance criteria are checked against direct evidence;
- focused and full verification are green;
- no unresolved P0/P1 finding remains;
- documentation matches the current tree;
- unsupported environments remain explicit unknowns;
- the pull request remains limited to one rollback-safe package.
