# Issue #72 State and Recovery UX Implementation Plan

> **For implementation workers:** Execute this plan task-by-task with TDD. Keep the issue branch bounded to #72, stop on architecture conflicts, and wait for owner review after opening the pull request.

**Goal:** Deliver the approved #72 state/recovery UX so healthy success stays quiet, failures are scoped and actionable, first run is a true empty state, and existing note/Japanese/drawing owners remain authoritative.

**Architecture:** Add one pure `ui/statePresentation.js` mapper over existing owner state. Existing browser adapters render descriptors into their current local surfaces; no new persistence, scheduler, search, drawing, command, notification, or retry owner is introduced. The only intentional canonical behavior change is removing bootstrap's automatic placeholder note so a fresh database remains empty until explicit create intent.

**Tech Stack:** JavaScript ES modules, IndexedDB, Node 22, npm 11, Node test runner, Playwright 1.62, ESLint 10.

## Global Constraints

- Authoritative design: `docs/design/issues/072-state-recovery.md`.
- Accepted design baseline: `bc748b189bb70a212feefe5d006ece0608727171` on `dev`.
- Implementation branch: `issue/72-state-recovery`, created from current `dev` after confirming the design commit is an ancestor.
- Pull-request target: `dev`.
- Keep #73 blocked.
- Maximum implementation commits: 8; this plan targets 6 bounded commits.
- Healthy note save, drawing save, rating success, filter application, note open, and refresh completion produce no success toast.
- First run performs zero note writes until explicit create intent.
- IndexedDB stays version 3; no migration or canonical-record rewrite.
- No global notification queue, event bus, automatic retry loop, polling, background queue, or production failure-injection flag.
- Do not modify core persistence/search/scheduler/drawing/history owners unless an accepted RED proves the approved adapter boundary cannot satisfy the contract; if that occurs, stop for architecture review.
- Supported desktop evidence: 1024×768, 1280×720, 1440×900. Native 200% zoom is PASS only when directly validated in a real browser; otherwise record `UNKNOWN — REQUIRES VALIDATION`.
- Debug locally. Remote CI is the final gate, not the debugging loop. Use one planned final remote push after the complete local gate is stable. Do not manually rerun unchanged failures.
- Repository text must remain English-only and free of tool-specific provenance markers.

---

## File Map

### New files

- `ui/statePresentation.js` — pure state-to-presentation mapping; no DOM, persistence, timers, mutable retained state, or raw error payloads.
- `tests/unit/state-presentation.test.mjs` — authoritative mapper vocabulary tests.
- `tests/e2e/state-recovery.spec.mjs` — focused browser owner for #72 state/recovery workflows and test-only failure injection.

### Existing files expected to change

- `package.json` — include the new unit test in the explicit `test:unit` script.
- `app.js` — render note save/degradation descriptors, remove bootstrap placeholder creation, expose bounded retry/reset recovery intents, and wire empty-board creation.
- `index.html` — add minimal note-status action/announcement semantics plus application recovery/reset-confirmation regions.
- `ui/list.js` — distinguish zero-data vs no-match and render an explicit create/clear action without owning application state.
- `ui/editorChrome.js` — keep deletion recovery bounded; only normalize copy/focus if a failing test requires it.
- `ui/kanjiInkView.js` — map existing drawing truth to quiet/saving/failure/recovery presentation; preserve direct projection and durable-delete semantics.
- `japaneseApp.js` — map Japanese availability/review presentation; keep a failed rating on the same item and expose retry through the same rating action.
- `styles.css`, `editor.css`, `japanese.css` — scoped empty/warning/error/recovery styling only.
- Existing integration tests — extend current lifecycle tests rather than creating duplicate core owners.

### Forbidden by default

Do not modify these files unless an approved test proves a boundary defect and implementation stops for owner review first:

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

### Task 1: Pure state-presentation vocabulary

