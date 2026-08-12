# Issue #90 Board Projection Foundation Implementation Plan

> **For implementers:** Use the repository's subtask-driven or plan-execution workflow to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the pure presentation projection that partitions existing workspace/search result order into stable `PINNED` and `NOTES` board sections without implementing the board UI.

**Architecture:** `ui/notePresentation.js` remains a presentation-only module. The new helper consumes the canonical `notesById` map and upstream `orderedIds`, returns fresh ID-only section descriptors, and does not sort, filter, mutate state, or access the DOM. Search/workspace coordination remains the ordering authority.

**Tech Stack:** Node.js 22, vanilla JavaScript ES modules, Node test runner, ESLint, npm, Playwright release gate.

## Global Constraints

- Start from `main` SHA `be84fc89180b3874506e7c87aa8339a5c187cab8` on branch `UX/90`.
- Preserve `UI → Actions → State → Core → Persistence`; this slice changes presentation only.
- Keep `app.js` as the single browser composition root.
- Add no framework, router, component library, dependency, schema, persistence, search, filter, review, or scheduler owner.
- Use only `myNote` domain names; do not borrow competitor names.
- This is an incomplete #90 foundation and must not claim that the runtime board or overlay is implemented.
- Complete all local verification before the preparation agent's single initial push.
- Open one draft pull request for #90; the engineer may continue with later pushes on that same PR.

## File map

- Modify `ui/notePresentation.js`: own the pure `createNoteBoardSections` projection and bounded input validation.
- Modify `tests/unit/note-presentation.test.mjs`: specify partition order, stale-ID handling, immutability, and invalid-input behavior through the public export.
- Retain `../specs/2026-08-12-issue-90-board-projection-design.md`: approved design authority for this slice.

---

### Task 1: Add the board-section presentation projection

**Files:**
- Modify: `tests/unit/note-presentation.test.mjs`
- Modify: `ui/notePresentation.js`

**Interfaces:**
- Consumes: `createNoteBoardSections({ notesById: Map, orderedIds: Array })` arguments supplied by a future board renderer.
- Produces: `Array<{ id: "pinned" | "notes", label: "PINNED" | "NOTES", orderedIds: Array }>` with fresh descriptors and arrays.

- [ ] **Step 1: Write the failing public-seam test**

Append this test to `tests/unit/note-presentation.test.mjs`:

```js
test("createNoteBoardSections partitions upstream order without taking query ownership", async () => {
  const { createNoteBoardSections } = await loadModule();
  const notes = [
    Object.freeze({ id: "note-2", pinned: false }),
    Object.freeze({ id: "pinned-1", pinned: true }),
    Object.freeze({ id: "note-1", pinned: false }),
    Object.freeze({ id: "pinned-2", pinned: true }),
  ];
  const notesById = new Map(notes.map((note) => [note.id, note]));
  notesById.set("invalid", null);
  const originalEntries = [...notesById.entries()];
  const orderedIds = Object.freeze([
    "note-2",
    "pinned-1",
    "stale",
    "invalid",
    "note-1",
    "pinned-2",
  ]);

  assert.deepEqual(createNoteBoardSections({ notesById, orderedIds }), [
    { id: "pinned", label: "PINNED", orderedIds: ["pinned-1", "pinned-2"] },
    { id: "notes", label: "NOTES", orderedIds: ["note-2", "note-1"] },
  ]);
  assert.deepEqual([...notesById.entries()], originalEntries);
  assert.deepEqual(orderedIds, [
    "note-2",
    "pinned-1",
    "stale",
    "invalid",
    "note-1",
    "pinned-2",
  ]);
  assert.throws(() => createNoteBoardSections({ notesById: {}, orderedIds: [] }), {
    code: "NOTE_PRESENTATION_OPTIONS_INVALID",
    message: "NOTE_PRESENTATION_OPTIONS_INVALID",
  });
  assert.throws(() => createNoteBoardSections({ notesById, orderedIds: null }), {
    code: "NOTE_PRESENTATION_OPTIONS_INVALID",
    message: "NOTE_PRESENTATION_OPTIONS_INVALID",
  });
});
```

- [ ] **Step 2: Run the focused test and record RED**

Run:

```sh
node --test tests/unit/note-presentation.test.mjs
```

Expected: the five existing tests pass and the new test fails because `createNoteBoardSections` is not exported.

- [ ] **Step 3: Add the minimal pure implementation**

Add this export to `ui/notePresentation.js` after `deriveNotePreview` and before `createNoteCardPresentation`:

