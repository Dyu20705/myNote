# Issue #72 State and Recovery UX Implementation Plan

> **For implementation workers:** Execute the tasks in order with TDD. Keep the branch bounded to #72, stop on architecture conflicts, and wait for owner review after the pull request is opened.

**Goal:** Implement the approved #72 state/recovery UX so healthy success is quiet, failures are local and actionable, first run remains truly empty, and existing note/Japanese/drawing owners remain authoritative.

**Architecture:** Add one pure `ui/statePresentation.js` mapper. Existing browser adapters consume bounded descriptors and render them into existing task-local surfaces. No new persistence, scheduler, search, drawing, command, notification, or retry owner is introduced.

**Tech Stack:** JavaScript ES modules, IndexedDB v3, Node 22, npm 11, Node test runner, Playwright 1.62, ESLint 10.

## Global Constraints

- Authoritative design: `docs/design/issues/072-state-recovery.md`.
- Accepted design commit: `bc748b189bb70a212feefe5d006ece0608727171`.
- Create `issue/72-state-recovery` from the current `origin/dev` at implementation start.
- Pull request target: `dev`.
- Keep #73 blocked.
- Maximum implementation commits: 8; this plan targets 6 feature commits plus at most 1 final test/docs commit.
- First run performs zero note writes until explicit create intent.
- Healthy note save, drawing save, Japanese rating success, filtering, note open, and refresh completion produce no success toast.
- IndexedDB stays version 3. No migration or canonical-record rewrite.
- No global notification queue, feedback bus, automatic retry loop, polling, background queue, or production failure-injection switch.
- Existing command registry remains the only command availability/disabled-reason owner.
- Existing Kanji controller/application remains the only drawing lifecycle owner.
- Existing Japanese scheduler/actions remain the only review-transition owner.
- Do not modify core persistence/search/scheduler/drawing/history owners unless an accepted RED proves the approved adapter boundary cannot satisfy the contract. If that occurs, stop for architecture review before editing those owners.
- Desktop evidence: 1024×768, 1280×720, 1440×900. Native 200% zoom is PASS only when directly validated in a real browser; otherwise record `UNKNOWN — REQUIRES VALIDATION`.
- Debug locally. Use one planned final remote push after the complete local gate is stable. Do not manually rerun unchanged CI failures.
- Repository text remains English-only and free of tool-specific provenance markers.

---

## File Map

### Create

- `ui/statePresentation.js` — pure state-to-presentation vocabulary.
- `tests/unit/state-presentation.test.mjs` — deterministic mapper contract.
- `tests/e2e/state-recovery.spec.mjs` — focused browser evidence and test-only failure injection.

### Modify as needed

- `package.json`
- `app.js`
- `index.html`
- `ui/list.js`
- `ui/editorChrome.js`
- `ui/kanjiInkView.js`
- `ui/japanese-filters.js`
- `japaneseApp.js`
- `styles.css`
- `editor.css`
- `japanese.css`
- `kanji-ink.css`
- `tests/integration/note-lifecycle.failure.test.mjs`
- `tests/integration/japanese-lifecycle.test.mjs`

### Forbidden by default

```text
core/storage.js
core/noteLifecycle.js
core/autosave.js
core/searchClient.js
core/search.worker.js
core/studyScheduler.js
core/studyReview.js
core/kanjiInkEntry.js
core/kanjiInkController.js
core/kanjiInkApplication.js
core/commandStack.js
core/history.js
```

---

### Task 1: Pure presentation vocabulary

**Files:**
- Create: `ui/statePresentation.js`
- Create: `tests/unit/state-presentation.test.mjs`
- Modify: `package.json`

**Produces:**

```js
presentBoardState(input)
presentNoteState(input)
presentDerivedState(input)
presentDrawingState(input)
presentJapaneseReviewState(input)
presentApplicationRecoveryState(input)
```

Every function returns a fresh bounded descriptor containing only:

```js
{
  kind,
  tone,
  message,
  announce,
  persistent,
  actionId,
}
```

No function accepts or returns `Error`, note content, search query text, review payloads, drawing vectors, callbacks, timers, or mutable retained state.

- [ ] **Step 1: Register the new unit file in `package.json`**

Add `tests/unit/state-presentation.test.mjs` exactly once to the explicit `test:unit` command.

- [ ] **Step 2: Write mapper RED tests**

Create `tests/unit/state-presentation.test.mjs` with these core assertions:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  presentApplicationRecoveryState,
  presentBoardState,
  presentDerivedState,
  presentDrawingState,
  presentJapaneseReviewState,
  presentNoteState,
} from "../../ui/statePresentation.js";

test("board state distinguishes empty from no-match", () => {
  assert.equal(presentBoardState({ total: 0, visible: 0, japanese: false }).kind, "empty");
  assert.equal(presentBoardState({ total: 3, visible: 0, japanese: false }).kind, "no-match");
  assert.equal(presentBoardState({ total: 0, visible: 0, japanese: true }).actionId, "create-japanese-note");
});

test("note state distinguishes edit, create, delete, and quiet success", () => {
  assert.deepEqual(
    presentNoteState({ dirty: false, phase: "idle", failureKind: "" }),
    { kind: "saved", tone: "success", message: "Saved", announce: "off", persistent: false, actionId: null },
  );
  assert.equal(presentNoteState({ dirty: true, phase: "idle", failureKind: "edit" }).actionId, "retry-save");
  assert.match(presentNoteState({ dirty: false, phase: "idle", failureKind: "create" }).message, /No note was added/);
  assert.match(presentNoteState({ dirty: false, phase: "idle", failureKind: "delete" }).message, /note is unchanged/);
});

