import { expect, test } from "@playwright/test";

import { closeNoteEditor, createJapaneseNoteFromMenu } from "./japanese-helpers.mjs";

async function openFirstNote(page) {
  if (await page.locator("#noteEditorOverlay").isHidden()) {
    await page.locator("#noteList .note-item").first().click();
  }
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
}

async function createOrdinaryFixture(page) {
  await page.goto("/");
  await openFirstNote(page);
  await page.locator("#titleInput").fill("Drawing projection fixture");
  await page.locator("#contentInput").fill("Canonical body remains vector-free.");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
  return page.evaluate(async () => (await import("/core/state.js")).getActiveStore().getState().activeId);
}

async function openDrawingDialog(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add drawing/ }).click();
  await expect(page.getByRole("dialog", { name: "Draw Kanji" })).toBeVisible();
}

async function drawStroke(page) {
  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Kanji canvas is not visible");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 6 });
  await page.mouse.up();
}

async function seedDrawings(page, noteId, count) {
  await page.evaluate(async ({ noteId: id, count: entryCount }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    for (let index = 0; index < entryCount; index += 1) {
      const timestamp = new Date(Date.UTC(2026, 7, 12, 0, 0, index)).toISOString();
      transaction.objectStore("kanjiInkEntries").put({
        id: `issue-90-drawing-${index}`,
        noteId: id,
        strokes: [{
          tool: "pen",
          width: 0.008,
          points: [{ x: 0.2, y: 0.2, t: 0 }, { x: 0.8, y: 0.8, t: 1 }],
        }],
        paperStyle: "grid",
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: 2,
      });
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { noteId, count });
}

async function readCanonicalFixture(page, noteId) {
  return page.evaluate(async (id) => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["notes", "kanjiInkEntries"], "readonly");
    const noteRequest = transaction.objectStore("notes").get(id);
    const entriesRequest = transaction.objectStore("kanjiInkEntries").index("noteId").getAll(id);
    const result = await new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve({ note: noteRequest.result, entries: entriesRequest.result });
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    return result;
  }, noteId);
}

async function abortNextInkMutation(page, method) {
  await page.evaluate((methodName) => {
    const prototype = globalThis.IDBObjectStore.prototype;
    const original = prototype[methodName];
    prototype[methodName] = function abortInkMutation(...args) {
      const request = original.apply(this, args);
      if (this.name === "kanjiInkEntries") {
        prototype[methodName] = original;
        queueMicrotask(() => {
          try { this.transaction.abort(); } catch { /* transaction already settled */ }
        });
      }
      return request;
    };
  }, method);
}

test("saved drawing projects directly above title and survives reopen without mutating note content", async ({ page }) => {
  const noteId = await createOrdinaryFixture(page);
  const drawingRegion = page.locator("#noteDrawingRegion");
  await expect(drawingRegion).toBeHidden();

  await openDrawingDialog(page);
  await drawStroke(page);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();

  await expect(drawingRegion).toBeVisible();
  await expect(drawingRegion.locator(".kanji-entry")).toHaveCount(1);
  await expect(drawingRegion.locator(".kanji-entry-preview")).toHaveAttribute("data-paper-rendered", "true");
  await expect(page.locator("#noteInspector")).toBeHidden();
  expect(await page.evaluate(() => {
    const region = globalThis.document.getElementById("noteDrawingRegion");
    const title = globalThis.document.getElementById("titleInput");
    return Boolean(region.compareDocumentPosition(title) & globalThis.Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(page.locator("#titleInput")).toHaveValue("Drawing projection fixture");
  await expect(page.locator("#contentInput")).toHaveValue("Canonical body remains vector-free.");

  const canonical = await readCanonicalFixture(page, noteId);
  expect(canonical.entries).toHaveLength(1);
  expect(canonical.note.title).toBe("Drawing projection fixture");
  expect(canonical.note.content).toBe("Canonical body remains vector-free.");
  expect(JSON.stringify(canonical.note)).not.toContain("strokes");
  expect(JSON.stringify(canonical.note)).not.toContain("paperStyle");

  await closeNoteEditor(page);
  await openFirstNote(page);
  await expect(drawingRegion).toBeVisible();
  await page.reload();
  await openFirstNote(page);
  await expect(drawingRegion).toBeVisible();
  await expect(drawingRegion.locator(".kanji-entry-preview")).toHaveAttribute("data-paper-rendered", "true");
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 720, height: 450 },
]) {
  test(`multiple drawings stay bounded above reachable title/body at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const noteId = await createOrdinaryFixture(page);
    await seedDrawings(page, noteId, 3);
    await page.evaluate(async () => (await import("/ui/kanjiInkView.js")).kanjiInkApp.synchronize());

    const region = page.locator("#noteDrawingRegion");
    await expect(region).toBeVisible();
    await expect(region.locator(".kanji-entry")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Show older drawings", exact: true })).toBeVisible();
    await expect(page.locator("#titleInput")).toBeInViewport();
    await expect(page.locator("#contentInput")).toBeInViewport();

    const metrics = await region.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      maxHeight: Number.parseFloat(globalThis.getComputedStyle(element).maxHeight),
    }));
    expect(metrics.clientHeight).toBeLessThanOrEqual(metrics.maxHeight);

    await page.getByRole("button", { name: "Show older drawings", exact: true }).click();
    await expect(region.locator(".kanji-entry")).toHaveCount(3);
    await expect(page.locator("#titleInput")).toBeInViewport();
    expect(await page.evaluate(() => (
      globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth
    ))).toBe(true);
  });
}

test("ordinary and Japanese notes share the direct drawing projection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  const noteId = await page.evaluate(async () => (await import("/core/state.js")).getActiveStore().getState().activeId);
  await seedDrawings(page, noteId, 1);
  await page.evaluate(async () => (await import("/ui/kanjiInkView.js")).kanjiInkApp.synchronize());

  await expect(page.locator("#noteDrawingRegion")).toBeVisible();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);
  await expect(page.locator("#noteEditorOverlay")).toHaveAttribute("data-mode", "create");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
});

test("drawing save and delete failure preserve canonical data with explicit recovery state", async ({ page }) => {
  const noteId = await createOrdinaryFixture(page);
  await openDrawingDialog(page);
  await drawStroke(page);
  await abortNextInkMutation(page, "add");
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(page.locator("#kanjiInkStatus")).toHaveText("Save failed. Your drawing is preserved; retry save.");
  await expect(page.getByRole("dialog", { name: "Draw Kanji" })).toBeVisible();
  expect((await readCanonicalFixture(page, noteId)).entries).toHaveLength(0);

  await page.getByRole("button", { name: "Retry save drawing", exact: true }).click();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);
  const saved = await readCanonicalFixture(page, noteId);
  const savedId = saved.entries[0].id;

  await abortNextInkMutation(page, "delete");
  await page.getByRole("button", { name: "Delete Kanji drawing", exact: true }).click();
  await expect(page.locator("#kanjiInkRegionStatus")).toHaveText("Delete failed. The saved drawing is unchanged.");
  await expect(page.locator(`[data-kanji-entry-id="${savedId}"]`)).toBeVisible();
  expect((await readCanonicalFixture(page, noteId)).entries.map((entry) => entry.id)).toEqual([savedId]);
});
