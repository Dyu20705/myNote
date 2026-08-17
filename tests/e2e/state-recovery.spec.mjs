import { expect, test } from "@playwright/test";

async function installDatabaseFailureHarness(page) {
  await page.addInitScript(() => {
    const originalTransaction = globalThis.IDBDatabase.prototype.transaction;
    let failure = null;
    Object.defineProperty(globalThis, "__stateRecoveryDbTest", {
      configurable: true,
      value: {
        failNext(storeName, mode = "readwrite") {
          failure = { storeName, mode };
        },
      },
    });
    globalThis.IDBDatabase.prototype.transaction = function transaction(storeNames, mode, options) {
      const names = Array.isArray(storeNames) ? storeNames : [storeNames];
      if (failure && mode === failure.mode && names.includes(failure.storeName)) {
        failure = null;
        throw new globalThis.DOMException(
          "Injected state recovery transaction failure",
          "InvalidStateError",
        );
      }
      return originalTransaction.call(this, storeNames, mode, options);
    };
  });
}

async function failNextSearchUpsert(page, expectedContent) {
  await page.evaluate(async (content) => {
    const { getActiveSearchClient } = await import("/core/searchClient.js");
    const searchClient = getActiveSearchClient();
    if (!searchClient) throw new Error("Active search client is unavailable");

    const originalUpsert = searchClient.upsert.bind(searchClient);
    let pendingFailure = true;
    searchClient.upsert = async (...args) => {
      if (pendingFailure && args[0]?.content === content) {
        pendingFailure = false;
        searchClient.upsert = originalUpsert;
        throw new Error("Injected derived search failure");
      }
      return originalUpsert(...args);
    };
  }, expectedContent);
}

async function openOrCreateNote(page) {
  const firstCard = page.locator("#noteList .note-item").first();
  if (await firstCard.count()) {
    await firstCard.click();
  } else {
    await page.getByRole("button", { name: "New note", exact: true }).first().click();
  }
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
}

async function saveDraft(page, { title, content }) {
  if (title !== undefined) await page.locator("#titleInput").fill(title);
  if (content !== undefined) await page.locator("#contentInput").fill(content);
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
}

async function closeEditor(page) {
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
}

async function drawStroke(page) {
  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Kanji canvas is not visible");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.75, { steps: 8 });
  await page.mouse.up();
}

test("fresh database remains empty until explicit create", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("0 notes");
  await expect(page.locator("#noteList .note-item")).toHaveCount(0);
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes yet");
  await expect(page.locator("#noteList .empty-state button")).toHaveText("New note");

  const storedCount = await page.evaluate(async () => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
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
  expect(storedCount).toBe(0);

  await page.locator("#noteList .empty-state button").click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#noteCount")).toHaveText("1 note");
});

test("ordinary no-match is distinct and Clear search restores notes", async ({ page }) => {
  await page.goto("/");
  await openOrCreateNote(page);
  await saveDraft(page, { title: "Alpha note", content: "existing content" });
  await closeEditor(page);

  await page.locator("#searchInput").fill("does-not-match");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator("#searchInput")).toHaveValue("");
  await expect(page.locator("#noteList .note-item")).toContainText("Alpha note");
});

test("note save failure preserves draft and retry succeeds quietly", async ({ page }) => {
  await installDatabaseFailureHarness(page);
  await page.goto("/");
  await openOrCreateNote(page);
  await saveDraft(page, { title: "Durability", content: "first durable value" });

  await page.evaluate(() => globalThis.__stateRecoveryDbTest.failNext("notes"));
  await page.locator("#contentInput").fill("draft that must survive");
  await page.locator("#contentInput").press("Control+Enter");

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#contentInput")).toHaveValue("draft that must survive");
  await expect(page.locator("#saveState")).toContainText("Save failed");
  await expect(page.locator("#retryNoteSaveButton")).toBeVisible();
  await expect(page.locator("#contentInput")).toBeFocused();

  await page.locator("#retryNoteSaveButton").click();
  await expect(page.locator("#saveState")).toHaveText("Saved");
  await expect(page.locator("[data-notification-kind='success']")).toHaveCount(0);
});