test("derived degradation states that canonical data is saved", () => {
  const result = presentDerivedState({ searchUnavailable: true });
  assert.equal(result.kind, "degraded");
  assert.match(result.message, /^Saved\./);
});

test("drawing save failure preserves retry semantics while success is silent", () => {
  assert.equal(presentDrawingState({ status: "saved", errorCode: "" }).message, "");
  assert.equal(presentDrawingState({ status: "error", errorCode: "KANJI_SAVE_FAILED" }).actionId, "retry-drawing-save");
});

test("rating failure says the same item is unchanged", () => {
  const result = presentJapaneseReviewState({ phase: "rating-failed" });
  assert.match(result.message, /item is unchanged/);
});

test("application recovery is non-destructive until reset confirmation", () => {
  assert.equal(
    presentApplicationRecoveryState({ storageUnavailable: true, resetConfirmationOpen: false, resetFailed: false }).kind,
    "storage-failure",
  );
  assert.equal(
    presentApplicationRecoveryState({ storageUnavailable: true, resetConfirmationOpen: true, resetFailed: false }).kind,
    "reset-confirmation",
  );
});
```

- [ ] **Step 3: Verify RED**

```sh
node --test tests/unit/state-presentation.test.mjs
```

Expected: FAIL because `ui/statePresentation.js` does not exist.

- [ ] **Step 4: Implement the pure mapper**

Use one descriptor constructor and bounded branching. The exact implementation must preserve these outputs:

```js
function descriptor({ kind, tone = "", message = "", announce = "off", persistent = false, actionId = null }) {
  return Object.freeze({ kind, tone, message, announce, persistent, actionId });
}

export function presentBoardState({ total, visible, japanese }) {
  if (total === 0) {
    return descriptor({
      kind: "empty",
      message: japanese ? "No Japanese notes yet" : "No notes yet",
      actionId: japanese ? "create-japanese-note" : "create-note",
    });
  }
  if (visible === 0) {
    return descriptor({
      kind: "no-match",
      message: japanese ? "No Japanese notes match these filters" : "No notes match this search",
      actionId: japanese ? null : "clear-search",
    });
  }
  return descriptor({ kind: "ready" });
}

export function presentNoteState({ dirty, phase, failureKind }) {
  if (failureKind === "edit") {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Save failed. Your draft is preserved.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-save",
    });
  }
  if (failureKind === "create") {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Couldn't create note. No note was added. Try again.",
      announce: "assertive",
      persistent: true,
      actionId: "create-note",
    });
  }
  if (failureKind === "delete") {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Delete failed. The note is unchanged. Try again.",
      announce: "assertive",
      persistent: true,
      actionId: null,
    });
  }
  if (failureKind === "archive" || failureKind === "pin") {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Change couldn't be saved. The note is unchanged. Try again.",
      announce: "assertive",
      persistent: true,
      actionId: null,
    });
  }
  if (phase === "saving") return descriptor({ kind: "saving", message: "Saving…" });
  if (dirty) return descriptor({ kind: "unsaved", tone: "warning", message: "Unsaved" });
  return descriptor({ kind: "saved", tone: "success", message: "Saved" });
}

export function presentDerivedState({ searchUnavailable }) {
  return searchUnavailable
    ? descriptor({
        kind: "degraded",
        tone: "warning",
        message: "Saved. Search is temporarily unavailable.",
        announce: "polite",
        persistent: true,
      })
    : descriptor({ kind: "ready" });
}

export function presentDrawingState({ status, errorCode }) {
  if (errorCode === "KANJI_SAVE_FAILED") {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Save failed. Your drawing is preserved.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-drawing-save",
    });
  }
  if (status === "saving") return descriptor({ kind: "saving", message: "Saving drawing…" });
  if (status === "saved") return descriptor({ kind: "saved", tone: "success" });
  return descriptor({ kind: "ready" });
}

export function presentJapaneseReviewState({ phase }) {
  if (phase === "rating-failed") {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Rating wasn't saved. This review item is unchanged. Try again.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-rating",
    });
  }
  if (phase === "rating-pending") return descriptor({ kind: "saving", message: "Saving rating…" });
  if (phase === "complete") return descriptor({ kind: "complete", message: "Review complete" });
  return descriptor({ kind: "ready" });
}

export function presentApplicationRecoveryState({ storageUnavailable, resetConfirmationOpen, resetFailed }) {
  if (resetFailed) {
    return descriptor({
      kind: "reset-failure",
      tone: "danger",
      message: "Reset failed. Local data was not cleared.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-storage",
    });
  }
  if (!storageUnavailable) return descriptor({ kind: "ready" });
  if (resetConfirmationOpen) {
    return descriptor({
      kind: "reset-confirmation",
      tone: "danger",
      message: "Reset local data? This permanently removes local myNote data on this device.",
      persistent: true,
      actionId: "confirm-reset",
    });
  }
  return descriptor({
    kind: "storage-failure",
    tone: "danger",
    message: "Local storage couldn't be opened. Your existing local data has not been reset.",
    announce: "assertive",
    persistent: true,
    actionId: "retry-storage",
  });
}
```

- [ ] **Step 5: Verify GREEN and repository text contract**

```sh
node --test tests/unit/state-presentation.test.mjs
npm run test:content
```

Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add ui/statePresentation.js tests/unit/state-presentation.test.mjs package.json
git commit -m "feat(ux): add state presentation vocabulary"
```