**Files:**
- Create: `ui/statePresentation.js`
- Create: `tests/unit/state-presentation.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `presentBoardState(input)`, `presentNoteSaveState(input)`, `presentDerivedState(input)`, `presentDrawingState(input)`, `presentJapaneseReviewState(input)`, `presentApplicationRecoveryState(input)`.
- Every function returns a fresh plain descriptor with only bounded presentation fields.
- No function accepts or returns a raw `Error`, note content, drawing vectors, review payloads, or callbacks.

- [ ] **Step 1: Add the failing unit test file and register it in `test:unit`**

Start `tests/unit/state-presentation.test.mjs` with deterministic table-driven assertions:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  presentApplicationRecoveryState,
  presentBoardState,
  presentDerivedState,
  presentDrawingState,
  presentJapaneseReviewState,
  presentNoteSaveState,
} from "../../ui/statePresentation.js";

test("note save presentation distinguishes dirty, success, failure, and derived degradation", () => {
  assert.deepEqual(
    presentNoteSaveState({ dirty: true, phase: "idle", canonicalFailure: false }),
    {
      kind: "unsaved",
      tone: "warning",
      message: "Unsaved",
      announce: "off",
      persistent: false,
      actionId: null,
    },
  );

  assert.deepEqual(
    presentNoteSaveState({ dirty: false, phase: "idle", canonicalFailure: false }),
    {
      kind: "saved",
      tone: "success",
      message: "Saved",
      announce: "off",
      persistent: false,
      actionId: null,
    },
  );

  assert.deepEqual(
    presentNoteSaveState({ dirty: true, phase: "idle", canonicalFailure: true }),
    {
      kind: "failure",
      tone: "danger",
      message: "Save failed. Your draft is preserved.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-save",
    },
  );
});

test("derived degradation says canonical data is saved", () => {
  assert.deepEqual(
    presentDerivedState({ searchUnavailable: true }),
    {
      kind: "degraded",
      tone: "warning",
      message: "Saved. Search is temporarily unavailable.",
      announce: "polite",
      persistent: true,
      actionId: null,
    },
  );
});

test("board presentation distinguishes zero data from no match", () => {
  assert.equal(presentBoardState({ total: 0, visible: 0, queryActive: false }).kind, "empty");
  assert.equal(presentBoardState({ total: 3, visible: 0, queryActive: true }).kind, "no-match");
});

test("drawing success is silent while failure preserves retry semantics", () => {
  assert.deepEqual(
    presentDrawingState({ status: "saved", errorCode: "" }),
    { kind: "saved", tone: "success", message: "", announce: "off", persistent: false, actionId: null },
  );
  assert.deepEqual(
    presentDrawingState({ status: "error", errorCode: "KANJI_SAVE_FAILED" }),
    {
      kind: "failure",
      tone: "danger",
      message: "Save failed. Your drawing is preserved.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-drawing-save",
    },
  );
});

test("Japanese rating failure remains actionable without claiming progress", () => {
  assert.deepEqual(
    presentJapaneseReviewState({ phase: "rating-failed" }),
    {
      kind: "failure",
      tone: "danger",
      message: "Rating wasn't saved. This review item is unchanged. Try again.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-rating",
    },
  );
});

test("application recovery is non-destructive until reset is explicitly confirmed", () => {
  assert.equal(presentApplicationRecoveryState({ storageUnavailable: true, resetConfirmationOpen: false }).kind, "storage-failure");
  assert.equal(presentApplicationRecoveryState({ storageUnavailable: true, resetConfirmationOpen: true }).kind, "reset-confirmation");
});
```

Update the explicit `test:unit` script in `package.json` to include `tests/unit/state-presentation.test.mjs` once.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```sh
node --test tests/unit/state-presentation.test.mjs
```

Expected: FAIL because `ui/statePresentation.js` does not exist.

- [ ] **Step 3: Implement the smallest pure mapper**

Create `ui/statePresentation.js` with fresh descriptors and bounded enums. Use a tiny constructor to keep outputs consistent:

```js
function descriptor({ kind, tone = "", message = "", announce = "off", persistent = false, actionId = null }) {
  return Object.freeze({ kind, tone, message, announce, persistent, actionId });
}

export function presentBoardState({ total, visible, queryActive, japanese = false }) {
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
      actionId: japanese ? "clear-japanese-filters" : "clear-search",
    });
  }
  return descriptor({ kind: "ready" });
}

export function presentNoteSaveState({ dirty, phase, canonicalFailure }) {
  if (canonicalFailure) {
    return descriptor({
      kind: "failure",
      tone: "danger",
      message: "Save failed. Your draft is preserved.",
      announce: "assertive",
      persistent: true,
      actionId: "retry-save",
    });
  }
  if (phase === "saving") {
    return descriptor({ kind: "saving", message: "Saving…" });
  }
  if (dirty) {
    return descriptor({ kind: "unsaved", tone: "warning", message: "Unsaved" });
  }
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

export function presentApplicationRecoveryState({ storageUnavailable, resetConfirmationOpen }) {
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

Do not add runtime state to this module.

- [ ] **Step 4: Run mapper tests and content contract**

Run:

```sh
node --test tests/unit/state-presentation.test.mjs
npm run test:content
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```sh
git add ui/statePresentation.js tests/unit/state-presentation.test.mjs package.json
git commit -m "feat(ux): add state presentation vocabulary"
```

---

### Task 2: True first-run empty board and explicit empty/no-match actions

**Files:**
- Modify: `app.js`
- Modify: `ui/list.js`
- Modify: `styles.css`
- Test: `tests/e2e/state-recovery.spec.mjs`
- Regression: `tests/e2e/editor-list-contract.spec.mjs`, `tests/e2e/note-editor-overlay.spec.mjs`, `tests/e2e/japanese-filters.spec.mjs`

**Interfaces:**
- `createListView` gains `onCreate` and `onClear` callbacks; these emit UI intent only.
- `render` continues consuming canonical `notesById`, ordered visible IDs, active ID, and query.
- `app.js` owns mapping ordinary empty/no-match intent to existing command/search boundaries.