test("failed delete stays retryable and only durable delete exposes Undo without stealing focus", async ({ page }) => {
  await installDatabaseFailureHarness(page);
  await page.goto("/");
  await openOrCreateNote(page);
  await saveDraft(page, { title: "Delete safely", content: "keep until durable delete" });

  await page.evaluate(() => globalThis.__stateRecoveryDbTest.failNext("notes"));
  await page.locator("#noteActionsButton").click();
  const deleteAction = page.locator('[data-command-id="notes.delete"]');
  await deleteAction.click();

  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await expect(page.locator("#noteActionsPopover")).toBeVisible();
  await expect(page.locator("#saveState")).toContainText("Delete failed");
  await expect(page.locator("#undoNotice")).toBeHidden();
  await expect(deleteAction).toBeFocused();

  await deleteAction.click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  await expect(page.locator("#undoNotice")).toBeVisible();
  await expect(page.locator("#undoDeleteButton")).not.toBeFocused();
  await expect(page.locator("#newNoteButton")).toBeFocused();
});

test("derived search failure reports saved canonical data and survives reload", async ({ page }) => {
  await page.goto("/");
  await openOrCreateNote(page);
  await saveDraft(page, { title: "Canonical survives", content: "before derived failure" });

  await failNextSearchUpsert(page, "persisted despite search failure");
  await page.locator("#contentInput").fill("persisted despite search failure");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toContainText("Search");
  await expect(page.locator("#saveState")).not.toContainText("Save failed");

  await page.reload();
  await page.locator("#noteList .note-item").first().click();
  await expect(page.locator("#contentInput")).toHaveValue("persisted despite search failure");
});

test("bootstrap storage failure is persistent and non-destructive until explicit recovery", async ({ page }) => {
  await page.addInitScript(() => {
    const originalOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    let failOnce = true;
    globalThis.indexedDB.open = function open(...args) {
      if (failOnce) {
        failOnce = false;
        throw new globalThis.DOMException("Injected bootstrap failure", "InvalidStateError");
      }
      return originalOpen(...args);
    };
  });
  let dialogCount = 0;
  page.on("dialog", async (dialog) => {
    dialogCount += 1;
    await dialog.dismiss();
  });

  await page.goto("/");
  await expect(page.locator("#applicationRecovery")).toBeVisible();
  await expect(page.locator("#applicationRecovery")).toContainText("has not been reset");
  await page.waitForTimeout(150);
  expect(dialogCount).toBe(0);

  await page.locator("#retryApplicationStorageButton").click();
  await expect(page.locator("#applicationRecovery")).toBeHidden();
});

test("reset cancellation mutates no data and restores focus to Reset trigger", async ({ page }) => {
  await page.goto("/");
  await openOrCreateNote(page);
  await saveDraft(page, { title: "Preserve me", content: "must remain after cancel" });
  await closeEditor(page);

  await page.addInitScript(() => {
    const originalOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    let failOnce = true;
    globalThis.indexedDB.open = function open(...args) {
      if (failOnce) {
        failOnce = false;
        throw new globalThis.DOMException("Injected bootstrap failure", "InvalidStateError");
      }
      return originalOpen(...args);
    };
  });
  await page.reload();
  await expect(page.locator("#applicationRecovery")).toBeVisible();
  await page.locator("#resetApplicationDataButton").click();
  await expect(page.locator("#applicationResetDialog")).toBeVisible();
  await expect(page.locator("#cancelApplicationResetButton")).toBeFocused();
  await page.locator("#cancelApplicationResetButton").click();
  await expect(page.locator("#resetApplicationDataButton")).toBeFocused();

  await page.locator("#retryApplicationStorageButton").click();
  await expect(page.locator("#applicationRecovery")).toBeHidden();
  await expect(page.locator("#noteList .note-item")).toContainText("Preserve me");
});