---

### Task 2: True first-run empty state and board actions

**Files:**
- Modify: `app.js`
- Modify: `ui/list.js`
- Modify: `styles.css`
- Extend: `tests/e2e/state-recovery.spec.mjs`

**Produces:**
- A fresh DB stays at zero notes.
- Ordinary zero-data board has `New note`.
- Ordinary no-match board has `Clear search`.
- `ui/list.js` emits action IDs but does not read store/workspace state.

- [ ] **Step 1: Write browser RED for zero-write first run**

Use the repository's existing Playwright server fixture pattern. Add:

```js
test("fresh database remains empty until explicit create", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteList .note-item")).toHaveCount(0);
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes yet");
  await expect(page.locator("#noteList .empty-state button")).toHaveText("New note");

  const count = await page.evaluate(async () => {
    const request = indexedDB.open("myNoteDB", 3);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("notes", "readonly");
    const countRequest = tx.objectStore("notes").count();
    const value = await new Promise((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    db.close();
    return value;
  });
  expect(count).toBe(0);

  await page.locator("#noteList .empty-state button").click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#noteList .note-item")).toHaveCount(1);
});
```

Add ordinary no-match:

```js
test("ordinary no-match is distinct and clear restores notes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.locator("#titleInput").fill("Alpha note");
  await page.locator("#contentInput").fill("existing content");
  await page.keyboard.press("Control+Enter");
  await page.locator("#closeNoteEditorButton").click();

  await page.locator("#searchInput").fill("does-not-match");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");
  await page.locator("#noteList .empty-state button").click();
  await expect(page.locator("#searchInput")).toHaveValue("");
  await expect(page.locator("#noteList .note-item")).toContainText("Alpha note");
});
```

- [ ] **Step 2: Verify RED**

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "fresh database|ordinary no-match"
```

Expected: fresh DB test fails because current bootstrap creates `Untitled`; empty actions also fail because current empty state is text-only.

- [ ] **Step 3: Remove automatic placeholder creation**

In `app.js`, replace the zero-note branch that calls `createNote({ title: "Untitled" ... })` with the normal empty refresh/render path:

```js
if (loaded.length === 0) {
  await refreshSearch({ preferredId: null, emptyLabel: "No notes" });
  return;
}
```

If the controller already requires a slightly different empty call, preserve the same result: no canonical write, `notes: []`, `activeId: null`, and rendered empty board.

- [ ] **Step 4: Make `ui/list.js` action-aware without state ownership**

Change the constructor to:

```js
export function createListView({ container, onSelect, onEmptyAction, formatDate }) {
```

Change `render` to accept an `emptyPresentation` descriptor:

```js
render({ notesById, orderedIds, activeId, query, emptyPresentation })
```

Render the descriptor only when `boardIds.length === 0`:

```js
function clearToEmpty(presentation) {
  nodeCache.clear();
  container.dataset.virtualized = "false";
  container.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "empty-state";
  const message = document.createElement("p");
  message.textContent = presentation.message;
  empty.append(message);

  if (presentation.actionId) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "primary-button";
    action.textContent = presentation.actionId === "create-note" ? "New note" : "Clear search";
    action.addEventListener("click", () => onEmptyAction(presentation.actionId, action));
    empty.append(action);
  }

  container.append(empty);
}
```

- [ ] **Step 5: Supply ordinary board presentation from `app.js`**

Import `presentBoardState`. For Notes workspace, pass:

```js
const emptyPresentation = presentBoardState({
  total: state.notes.length,
  visible: state.filteredIds.length,
  japanese: false,
});
```

Handle action IDs through existing owners:

```js
onEmptyAction(actionId, opener) {
  if (actionId === "create-note") {
    runAction(() => executeCommand("notes.create", { source: "empty-state", target: opener, opener }));
  }
  if (actionId === "clear-search") {
    els.searchInput.value = "";
    runAction(() => refreshSearch({ query: "" }));
  }
},
```

During Task 2, retain current Japanese empty rendering; Task 6 adds its explicit create-menu action after the Japanese adapter exposes a direct API.

- [ ] **Step 6: Add bounded empty-state CSS**

```css
.empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--mn-space-3);
  padding: var(--mn-space-6);
  text-align: center;
}