```js
export function createNoteBoardSections({ notesById, orderedIds } = {}) {
  if (!(notesById instanceof Map) || !Array.isArray(orderedIds)) {
    throw presentationError();
  }

  const pinnedIds = [];
  const noteIds = [];
  for (const id of orderedIds) {
    const note = notesById.get(id);
    if (!note || typeof note !== "object") {
      continue;
    }
    if (note.pinned === true) {
      pinnedIds.push(id);
    } else {
      noteIds.push(id);
    }
  }

  return [
    { id: "pinned", label: "PINNED", orderedIds: pinnedIds },
    { id: "notes", label: "NOTES", orderedIds: noteIds },
  ];
}
```

- [ ] **Step 4: Run focused GREEN and static checks**

Run:

```sh
node --test tests/unit/note-presentation.test.mjs
node --check ui/notePresentation.js
node --check tests/unit/note-presentation.test.mjs
npx --no-install eslint ui/notePresentation.js tests/unit/note-presentation.test.mjs
git diff --check
```

Expected: six tests pass, both syntax checks exit zero, ESLint reports no error, and the diff check is clean.

- [ ] **Step 5: Review the bounded diff**

Run:

```sh
git diff -- ui/notePresentation.js tests/unit/note-presentation.test.mjs
git status --short --branch
```

Confirm that no DOM renderer, CSS, application orchestration, persistence, Japanese, review, or dependency file changed.

- [ ] **Step 6: Commit the RED→GREEN slice**

Run:

```sh
git add -- ui/notePresentation.js tests/unit/note-presentation.test.mjs
git diff --cached --check
git commit -m "feat(ux): add note board section projection"
```

Expected: one focused implementation commit after the already committed design record.

---

### Task 2: Verify and publish the initial draft handoff

**Files:**
- Verify only: complete repository tree
- Publish: branch `UX/90` to `origin`

**Interfaces:**
- Consumes: committed `createNoteBoardSections` public seam and all repository release-gate scripts.
- Produces: one remote `UX/90` branch and the sole draft PR for issue #90.

- [ ] **Step 1: Install the locked dependency tree and Chromium**

Run:

```sh
npm ci
npx --no-install playwright install --with-deps chromium
```

Expected: both commands exit zero using Node.js 22 and the lockfile dependency versions.

- [ ] **Step 2: Run the complete release gate**

Run each command separately and retain its exit code and test counts:

```sh
npm run test:content
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
git diff --check
```

Expected: every command exits zero. Do not push or open a PR if any command fails.

- [ ] **Step 3: Audit scope and repository state**

Run:

```sh
git status --short --branch
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
```

Expected changed paths:

```text
2026-08-12-issue-90-board-projection.md (implementation plan)
2026-08-12-issue-90-board-projection-design.md (approved specification)
tests/unit/note-presentation.test.mjs
ui/notePresentation.js
```

- [ ] **Step 4: Perform the preparation agent's single push**

Run exactly once after every preceding gate is green:

```sh
git push -u origin UX/90
```

Expected: remote tracking is established and no second push is performed by this preparation step.

- [ ] **Step 5: Open the sole draft pull request for #90**

Create one draft PR targeting `main` with title:

```text
feat(ux): establish issue 90 board projection foundation
```

The PR body must record:

```markdown
## Relationships

- Parent: #90
- Depends on: #69 merged in #91
- Blocks after completion: #71
- This is the sole draft PR for #90; subsequent work continues here.

## Scope

- Add the pure `createNoteBoardSections()` presentation seam.
- Preserve upstream search/workspace order while grouping `PINNED` and `NOTES`.
- Ignore stale IDs and preserve caller inputs.
- Include the approved design and implementation plan.

## Explicitly incomplete

This initial handoff does not implement board DOM/CSS, centered overlays, context
preservation, Japanese Filter A/Review presentation, cheatsheet migration, or browser
acceptance evidence. It does not close #90.

## Verification

Include the fresh RED failure, focused GREEN count, and every full release-gate result
from this execution.

## Risk and rollback

This is a pure presentation projection with no schema or persistence change. Rollback
removes the helper, its test, and planning records without touching canonical data.
```

Expected: one draft PR URL. Do not use `Closes #90` because the issue remains incomplete.

- [ ] **Step 6: Hand off the next engineering slice**

Tell the engineer to continue on branch `UX/90` and the same draft PR with this next
bounded order:

```text
board renderer
→ centered create/edit overlay
→ query/scroll/focus preservation
→ Japanese Filter A and compact Review entry
→ cheatsheet, browser regressions, and final #90 evidence
```

The next engineer must preserve the one-PR contract and may push later commits to the
existing branch/PR.