- [ ] **Step 1: Write browser RED for a fresh database**

Create `tests/e2e/state-recovery.spec.mjs`. Reuse the repository's static-server setup pattern and ensure IndexedDB is cleared before navigation. Add:

```js
test("fresh database remains empty until explicit create", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes yet");
  await expect(page.locator("#noteList .empty-state button")).toHaveText("New note");
  await expect(page.locator("#noteList .note-item")).toHaveCount(0);

  const countBefore = await page.evaluate(async () => {
    const request = indexedDB.open("myNoteDB", 3);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction("notes", "readonly");
    const countRequest = transaction.objectStore("notes").count();
    const count = await new Promise((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    db.close();
    return count;
  });
  expect(countBefore).toBe(0);

  await page.locator("#noteList .empty-state button").click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#noteList .note-item")).toHaveCount(1);
});
```

Add a second RED:

```js
test("no-match state is distinct and clear restores existing notes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.locator("#titleInput").fill("Alpha note");
  await page.locator("#contentInput").fill("existing content");
  await page.locator("#closeNoteEditorButton").click();

  await page.locator("#searchInput").fill("does-not-match");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");
  await page.locator("#noteList .empty-state button").click();
  await expect(page.locator("#searchInput")).toHaveValue("");
  await expect(page.locator("#noteList .note-item")).toContainText("Alpha note");
});
```

- [ ] **Step 2: Run the two tests and verify RED**