.empty-state p {
  margin: 0;
  color: var(--mn-text-secondary);
}
```

- [ ] **Step 7: Verify focused regressions**

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "fresh database|ordinary no-match"
npx playwright test tests/e2e/editor-list-contract.spec.mjs
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```sh
git add app.js ui/list.js styles.css tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): add true empty board states"
```

---

### Task 3: Note mutation failure, save retry, delete safety, and derived degradation

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `ui/editorChrome.js`
- Modify: `editor.css`
- Extend: `tests/integration/note-lifecycle.failure.test.mjs`
- Extend: `tests/e2e/state-recovery.spec.mjs`

**Produces:**
- `savePhase: "idle" | "saving"` presentation-only scalar.
- `lastPersistenceFailure: "" | "edit" | "create" | "delete" | "archive" | "pin"` presentation-only scalar.
- Canonical failure never reports success.
- Derived search failure explicitly says the note is saved.
- Failed delete leaves the note/editor/action available and never shows Undo.

- [ ] **Step 1: Confirm canonical ordering in integration tests**

Extend `tests/integration/note-lifecycle.failure.test.mjs` to assert on failed upsert:

```js
assert.equal(state.notes[0].content, originalContent);
assert.equal(state.dirty, true);
assert.equal(history.listOperations().some((entry) => entry.op === "edit"), false);
```

For a derived update failure after successful persistence, assert the persisted note contains the new value and the derived callback fires without canonical rollback.

Run:

```sh
node --test tests/integration/note-lifecycle.failure.test.mjs
```

If already GREEN, do not modify `core/noteLifecycle.js`.

- [ ] **Step 2: Add a test-only IndexedDB failure harness**

In `tests/e2e/state-recovery.spec.mjs`, install before navigation:

```js
async function installDatabaseFailureHarness(page) {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    let failure = null;

    Object.defineProperty(window, "__stateRecoveryDbTest", {
      configurable: true,
      value: { failNext(storeName) { failure = storeName; } },
    });

    IDBDatabase.prototype.transaction = function(storeNames, mode, options) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      if (failure && mode === "readwrite" && names.includes(failure)) {
        failure = null;
        throw new DOMException("Injected test write failure", "InvalidStateError");
      }
      return original.call(this, storeNames, mode, options);
    };
  });
}
```

This helper exists only in the Playwright test page; do not add any corresponding production global.

- [ ] **Step 3: Add browser RED for failed edit then retry**

```js
test("note save failure preserves exact draft and retry succeeds quietly", async ({ page }) => {
  await installDatabaseFailureHarness(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.locator("#contentInput").fill("first durable value");
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await page.evaluate(() => window.__stateRecoveryDbTest.failNext("notes"));
  await page.locator("#contentInput").fill("draft that must survive");
  await page.keyboard.press("Control+Enter");

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#contentInput")).toHaveValue("draft that must survive");
  await expect(page.locator("#saveState")).toContainText("Save failed");
  await expect(page.locator("#retryNoteSaveButton")).toBeVisible();

  await page.locator("#retryNoteSaveButton").click();
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await expect(page.locator("[data-notification-kind='success']")).toHaveCount(0);
});
```

- [ ] **Step 4: Add browser RED for failed delete**

Use the same one-shot `notes` failure. Open More actions, click Delete, then assert:

```js
await expect(page.locator("#noteEditorOverlay")).toBeVisible();
await expect(page.locator("#noteActionsPopover")).toBeVisible();
await expect(page.locator("#saveState")).toContainText("Delete failed");
await expect(page.locator("#undoNotice")).toBeHidden();
```

Click the same Delete action again after the one-shot failure is consumed and assert durable deletion then exposes exactly one Undo notice.

- [ ] **Step 5: Add note status markup without autosave live-region spam**

In `index.html`, replace the standalone live `#saveState` with:

```html
<div id="noteStatusRegion" class="editor-save-region">
  <span id="saveState" class="editor-save-state">Saved</span>
  <button id="retryNoteSaveButton" class="quiet-button" type="button" hidden>Retry save</button>
  <span id="noteStatusAnnouncement" class="visually-hidden" aria-live="polite"></span>
</div>
```

Add a board-level failure region near the note list for create failures:

```html
<div id="boardStatusRegion" class="board-status" role="alert" hidden>
  <span id="boardStatusMessage"></span>
</div>
```

Do not create a global message queue.

- [ ] **Step 6: Track bounded operation context in `app.js`**

Add to the existing store:

```js
savePhase: "idle",
lastPersistenceFailure: "",
```

Before awaiting the real edit save, set `savePhase: "saving"`; clear it in `finally`. Do not use a timer to determine completion.

In `applyUpsertNote`, classify a caught canonical failure from the existing `historyOp?.op`:

```js
function classifyFailureKind(op, fallback = "edit") {
  const value = String(op || fallback);
  if (value.includes("create")) return "create";
  if (value.includes("archive")) return "archive";
  if (value.includes("pin")) return "pin";
  if (value.includes("delete")) return "delete";
  return "edit";
}
```

On catch, set `lastPersistenceFailure` and rethrow. In `applyRemoveNote`, set `delete`. If an enrolled Japanese delete handler throws inside `deleteActiveNote`, set `delete`, render, and rethrow there as well.

Clear `lastPersistenceFailure` only after a successful canonical operation or when the user starts a new explicit retry.

- [ ] **Step 7: Render note and board failure descriptors**

Use `presentNoteState({ dirty, phase: state.savePhase, failureKind: state.lastPersistenceFailure })` unless the current message represents derived degradation; derived degradation uses `presentDerivedState`.

Render:

```js
els.saveState.textContent = presentation.message;
els.saveState.dataset.state = presentation.tone;
els.retryNoteSaveButton.hidden = presentation.actionId !== "retry-save";
```

`#boardStatusRegion` is visible only for `failureKind === "create"`; the existing New note action remains the retry control.

Announce only attention-required descriptors. Keep a composition-root string key such as `lastNoteAnnouncementKey`; repeated rerenders of the same failure must not re-announce it. Healthy `Unsaved`, `Saving…`, and `Saved` remain visual only.

Wire `#retryNoteSaveButton` to the existing `editor.save` command; do not call storage directly.

- [ ] **Step 8: Keep failed action-menu operations retryable**

In `ui/editorChrome.js`, wrap the existing action execution:

```js
let outcome;
try {
  outcome = await commandRuntime.execute(action.commandId, {
    source: "note-actions",
    target: elements.actionsButton,
  });
} catch {
  renderActions();
  elements.actionsList.querySelector(`[data-command-id="${action.commandId}"]`)?.focus();
  return;
}
```

Only close the actions popover after successful command execution. Failed delete/archive must keep the same action available and must not expose Undo.

- [ ] **Step 9: Add derived-search failure harness and browser evidence**

In the Playwright page only, wrap `Worker.prototype.postMessage` before navigation. When a test flag requests the next `upsert` failure, deliver one synthetic worker failure response using the original request ID, then resume normal worker behavior.

The test must save an edited note with the injected search failure, assert `#saveState` contains `Search` but not `Save failed`, reload, reopen the note, and assert the edited canonical content survived.

- [ ] **Step 10: Verify focused note flows**

```sh
node --test tests/integration/note-lifecycle.failure.test.mjs
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "note save failure|failed delete|derived"
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
npx playwright test tests/e2e/editor-shell.spec.mjs
```

Expected: PASS.

- [ ] **Step 11: Commit**

```sh
git add index.html app.js ui/editorChrome.js editor.css tests/integration/note-lifecycle.failure.test.mjs tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): add scoped note recovery states"
```

---

### Task 4: Non-destructive application storage recovery

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Extend: `tests/e2e/state-recovery.spec.mjs`

**Produces:**
- Persistent storage failure region.
- Retry without destructive action.
- Explicit reset dialog.
- Cancel performs zero storage mutation and restores focus.

- [ ] **Step 1: Add one-shot bootstrap-open failure test**

Install after seeding is not needed for the basic failure case:

```js
await page.addInitScript(() => {
  const originalOpen = indexedDB.open.bind(indexedDB);
  let failOnce = true;
  indexedDB.open = function(...args) {
    if (failOnce) {
      failOnce = false;
      throw new DOMException("Injected test open failure", "InvalidStateError");
    }
    return originalOpen(...args);
  };
});
```

Assert after navigation:

```js
await expect(page.locator("#applicationRecovery")).toBeVisible();
await expect(page.locator("#applicationRecovery")).toContainText("has not been reset");
```

Register a Playwright `dialog` listener, wait 150 ms, and assert zero dialogs occurred. Click Retry and assert the recovery region hides after the one-shot failure is consumed.

- [ ] **Step 2: Add exact reset-cancel browser test**

Use this sequence:

1. navigate normally and create a note titled `Preserve me`;
2. call `page.addInitScript(...)` with the one-shot `indexedDB.open` failure helper;
3. reload so the existing database remains intact but bootstrap enters recovery once;
4. click `#resetApplicationDataButton`;
5. assert `#applicationResetDialog` is open and `#cancelApplicationResetButton` is focused;
6. click Cancel;
7. assert focus returns to `#resetApplicationDataButton`;
8. click Retry so normal bootstrap resumes;
9. assert the note titled `Preserve me` is still present.

This proves cancellation performs zero data mutation without introducing a production test switch.

- [ ] **Step 3: Verify RED**

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "bootstrap storage|reset cancellation"
```

Expected: FAIL because current bootstrap uses a delayed destructive confirmation and has no persistent recovery region.

- [ ] **Step 4: Add recovery and reset-confirmation markup**

Add:

```html
<section id="applicationRecovery" class="application-recovery" role="alert" hidden>
  <p id="applicationRecoveryMessage"></p>
  <div class="application-recovery-actions">
    <button id="retryApplicationStorageButton" type="button">Retry</button>
    <button id="resetApplicationDataButton" type="button">Reset local data…</button>
  </div>
</section>

<dialog id="applicationResetDialog" aria-labelledby="applicationResetTitle">
  <h2 id="applicationResetTitle">Reset local data?</h2>
  <p>This permanently removes local myNote data on this device.</p>
  <div class="dialog-actions">
    <button id="cancelApplicationResetButton" type="button">Cancel</button>
    <button id="confirmApplicationResetButton" type="button">Reset</button>
  </div>
</dialog>
```

- [ ] **Step 5: Refactor bootstrap failure into retryable composition-root behavior**

Replace the delayed `window.confirm` catch path with:

```js
let applicationStorageUnavailable = false;
let applicationResetFailed = false;
let resetOpener = null;

async function startApplication() {
  try {
    await bootstrap();
    applicationStorageUnavailable = false;
    applicationResetFailed = false;
  } catch {
    applicationStorageUnavailable = true;
  }
  renderApplicationRecovery();
}
```

Initial startup calls `startApplication()` once. Retry calls the same function. No automatic retry loop.

Split the current reset function into storage mutation and confirmation ownership:

```js
async function performResetLocalData() {
  await resetDatabase();
  window.location.reload();
}
```

Only `#confirmApplicationResetButton` calls `performResetLocalData()`. On reset failure, keep the recovery surface visible and render `presentApplicationRecoveryState({ ..., resetFailed: true })`.

Cancel closes only the dialog and focuses `resetOpener`, which is the Reset trigger.

- [ ] **Step 6: Add bounded recovery CSS and verify**

Use existing surface/border/danger tokens. Do not add message queues, timers, or success animations.

Run:

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "bootstrap storage|reset cancellation"
npx playwright test tests/e2e/editor-shell.spec.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add index.html app.js styles.css tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): add non-destructive storage recovery"
```

---

### Task 5: Drawing save/delete/recovery presentation

**Files:**
- Modify: `ui/kanjiInkView.js`
- Modify only if needed: `kanji-ink.css`
- Extend: `tests/e2e/state-recovery.spec.mjs`

**Constraints:**
- Do not modify Kanji persistence/controller/application owners.
- Save success is the direct projection, not a toast.
- Visual stroke counts must not be repeatedly live-announced.

- [ ] **Step 1: Confirm controller/application failure guarantees**

```sh
node --test tests/unit/kanji-ink-controller.test.mjs tests/unit/kanji-ink-application.test.mjs
```

Expected: PASS. If failed-save draft/retry guarantees are already GREEN, do not change core drawing modules.

- [ ] **Step 2: Add failed-save then retry browser RED**

Use the test-only DB harness to fail the next `kanjiInkEntries` write. Create/open a note, draw a valid stroke, click Save, then assert:

```js
await expect(page.locator("#kanjiInkDialog")).toBeVisible();
await expect(page.locator("#kanjiInkStatus")).toContainText("Save failed. Your drawing is preserved.");
await expect(page.locator("#saveKanjiButton")).toHaveAttribute("aria-label", "Retry save drawing");
```

Click Retry. Assert the dialog closes, the direct drawing projection is visible in `#noteDrawingRegion`, and no generic success notification exists.