test("drawing failure preserves draft, retry projects silently, and failed delete preserves saved drawing", async ({ page }) => {
  await installDatabaseFailureHarness(page);
  await page.goto("/");
  await openOrCreateNote(page);
  await saveDraft(page, { title: "Drawing recovery", content: "note content" });

  await page.locator("#noteActionsButton").click();
  await page.locator('[data-command-id="notes.kanji-ink"]').click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
  await drawStroke(page);

  await page.evaluate(() => globalThis.__stateRecoveryDbTest.failNext("kanjiInkEntries"));
  await page.locator("#saveKanjiButton").click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
  await expect(page.locator("#kanjiInkStatus")).toHaveText("Save failed. Your drawing is preserved.");
  await expect(page.locator("#saveKanjiButton")).toHaveAttribute("aria-label", "Retry save drawing");
  await expect(page.locator("#kanjiInkStatus")).not.toHaveAttribute("aria-live");
  await expect(page.locator("#kanjiInkAnnouncement")).toHaveAttribute("aria-live", "assertive");

  await page.locator("#saveKanjiButton").click();
  await expect(page.locator("#kanjiInkDialog")).toBeHidden();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);
  await expect(page.locator("[data-notification-kind='success']")).toHaveCount(0);

  await page.evaluate(() => globalThis.__stateRecoveryDbTest.failNext("kanjiInkEntries"));
  await page.getByRole("button", { name: "Delete Kanji drawing" }).click();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);
  await expect(page.locator("#kanjiInkRegionStatus")).toContainText("saved drawing is unchanged");
  await expect(page.locator("#kanjiInkRecovery")).toBeHidden();

  await page.getByRole("button", { name: "Delete Kanji drawing" }).click();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(0);
  await expect(page.locator("#kanjiInkRecovery")).toBeVisible();
});

test("Japanese no-result preserves context and rating failure keeps the same review item", async ({ page }) => {
  await installDatabaseFailureHarness(page);
  await page.goto("/");
  await page.locator("#japaneseWorkspaceButton").click();
  await page.locator("#newJapaneseNoteButton").click();
  await page.getByRole("button", { name: "Create grammar note" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await closeEditor(page);

  const grammar = page.getByRole("button", { name: "Grammar", exact: true });
  await grammar.click();
  await page.locator("#searchInput").fill("no-japanese-match");
  await expect(page.locator("#japaneseFilterStatus")).toHaveText("No Japanese notes match these filters");
  await expect(grammar).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#searchInput")).toHaveValue("no-japanese-match");
  await page.locator("#searchInput").fill("");

  await page.locator("#japaneseReviewEntryButton").click();
  await page.locator("#revealReviewButton").click();
  const originalTitle = await page.locator("#reviewNoteTitle").textContent();
  const originalProgress = await page.locator("#reviewProgress").textContent();
  const good = page.getByRole("button", { name: "Good", exact: true });
  await page.evaluate(() => globalThis.__stateRecoveryDbTest.failNext("studyReviews"));
  await good.click();

  await expect(page.locator("#reviewNoteTitle")).toHaveText(originalTitle || "");
  await expect(page.locator("#reviewProgress")).toHaveText(originalProgress || "");
  await expect(page.locator("#reviewStatus")).toHaveText(
    "Rating wasn't saved. This review item is unchanged. Try again.",
  );
  await expect(page.locator("#japaneseStateAnnouncement")).toHaveAttribute("aria-live", "assertive");
  await expect(good).toBeFocused();

  await good.click();
  await expect(page.locator("#reviewStatus")).not.toHaveText(
    "Rating wasn't saved. This review item is unchanged. Try again.",
  );
});

test("healthy visual statuses are not repeated live announcements", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#saveState")).not.toHaveAttribute("aria-live");
  await expect(page.locator("#noteStatusAnnouncement")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("#japaneseFilterStatus")).not.toHaveAttribute("aria-live");
  await expect(page.locator("#reviewStatus")).not.toHaveAttribute("aria-live");
  await expect(page.locator("#japaneseStateAnnouncement")).toHaveAttribute("aria-live", "polite");
  await expect(page.locator("#applicationRecovery")).toHaveCount(1);
  await expect(page.locator("#noteStatusRegion")).toHaveCount(1);
});