Run:

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "fresh database|no-match"
```

Expected: at least the fresh-database test fails because bootstrap auto-creates `Untitled`; action rendering also fails because current empty state is text-only.

- [ ] **Step 3: Remove bootstrap placeholder creation without changing persistence ownership**

In `app.js`, replace the zero-note bootstrap branch that calls `createNote(...)` with a normal empty render/query initialization. The resulting logic must leave `notes: []`, `activeId: null`, and perform no note persistence.

Use the existing workspace/render path, for example:

```js
if (loaded.length === 0) {
  await refreshSearch({ preferredId: null, emptyLabel: "No notes" });
  return;
}
```

If the workspace controller already handles an empty canonical snapshot without a query, prefer that existing path. Do not synthesize a placeholder note.

- [ ] **Step 4: Add explicit list actions without state ownership**

Change the constructor to:

```js
export function createListView({ container, onSelect, onCreate, onClear, formatDate }) {
```

Replace `clearToEmpty(message)` with an action-aware renderer:

```js
function clearToEmpty(presentation) {
  nodeCache.clear();
  container.dataset.virtualized = "false";
  container.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "empty-state";
  const message = document.createElement("p");
  message.textContent = presentation.message;
  const action = document.createElement("button");
  action.type = "button";
  action.className = "primary-button";
  action.textContent = presentation.kind === "empty" ? "New note" : "Clear search";
  action.addEventListener("click", presentation.kind === "empty" ? onCreate : onClear);
  empty.append(message, action);
  container.append(empty);
}
```

Use `presentBoardState` to classify `notesById.size`, `boardIds.length`, and query state. Keep `ui/list.js` free of store access.

In `app.js`, pass:

```js
onCreate() {
  runAction(() => executeCommand("notes.create", { source: "empty-state", target: els.newNoteButton }));
},
onClear() {
  els.searchInput.value = "";
  runAction(() => refreshSearch({ query: "" }));
},
```

- [ ] **Step 5: Add bounded empty-state CSS**

In `styles.css`, add only local layout rules; do not create a notification framework:

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

- [ ] **Step 6: Verify focused browser and list regressions**

Run:

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "fresh database|no-match"
npx playwright test tests/e2e/editor-list-contract.spec.mjs
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```sh
git add app.js ui/list.js styles.css tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): add true empty board states"
```

---

### Task 3: Note save failure, retry, and derived-degradation presentation

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `editor.css`
- Extend: `tests/e2e/state-recovery.spec.mjs`
- Extend regression evidence: `tests/integration/note-lifecycle.failure.test.mjs`

**Interfaces:**
- Existing lifecycle callbacks remain canonical truth.
- `app.js` may add presentation-only save phase/error flags to the existing shared store only if they are bounded scalar state and do not replace lifecycle truth.
- Retry uses existing `editor.save`/autosave flush behavior; no new persistence action.

- [ ] **Step 1: Add integration assertions for existing canonical ordering**

Extend `tests/integration/note-lifecycle.failure.test.mjs` with explicit assertions that a failed note upsert:

```js
assert.equal(state.notes[0].content, originalContent);
assert.equal(state.dirty, true);
assert.equal(history.listOperations().some((entry) => entry.op === "edit"), false);
```

For an injected derived update failure after successful persistence, assert the persisted note contains the new content while the derived-failure callback records degradation rather than canonical failure.

Run:

```sh
node --test tests/integration/note-lifecycle.failure.test.mjs
```

Expected: PASS if the invariant is already correctly implemented. If already GREEN, record the evidence and do not modify core lifecycle code.

- [ ] **Step 2: Add browser RED with test-only IndexedDB failure injection**

At the top of `tests/e2e/state-recovery.spec.mjs`, add a helper that installs before navigation and wraps `IDBDatabase.prototype.transaction` only inside the Playwright page. The wrapper must fail exactly one matching readwrite transaction and must not exist in production code:

```js
async function installDatabaseFailureHarness(page) {
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    let failure = null;

    Object.defineProperty(window, "__stateRecoveryDbTest", {
      configurable: true,
      value: {
        failNext(storeName) { failure = storeName; },
      },
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

The test-only global is injected by Playwright before app code and is never committed to runtime modules.

Add:

```js
test("note save failure preserves draft and retry succeeds without success toast", async ({ page }) => {
  await installDatabaseFailureHarness(page);
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.locator("#titleInput").fill("Durability test");
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

- [ ] **Step 3: Add non-spamming note status semantics**

In `index.html`, keep the visual `#saveState` out of an always-live region and add one action plus one bounded announcement node:

```html
<div id="noteStatusRegion" class="editor-save-region">
  <span id="saveState" class="editor-save-state">Saved</span>
  <button id="retryNoteSaveButton" class="quiet-button" type="button" hidden>Retry save</button>
  <span id="noteStatusAnnouncement" class="visually-hidden" role="status" aria-live="polite"></span>
</div>
```

Do not announce every `Unsaved → Saving → Saved` mutation.

- [ ] **Step 4: Map existing save truth in `app.js`**

Import mapper functions and add element references for the retry/announcement controls. Rework `renderTopline()` so canonical failure and derived degradation are distinct.

Use the existing `saveMessage` values as compatibility inputs during #72 rather than changing lifecycle callbacks:

```js
const canonicalFailure = state.saveMessage === "Storage unavailable"
  || state.saveMessage === "Safe mode: storage unavailable";
const derivedFailure = state.saveMessage === "Saved locally; search index unavailable";

const savePresentation = canonicalFailure
  ? presentNoteSaveState({ dirty: true, phase: "idle", canonicalFailure: true })
  : derivedFailure
    ? presentDerivedState({ searchUnavailable: true })
    : presentNoteSaveState({ dirty: state.dirty, phase: "idle", canonicalFailure: false });
```

Render the descriptor:

```js
els.saveState.textContent = savePresentation.message;
els.saveState.dataset.state = savePresentation.tone;
els.retryNoteSaveButton.hidden = savePresentation.actionId !== "retry-save";
```

Only copy attention-required messages into `#noteStatusAnnouncement`. Clear the announcement after the state is rendered, not with a success timer; use a remembered last announced descriptor key in `app.js` if necessary so repeated rerenders of the same failure do not re-announce.

Wire retry to the existing command boundary:

```js
els.retryNoteSaveButton.addEventListener("click", () => {
  runAction(() => executeCommand("editor.save", {
    source: "recovery-control",
    target: els.contentInput,
    activeScope: "editor",
  }));
});
```

- [ ] **Step 5: Add derived-search browser failure injection**

Extend the page harness with a test-only `Worker.prototype.postMessage` wrapper that fails exactly one `upsert` by delivering a synthetic bounded worker error response with the same request ID:

```js
const originalPostMessage = Worker.prototype.postMessage;
let failSearchUpsert = false;
window.__stateRecoverySearchTest = { failNextUpsert() { failSearchUpsert = true; } };
Worker.prototype.postMessage = function(message, transfer) {
  if (failSearchUpsert && message?.type === "upsert") {
    failSearchUpsert = false;
    queueMicrotask(() => this.onmessage?.({ data: { id: message.id, ok: false, error: "TEST_SEARCH_FAILURE" } }));
    return;
  }
  return originalPostMessage.call(this, message, transfer);
};
```

Add a browser test that saves a note, injects the next search upsert failure, edits/saves again, and asserts:

```js
await expect(page.locator("#saveState")).toContainText("Search");
await expect(page.locator("#saveState")).not.toContainText("Save failed");
```

Then reload/reopen and assert the newly edited canonical note content remains present.

- [ ] **Step 6: Add scoped note-state CSS**

In `editor.css`, style only descriptor tones and retry placement. Reuse existing design tokens:

```css
.editor-save-region {
  display: inline-flex;
  align-items: center;
  gap: var(--mn-space-2);
}

.editor-save-state[data-state="danger"] {
  color: var(--mn-danger-text);
}

.editor-save-state[data-state="warning"] {
  color: var(--mn-warning-text);
}
```

Do not add toast animation, timers, or fixed global banners.

- [ ] **Step 7: Run focused note state tests**

Run:

```sh
node --test tests/integration/note-lifecycle.failure.test.mjs
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "note save failure|derived"
npx playwright test tests/e2e/note-editor-overlay.spec.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```sh
git add index.html app.js editor.css tests/e2e/state-recovery.spec.mjs tests/integration/note-lifecycle.failure.test.mjs
git commit -m "feat(ux): add scoped note recovery states"
```

---

### Task 4: Non-destructive application storage recovery and reset confirmation

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`
- Extend: `tests/e2e/state-recovery.spec.mjs`

**Interfaces:**
- `bootstrap()` becomes safely retryable after an initial open failure.
- Application recovery UI calls existing `openDatabase`/`resetDatabase` boundaries; it never owns storage logic.
- Reset is performed only after explicit confirmation.

- [ ] **Step 1: Write bootstrap-failure RED using a one-shot `indexedDB.open` injection**

Before navigation, override only the first `indexedDB.open` call in the Playwright page:

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

Add:

```js
test("bootstrap storage failure is persistent and non-destructive before explicit reset", async ({ page }) => {
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });

  await page.goto("/");
  await expect(page.locator("#applicationRecovery")).toBeVisible();
  await expect(page.locator("#applicationRecovery")).toContainText("has not been reset");
  await page.waitForTimeout(150);
  expect(dialogs).toBe(0);

  await page.locator("#retryApplicationStorageButton").click();
  await expect(page.locator("#applicationRecovery")).toBeHidden();
});
```

Add reset cancellation:

```js
test("reset cancellation performs no mutation and restores focus", async ({ page }) => {
  // Seed one note through the normal UI, then expose the recovery surface through the test harness.
  // Open the explicit reset confirmation, click Cancel, and assert the note still exists after reload.
  await expect(page.locator("#cancelApplicationResetButton")).toBeFocused();
  await page.locator("#cancelApplicationResetButton").click();
  await expect(page.locator("#resetApplicationDataButton")).toBeFocused();
});
```

Implement the seed/exposure using the same test-only page harness; do not add a production debug switch.

- [ ] **Step 2: Run the two recovery tests and verify RED**

Run:

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "bootstrap storage|reset cancellation"
```

Expected: FAIL because current bootstrap uses a delayed destructive confirmation and no persistent recovery region exists.

- [ ] **Step 3: Add shell recovery markup**

Add to `index.html` outside the note overlay but inside the app shell:

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

- [ ] **Step 4: Replace delayed destructive bootstrap behavior**

In `app.js`, remove the timeout/`window.confirm` bootstrap failure path. Add bounded presentation state in the composition root:

```js
let applicationStorageUnavailable = false;
let resetOpener = null;
```

On bootstrap failure:

```js
applicationStorageUnavailable = true;
renderApplicationRecovery();
```

`renderApplicationRecovery()` uses `presentApplicationRecoveryState(...)`, sets the message, shows the recovery region, and never mutates storage.

Retry:

```js
async function retryApplicationStorage() {
  els.retryApplicationStorageButton.disabled = true;
  try {
    await bootstrap();
    applicationStorageUnavailable = false;
    renderApplicationRecovery();
  } catch {
    applicationStorageUnavailable = true;
    renderApplicationRecovery();
  } finally {
    els.retryApplicationStorageButton.disabled = false;
  }
}
```

Reset trigger opens the dialog and remembers focus. Cancel closes the dialog and restores focus to `#resetApplicationDataButton`. Confirm calls the existing `resetLocalData` path only after explicit user action; refactor `resetLocalData` so its storage mutation is separate from confirmation and no nested `window.confirm` remains.

- [ ] **Step 5: Add bounded shell CSS**

In `styles.css` add a single scoped recovery block. It must remain in normal DOM flow or a bounded fixed region without queueing multiple messages. No transition timer is required.

- [ ] **Step 6: Verify recovery and baseline reset behavior**

Run:

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "bootstrap storage|reset cancellation"
npx playwright test tests/e2e/editor-shell.spec.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```sh
git add index.html app.js styles.css tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): add non-destructive storage recovery"
```

---

### Task 5: Drawing save/delete/recovery presentation without changing drawing ownership

**Files:**
- Modify: `ui/kanjiInkView.js`
- Modify: `editor.css` or `kanji-ink.css` only if the existing drawing stylesheet owns these states
- Extend: `tests/e2e/state-recovery.spec.mjs`
- Regression: `tests/e2e/kanji-handwriting.spec.mjs`, `tests/e2e/note-drawing-projection.spec.mjs`
- Existing unit regression: `tests/unit/kanji-ink-controller.test.mjs`, `tests/unit/kanji-ink-application.test.mjs`

**Interfaces:**
- Consume `controller.snapshot().status` and `errorCode`; never add a second drawing state machine.
- `kanjiInkApplication.deleteEntry/restoreEntry/loadNoteContext` remain canonical lifecycle owners.
- Direct projection above title/body remains success evidence.

- [ ] **Step 1: Confirm existing controller failure guarantees are GREEN**

Run:

```sh
node --test tests/unit/kanji-ink-controller.test.mjs tests/unit/kanji-ink-application.test.mjs
```

Confirm existing tests cover failed save preserving draft/retry intent. If GREEN, do not change core drawing files.

- [ ] **Step 2: Add browser RED for failed drawing save then retry**

Reuse the test-only IndexedDB harness and fail the next `kanjiInkEntries` readwrite transaction. Add a test that:

1. creates/opens a note;
2. opens Add drawing;
3. draws a valid stroke;
4. injects failure for `kanjiInkEntries`;
5. clicks Save;
6. asserts dialog remains open, canvas still represents the draft, status says `Save failed. Your drawing is preserved.`, and Save is exposed as Retry;
7. clicks Retry;
8. asserts dialog closes and `#noteDrawingRegion` contains the saved projection;
9. asserts no generic success notification exists.

- [ ] **Step 3: Normalize `statusText(snapshot)` through the pure mapper**

In `ui/kanjiInkView.js` import `presentDrawingState` and replace save-state wording with the descriptor:

```js
function statusText(snapshot) {
  const presentation = presentDrawingState({
    status: snapshot.status === "saving" ? "saving" : snapshot.savedEntry ? "saved" : "ready",
    errorCode: snapshot.errorCode || "",
  });
  if (presentation.message) return presentation.message;
  if (pointerLimitMessage) return pointerLimitMessage;
  if (snapshot.strokes.length > 0) return `${snapshot.strokes.length} stroke${snapshot.strokes.length === 1 ? "" : "s"}`;
  return "";
}
```

Keep successful save silent: after canonical save and projection synchronization, close the dialog as today; do not render `Drawing saved`.

- [ ] **Step 4: Normalize delete failure and durable Undo copy**

Keep delete ordering unchanged. In the existing delete catch, derive the bounded error copy from presentation vocabulary or a small drawing-delete descriptor extension. Required message:

```text
Drawing couldn't be deleted. The saved drawing is unchanged. Try again.
```

Do not hide/remove the projection before `deleteEntry` succeeds. On success, show the existing bounded drawing Undo surface only after `synchronizeActiveNote()` confirms the committed state.

If the current Undo action lacks failure handling, add only adapter-level catch/presentation so a failed restore keeps the recovery opportunity visible; do not change storage semantics.

- [ ] **Step 5: Run drawing focused regressions**

Run:

```sh
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "drawing"
npx playwright test tests/e2e/kanji-handwriting.spec.mjs
npx playwright test tests/e2e/note-drawing-projection.spec.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```sh
git add ui/kanjiInkView.js editor.css kanji-ink.css tests/e2e/state-recovery.spec.mjs
git commit -m "feat(ux): normalize drawing recovery states"
```

Only add the stylesheet that actually changed.

---

### Task 6: Japanese empty/no-result/degraded/review-rating recovery

**Files:**
- Modify: `japaneseApp.js`
- Modify: `japanese.css`
- Modify: `ui/list.js` only if Japanese empty action requires a reusable presentation hook not completed in Task 2
- Extend: `tests/e2e/state-recovery.spec.mjs`
- Regression: `tests/e2e/japanese-filters.spec.mjs`, `tests/e2e/japanese-degraded-mode.spec.mjs`, `tests/e2e/japanese-progressive-disclosure.spec.mjs`, `tests/e2e/japanese-release-gate.spec.mjs`
- Existing integration regression: `tests/integration/japanese-lifecycle.test.mjs`

**Interfaces:**
- Existing coordinator/actions own workspace and canonical review transitions.
- `japaneseApp.js` may retain one bounded presentation-only variable for the current rating failure, e.g. `let reviewFailurePhase = ""`.
- Same rating buttons are the retry surface; do not add a parallel rating action.

- [ ] **Step 1: Extend integration evidence for rating failure ordering**

In `tests/integration/japanese-lifecycle.test.mjs`, use the existing injected persistence boundary to reject a review update and assert:

```js
assert.equal(state.reviewSession.currentNoteId, originalCurrentNoteId);
assert.equal(state.reviewSession.index, originalIndex);
assert.equal(state.reviewSession.status, "active");
```

Then allow persistence and retry the same rating; assert the session advances exactly once.

Run:

```sh
node --test --test-concurrency=1 tests/integration/japanese-lifecycle.test.mjs
```

If already GREEN, keep core actions unchanged.

- [ ] **Step 2: Add browser RED for Japanese no-result context**

In `tests/e2e/state-recovery.spec.mjs`, create at least one Japanese Grammar note, select Grammar, enter a text query that matches nothing, and assert:

```js
await expect(page.locator("#japaneseFilterStatus")).toContainText("No Japanese notes match these filters");
await expect(page.getByRole("button", { name: "Grammar" })).toHaveAttribute("aria-pressed", "true");
await expect(page.locator("#searchInput")).not.toHaveValue("");
```

Clear via the scoped action, then assert the Grammar/query state changes only according to the control explicitly invoked.

- [ ] **Step 3: Add browser RED for failed rating staying on the same item**

Use the test-only IndexedDB harness to fail the next `studyReviews` write. Capture title/progress before rating:

```js
const beforeTitle = await page.locator("#reviewNoteTitle").textContent();
const beforeProgress = await page.locator("#reviewProgress").textContent();
```

After clicking `Good`, assert:

```js
await expect(page.locator("#reviewNoteTitle")).toHaveText(beforeTitle);
await expect(page.locator("#reviewProgress")).toHaveText(beforeProgress);
await expect(page.locator("#reviewStatus")).toContainText("Rating wasn't saved");
```

Click `Good` again after the one-shot failure is consumed and assert the session advances or completes exactly once.

- [ ] **Step 4: Normalize review presentation in `japaneseApp.js`**

Add:

```js
let reviewFailurePhase = "";
```

In `submitRating`:

```js
reviewFailurePhase = "";
renderReview();
try {
  await actions.rateReview(session.currentNoteId, rating, currentContext().nowIso);
} catch {
  reviewFailurePhase = "rating-failed";
  renderReview();
  return;
} finally {
  for (const button of buttons) button.disabled = false;
}
renderReview();
```

In `renderReview()`, when `reviewFailurePhase === "rating-failed"`, use `presentJapaneseReviewState({ phase: "rating-failed" })` for `#reviewStatus`. Do not call `advanceReviewSession` from the catch path. Clear the failure on a successful retry, when opening a different session, or when the session completes.

Keep focus on the relevant rating control after failure; do not move it to the dialog close button.

- [ ] **Step 5: Normalize degraded and zero-due copy without exposing internal payloads**

When `state.studyDataUnavailable` is true, render one bounded Japanese-only warning using safe copy such as:

```text
Japanese study data is unavailable. Ordinary Notes are still available.
```

Do not surface raw error objects. In the visible repair region, keep only bounded codes/counts needed by the accepted diagnostics contract; do not add note body/title/review payloads.

Zero due remains healthy copy:

```text
No reviews due
```

and must not use danger/warning tone.

- [ ] **Step 6: Wire Japanese empty action through the existing create boundary**

When the Japanese workspace has zero canonical Japanese notes, render `No Japanese notes yet` plus `New Japanese note`. The button must open the existing `#japaneseCreateMenu`/registered create commands; it must not create a note directly.

If Task 2's `createListView` empty-action interface needs workspace-specific labels, extend the render payload with a pure `emptyPresentation` descriptor supplied by `app.js`/`japaneseApp.js`; do not have `ui/list.js` read `document.body.dataset.workspace` as application truth.

- [ ] **Step 7: Run Japanese focused regressions**

Run:

```sh
node --test --test-concurrency=1 tests/integration/japanese-lifecycle.test.mjs
npx playwright test tests/e2e/state-recovery.spec.mjs --grep "Japanese|rating"
npx playwright test tests/e2e/japanese-filters.spec.mjs
npx playwright test tests/e2e/japanese-degraded-mode.spec.mjs
npx playwright test tests/e2e/japanese-progressive-disclosure.spec.mjs
npx playwright test tests/e2e/japanese-release-gate.spec.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 6**

```sh
git add japaneseApp.js japanese.css ui/list.js tests/e2e/state-recovery.spec.mjs tests/integration/japanese-lifecycle.test.mjs
git commit -m "feat(ux): unify Japanese recovery states"
```

Only include files that changed.

---

### Task 7: Accessibility, bounded-resource audit, full verification, and pull request

**Files:**
- Modify only if RED requires: `index.html`, `styles.css`, `editor.css`, `japanese.css`, `ui/statePresentation.js`, `tests/e2e/state-recovery.spec.mjs`
- Documentation update if behavior text exists: `docs/cheatsheet.md` or current user-flow documentation only; do not create duplicate architecture authority.

**Interfaces:**
- No new runtime owners.
- One presentation per scope: note, drawing, Japanese review, shell recovery.

- [ ] **Step 1: Add accessibility assertions to the focused browser suite**

Add assertions that:

```js
await expect(page.locator("#saveState")).not.toHaveAttribute("aria-live");
await expect(page.locator("#noteStatusAnnouncement")).toHaveAttribute("aria-live", "polite");
```

For save failure, assert the title/body control that had focus still has focus after the failure. For reset cancellation, assert focus returns to `#resetApplicationDataButton`. For rating failure, assert focus remains inside `#reviewRatings` and the same item remains current.

For repeated identical failures, assert only one scoped error/recovery node exists:

```js
await expect(page.locator("#applicationRecovery")).toHaveCount(1);
await expect(page.locator("#noteStatusRegion")).toHaveCount(1);
await expect(page.locator("#kanjiInkRegion")).toHaveCount(1);
```

Do not add timing-based assertions for success notifications; successful state is validated by final DOM/canonical projection.

- [ ] **Step 2: Run the complete focused #72 suite**

Run:

```sh
node --test tests/unit/state-presentation.test.mjs
node --test tests/integration/note-lifecycle.failure.test.mjs
node --test --test-concurrency=1 tests/integration/japanese-lifecycle.test.mjs
npx playwright test tests/e2e/state-recovery.spec.mjs
```

Expected: PASS.

- [ ] **Step 3: Run affected regression suites before the full gate**

Run:

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

Expected: PASS. If a regression fails, debug locally and fix only #72-owned behavior. Do not push to use CI as a debugger.

- [ ] **Step 4: Audit forbidden ownership and resource growth**

Run:

```sh
git diff --name-only origin/dev...HEAD
git diff --check
git grep -n "setInterval\|setTimeout\|NotificationManager\|ToastStore\|FeedbackBus" -- app.js japaneseApp.js ui/statePresentation.js ui/list.js ui/kanjiInkView.js || true
```

Expected:

- no forbidden core-owner file changed;
- no new retry loop/polling/global notification manager;
- no raw error logging added;
- no production test flag added.

Also inspect `git diff origin/dev...HEAD` manually for content/query/vector/review payload leakage.

- [ ] **Step 5: Run the complete local verification gate exactly once after focused stability**

Run:

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

Expected: all repository-owned gates PASS.

If the Playwright OS dependency install alone fails because the local root filesystem is read-only, record the exact command/error and stop for reviewer authorization before treating it as environment-only. Do not retry `apt`, use `sudo`, or rerun remote CI.

- [ ] **Step 6: Commit any final bounded test/docs adjustment only if needed**

The plan targets six feature commits. If Step 1 required a final test/docs-only change not already included, use at most one seventh commit:

```sh
git add <only-the-actual-final-files>
git commit -m "test(ux): complete state recovery evidence"
```

Never create an empty commit. Total branch commits must remain at or below 8.

- [ ] **Step 7: Final branch audit before remote push**

Run:

```sh
git status --short
git log --oneline origin/dev..HEAD
git diff --stat origin/dev...HEAD
git diff --check
```

Expected: clean working tree; bounded #72 files only; at most 8 commits.

- [ ] **Step 8: Perform the single planned remote push and open one draft pull request**

Push once after local verification is stable:

```sh
git push -u origin issue/72-state-recovery
```

Open exactly one draft PR targeting `dev`. The PR body must record:

- issue #72;
- authoritative design path;
- current `dev` base SHA;
- head SHA;
- exact changed files;
- TDD RED→GREEN evidence;
- first-run zero-write evidence;
- note canonical-failure vs derived-degradation evidence;
- drawing save/delete/retry and direct-projection evidence;
- Japanese no-result/rating/degraded evidence;
- storage recovery/reset-cancel evidence;
- accessibility and retained-resource evidence;
- full local gate results;
- native 200% status;
- migration/security/privacy/rollback statements.

Do not merge.

- [ ] **Step 9: Let one automatic PR CI run, then stop**

Do not manually dispatch or rerun workflows. Do not push an empty/trial commit to retrigger CI.

If automatic CI passes, report the current-head run and stop for owner review.

If automatic CI fails, report the exact step, command, and failure evidence and stop. A subsequent fix/push iteration requires explicit reviewer authorization.

---

## Final Acceptance Mapping

Before marking the PR review-ready, verify every approved requirement maps to evidence:

- True first run: Task 2 browser + IndexedDB count evidence.
- Empty vs no-match: Task 2 mapper/browser evidence.
- Silent note success: Tasks 1/3 mapper + browser evidence.
- Note failure preserves draft: Task 3 integration/browser evidence.
- Derived degradation does not claim save failure: Task 3 integration/browser evidence.
- Drawing success via direct projection and no toast: Task 5 browser regression.
- Drawing failure/delete recovery: Task 5 controller/browser evidence.
- Japanese no-result context: Task 6 browser evidence.
- Rating failure stays on same item: Task 6 integration/browser evidence.
- Japanese degradation remains scoped: Task 6 degraded-mode regression.
- Durable delete-only Undo: existing editor/drawing lifecycle plus Tasks 3/5 regressions.
- Non-destructive bootstrap recovery/reset cancel: Task 4 browser evidence.
- Existing command availability owner: no registry duplication; regression suites remain green.
- Bounded live announcements/focus: Task 7 accessibility assertions.
- Content-free errors/privacy: mapper tests + diff audit.
- O(1) presentation resources: Task 7 repeated-failure DOM assertions and diff audit.
- No schema/owner/mobile scope change: file audit + full gate.
- Full repository verification: Task 7 complete gate and one automatic PR CI run.

## Stop Conditions

Stop immediately and report exact evidence instead of expanding scope if any accepted test appears to require:

- IndexedDB version/store/schema change;
- persistence transaction semantic change;
- scheduler semantic change;
- search ranking/index architecture change;
- parser ownership change;
- drawing controller/application ownership change;
- a second command-availability owner;
- a global notification/event bus;
- automatic retry/polling/background work;
- production failure-injection switches;
- logging note/review/drawing payloads;
- mobile/touch-first product behavior;
- runtime changes outside the approved adapter/presentation boundary without a demonstrated accepted RED.

After opening the PR and observing the single automatic CI result, stop. Do not merge and do not begin #73.