- [ ] **Step 3: Add failed-delete browser RED**

With a saved drawing visible, inject the next `kanjiInkEntries` write failure and click its Delete control. Assert:

```js
await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);
await expect(page.locator("#kanjiInkRegionStatus")).toContainText("saved drawing is unchanged");
await expect(page.locator("#kanjiInkRecovery")).toBeHidden();
```

Click Delete again after the one-shot failure is consumed. Assert the projection is removed only after durable success and exactly one drawing Undo recovery surface appears.

- [ ] **Step 4: Split visual drawing status from live announcement**

In the generated dialog markup, change `#kanjiInkStatus` to a visual-only paragraph and add:

```html
<span id="kanjiInkAnnouncement" class="visually-hidden" aria-live="polite"></span>
```

Add it to the collected element set. Use `presentDrawingState(...)` inside `renderController()`. Update `#kanjiInkAnnouncement` only when the descriptor requests attention and the bounded announcement key changed. Do not announce stroke counts or successful save.

- [ ] **Step 5: Normalize delete failure copy without optimistic removal**

Keep the existing `deleteEntry` ordering. The catch path must retain the projection and render:

```text
Drawing couldn't be deleted. The saved drawing is unchanged. Try again.
```

The existing Undo recovery is shown only after successful delete and synchronization. If restore fails, keep the recovery opportunity visible and show a bounded recovery error; do not change storage semantics.

- [ ] **Step 6: Verify focused drawing regressions**

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "drawing"
npx playwright test tests/e2e/kanji-handwriting.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```sh
git add ui/kanjiInkView.js kanji-ink.css tests/e2e/state-recovery.spec.mjs
git diff --cached --check
git commit -m "feat(ux): normalize drawing recovery states"
```

If `kanji-ink.css` did not change, it may remain staged with no diff; do not add unrelated edits.

---

### Task 6: Japanese empty/no-result/degraded/rating recovery

**Files:**
- Modify: `japaneseApp.js`
- Modify: `ui/japanese-filters.js`
- Modify: `index.html`
- Modify: `japanese.css`
- Modify: `app.js`
- Extend: `tests/integration/japanese-lifecycle.test.mjs`
- Extend: `tests/e2e/state-recovery.spec.mjs`

**Produces:**
- Japanese zero-data board action opens the existing create menu through a direct adapter API.
- Filter/no-result copy uses presentation vocabulary without resetting query/chips.
- Study-data degradation is visible only in Japanese scope.
- Rating failure keeps the same item and same rating controls available for retry.
- Routine filter counts and review state changes are not repeatedly live-announced.

- [ ] **Step 1: Confirm/extend rating persistence ordering in integration**

Using the existing injected Japanese persistence seam, reject one review update and assert:

```js
assert.equal(state.reviewSession.currentNoteId, originalCurrentNoteId);
assert.equal(state.reviewSession.index, originalIndex);
assert.equal(state.reviewSession.status, "active");
```

Allow the next write and retry the same rating; assert the session advances exactly once.

Run:

```sh
node --test --test-concurrency=1 tests/integration/japanese-lifecycle.test.mjs
```

Do not modify scheduler or storage semantics if this is already GREEN.

- [ ] **Step 2: Add Japanese no-result browser RED**

Create a Grammar note, select Grammar, enter a text query that matches nothing, and assert:

```js
await expect(page.locator("#japaneseFilterStatus")).toContainText("No Japanese notes match these filters");
await expect(page.getByRole("button", { name: "Grammar" })).toHaveAttribute("aria-pressed", "true");
await expect(page.locator("#searchInput")).not.toHaveValue("");
```

Clear only the control explicitly chosen by the test and assert unrelated filter/query context is preserved.

- [ ] **Step 3: Add rating-failure browser RED**

Use the DB harness to fail the next `studyReviews` write. Capture `#reviewNoteTitle` and `#reviewProgress`, click Good, and assert both remain unchanged while `#reviewStatus` says:

```text
Rating wasn't saved. This review item is unchanged. Try again.
```

Assert focus remains on the Good rating button after the failure. Click Good again after the one-shot failure is consumed and assert advance/completion happens once.

- [ ] **Step 4: Move filter result copy into the existing filter adapter**

`ui/japanese-filters.js` is the current owner of `#japaneseFilterStatus`, so do not overwrite it from `japaneseApp.js`.

Import `presentBoardState` and replace only the final count branch:

```js
const total = new Set(Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds : []).size;
const visible = resultCount(state);
const presentation = presentBoardState({ total, visible, japanese: true });

elements.status.textContent = presentation.kind === "no-match"
  ? presentation.message
  : total === 0
    ? "No Japanese notes yet"
    : `Showing ${visible} of ${total} Japanese ${total === 1 ? "note" : "notes"}`;
```

Keep the existing invalid-date-range error as the higher-priority branch.

Remove `role="status" aria-live="polite"` from the visible count element in `index.html`; routine count changes must not spam announcements.

- [ ] **Step 5: Add one Japanese announcement/availability region**

Add near Japanese controls:

```html
<p id="japaneseAvailabilityStatus" class="japanese-availability-status" hidden></p>
<span id="japaneseStateAnnouncement" class="visually-hidden" aria-live="polite"></span>
```

Remove `aria-live` from visible `#reviewStatus`. `japaneseApp.js` uses `#japaneseStateAnnouncement` only for attention-required messages such as study-data unavailability and rating failure. Keep a last-announcement key so rerenders do not repeat identical failures.

- [ ] **Step 6: Keep rating failure in presentation-only adapter state**

Add in `createJapaneseApp`:

```js
let reviewPhase = "ready";
let lastJapaneseAnnouncementKey = "";
```

In `submitRating(rating)`, identify the clicked rating button, set `reviewPhase = "rating-pending"`, render, and disable rating buttons. On persistence failure:

```js
reviewPhase = "rating-failed";
renderReview();
retryButton?.focus();
return;
```

On success, set `reviewPhase = "ready"` and render the advanced session. Do not call `advanceReviewSession` in the catch path.

`renderReview()` uses `presentJapaneseReviewState({ phase: reviewPhase })` for pending/failure copy. Successful rating has no success message.

- [ ] **Step 7: Render Japanese study degradation as scoped capability truth**

When `state.studyDataUnavailable` is true and workspace is Japanese, show:

```text
Japanese study data is unavailable. Ordinary Notes are still available.
```

Keep ordinary Notes fully usable. Do not display raw errors, note content, review payloads, or drawing data.

Zero due remains healthy; use existing Review 0/disabled-reason semantics or quiet `No reviews due` copy without danger/warning tone.

- [ ] **Step 8: Expose a direct create-menu API for Japanese empty state**

Extend the returned Japanese adapter with:

```js
openCreateMenu(opener) {
  if (elements.newJapaneseNote.disabled) return false;
  elements.japaneseCreateMenu.hidden = false;
  elements.newJapaneseNote.setAttribute("aria-expanded", "true");
  elements.quickCreateButtons[0]?.focus();
  return true;
}
```

In `app.js`, retain the returned adapter instance instead of discarding it. When workspace is Japanese, compute `presentBoardState` using `state.japaneseNoteIds` as total. If its action is `create-japanese-note`, `onEmptyAction` calls `japaneseApp.openCreateMenu(opener)`. This is a direct composition-root API call, not a synthetic click or DOM bridge.

- [ ] **Step 9: Verify Japanese focused regressions**

```sh
node --test --test-concurrency=1 tests/integration/japanese-lifecycle.test.mjs
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "Japanese|rating"
npx playwright test tests/e2e/japanese-filters.spec.mjs
npx playwright test tests/e2e/japanese-degraded-mode.spec.mjs
npx playwright test tests/e2e/japanese-progressive-disclosure.spec.mjs
npx playwright test tests/e2e/japanese-release-gate.spec.mjs
```

Expected: PASS.

- [ ] **Step 10: Commit**

```sh
git add japaneseApp.js ui/japanese-filters.js index.html japanese.css app.js tests/integration/japanese-lifecycle.test.mjs tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): unify Japanese recovery states"
```

---

### Task 7: Accessibility, resource bounds, complete verification, and PR handoff

**Files:**
- Modify only if a focused RED requires it: `index.html`, `styles.css`, `editor.css`, `japanese.css`, `kanji-ink.css`, `ui/statePresentation.js`, `tests/e2e/state-recovery.spec.mjs`, `docs/cheatsheet.md`

- [ ] **Step 1: Add final accessibility/resource assertions**

The focused browser suite must verify:

```js
await expect(page.locator("#saveState")).not.toHaveAttribute("aria-live");
await expect(page.locator("#noteStatusAnnouncement")).toHaveAttribute("aria-live", "polite");
await expect(page.locator("#japaneseFilterStatus")).not.toHaveAttribute("aria-live");
await expect(page.locator("#reviewStatus")).not.toHaveAttribute("aria-live");
```

Also assert:

- note save failure does not steal title/body focus;
- drawing save failure stays in the drawing workflow;
- rating failure keeps focus on the selected rating button;
- reset cancellation returns focus to `#resetApplicationDataButton`;
- repeated identical failures leave exactly one `#applicationRecovery`, one `#noteStatusRegion`, one drawing region, and one Japanese announcement region;
- durable delete produces one Undo surface; failed delete produces none.

- [ ] **Step 2: Run the complete focused #72 package**

```sh
node --test tests/unit/state-presentation.test.mjs
node --test tests/integration/note-lifecycle.failure.test.mjs
node --test --test-concurrency=1 tests/integration/japanese-lifecycle.test.mjs
npx playwright test tests/e2e/state-recovery.spec.mjs
```

Expected: PASS.

- [ ] **Step 3: Run affected regression suites**

```sh
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
npx playwright test tests/e2e/editor-list-contract.spec.mjs
npx playwright test tests/e2e/desktop-resilience.spec.mjs
npx playwright test tests/e2e/kanji-handwriting.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
npx playwright test tests/e2e/japanese-filters.spec.mjs
npx playwright test tests/e2e/japanese-degraded-mode.spec.mjs
npx playwright test tests/e2e/japanese-progressive-disclosure.spec.mjs
npx playwright test tests/e2e/japanese-release-gate.spec.mjs
```

Expected: PASS. Fix only #72-owned behavior locally; do not push to use remote CI as a debugger.

- [ ] **Step 4: Audit ownership and retained resources**

```sh
git diff --name-only origin/dev...HEAD
git diff --check
git grep -n "NotificationManager\|ToastStore\|FeedbackBus" -- app.js japaneseApp.js ui || true
git grep -n "__stateRecoveryDbTest\|__stateRecoverySearchTest" -- ':!tests/e2e/state-recovery.spec.mjs' || true
```

Expected:

- no forbidden core-owner file changed;
- no production failure harness exists;
- no generic notification/event bus exists;
- no payload/error logging was added.

- [ ] **Step 5: Run the complete local gate once after focused stability**

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

Expected: PASS.

If only the Playwright OS dependency provisioning command fails because the local root filesystem is read-only, record the exact error and stop for reviewer authorization before classifying it as environment-only. Do not retry system package installation or use remote CI as a workaround loop.

- [ ] **Step 6: Commit a final test/docs-only adjustment only if Step 1 changed files**

Use this bounded staging set:

```sh
git add tests/e2e/state-recovery.spec.mjs index.html styles.css editor.css japanese.css kanji-ink.css ui/statePresentation.js docs/cheatsheet.md
git diff --cached --check
```

If `git diff --cached --quiet` reports no staged difference, do not create a commit. Otherwise:

```sh
git commit -m "test(ux): complete state recovery evidence"
```

Total implementation commits must remain at or below 8.

- [ ] **Step 7: Final branch audit**

```sh
git status --short
git log --oneline origin/dev..HEAD
git diff --stat origin/dev...HEAD
git diff --check
```

Expected: clean working tree, bounded #72 files only, at most 8 commits.

- [ ] **Step 8: Perform one planned remote push**

```sh
git push -u origin issue/72-state-recovery
```

Do not make a trial/empty push.

- [ ] **Step 9: Open exactly one draft PR targeting `dev`**

The PR body records the values returned by:

```sh
git rev-parse origin/dev
git rev-parse HEAD
git diff --name-only origin/dev...HEAD
```

It must also record:

- issue #72;
- authoritative design path;
- RED→GREEN evidence;
- first-run zero-write evidence;
- note canonical-failure vs derived-degradation evidence;
- create/delete/save recovery behavior;
- drawing save/delete/retry/direct-projection evidence;
- Japanese no-result/rating/degraded evidence;
- bootstrap recovery/reset-cancel evidence;
- accessibility and O(1) retained-presentation evidence;
- complete local gate results;
- native 200% status;
- migration/security/privacy/rollback statements.

Do not merge.

- [ ] **Step 10: Let one automatic PR CI run, then stop**

Do not manually dispatch or rerun workflows. Do not push whitespace or empty commits to retrigger CI.

If automatic CI passes, report the current-head run and stop for owner review.

If automatic CI fails, report the exact failed step and evidence and stop. Any later fix/push iteration requires explicit reviewer authorization.

---

## Acceptance Mapping

- True first run and zero-write DB: Task 2.
- Empty vs no-match: Tasks 1–2.
- Silent healthy note success: Tasks 1 and 3.
- Edit/create/delete/pin/archive failure truth: Task 3.
- Derived search degradation distinct from persistence failure: Task 3.
- Drawing save success via direct projection; save/delete failure recovery: Task 5.
- Japanese no-result context, scoped degradation, rating failure/no optimistic advance: Task 6.
- Persistent non-destructive storage recovery and reset cancellation: Task 4.
- Bounded live announcements/focus/O(1) presentation resources: Task 7.
- No schema, persistence-owner, scheduler-owner, drawing-owner, command-owner, or mobile-scope change: file audit + complete gate.
- Full repository verification and one automatic remote CI gate: Task 7.

## Stop Conditions

Stop and report exact evidence instead of expanding scope if any accepted test appears to require:

- IndexedDB version/store/schema change;
- persistence transaction semantic change;
- scheduler semantic change;
- search ranking/index architecture change;
- parser ownership change;
- drawing controller/application ownership change;
- a second command availability owner;
- a global notification/event bus;
- automatic retry/polling/background work;
- production failure-injection switches;
- logging note/review/drawing payloads;
- mobile/touch-first product behavior;
- runtime changes outside the approved adapter/presentation boundary without a demonstrated accepted RED.

After opening the PR and observing the single automatic CI result, stop. Do not merge and do not begin #73.