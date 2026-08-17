import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { parseKanjiExportBundle } from "../../core/kanjiInkProjection.js";

async function runCommand(page, title) {
  await page.keyboard.press("Control+k");
  await page.locator("#commandInput").fill(title);
  await page.locator("#commandInput").press("Enter");
}

async function createNote(page, title = "Kanji canvas note") {
  await page.goto("/");
  await page.locator("#noteList .note-item").first().click();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill("Body remains canonical and vector-free.");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
}

async function openKanjiDialog(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add drawing/ }).click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
}

async function openDrawingProjection(page) {
  if (await page.locator("#noteEditorOverlay").isHidden()) {
    await page.locator("#noteList .note-item").first().click();
    await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  }
  await expect(page.locator("#noteDrawingRegion")).toBeVisible();
}

async function drawStroke(page, points) {
  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Kanji canvas is not visible");
  const [first, ...rest] = points;
  await page.mouse.move(box.x + first.x * box.width, box.y + first.y * box.height);
  await page.mouse.down();
  for (const point of rest) {
    await page.mouse.move(box.x + point.x * box.width, box.y + point.y * box.height, { steps: 4 });
  }
  await page.mouse.up();
}

async function storedEntries(page) {
  return page.evaluate(async () => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readonly");
    const read = transaction.objectStore("kanjiInkEntries").getAll();
    const entries = await new Promise((resolve, reject) => {
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    database.close();
    return entries;
  });
}

const PAGINATION_ENTRY_FIXTURES = [
  ["pagination-entry-001", "2026-08-01T00:00:01.000Z"],
  ["pagination-entry-002", "2026-08-01T00:00:02.000Z"],
  ["pagination-entry-003", "2026-08-01T00:00:03.000Z"],
  ["pagination-entry-004", "2026-08-01T00:00:04.000Z"],
  ["pagination-entry-005", "2026-08-01T00:00:05.000Z"],
  ["pagination-entry-006", "2026-08-01T00:00:06.000Z"],
  ["pagination-entry-007", "2026-08-01T00:00:07.000Z"],
  ["pagination-entry-008", "2026-08-01T00:00:08.000Z"],
  ["pagination-entry-009", "2026-08-01T00:00:09.000Z"],
  ["pagination-entry-010", "2026-08-01T00:00:10.000Z"],
  ["pagination-entry-011", "2026-08-01T00:00:11.000Z"],
  ["pagination-entry-012", "2026-08-01T00:00:12.000Z"],
  ["pagination-entry-013", "2026-08-01T00:00:13.000Z"],
  ["pagination-entry-014", "2026-08-01T00:00:14.000Z"],
  ["pagination-entry-015", "2026-08-01T00:00:15.000Z"],
  ["pagination-entry-016", "2026-08-01T00:00:16.000Z"],
  ["pagination-entry-017", "2026-08-01T00:00:17.000Z"],
  ["pagination-entry-018", "2026-08-01T00:00:18.000Z"],
  ["pagination-entry-019", "2026-08-01T00:00:19.000Z"],
  ["pagination-entry-020", "2026-08-01T00:00:20.000Z"],
  ["pagination-entry-021", "2026-08-01T00:00:21.000Z"],
  ["pagination-entry-022", "2026-08-01T00:00:22.000Z"],
  ["pagination-entry-023", "2026-08-01T00:00:23.000Z"],
  ["pagination-entry-024", "2026-08-01T00:00:24.000Z"],
  ["pagination-entry-025", "2026-08-01T00:00:25.000Z"],
  ["pagination-entry-026", "2026-08-01T00:00:26.000Z"],
  ["pagination-entry-027", "2026-08-01T00:00:27.000Z"],
  ["pagination-entry-028", "2026-08-01T00:00:28.000Z"],
  ["pagination-entry-029", "2026-08-01T00:00:29.000Z"],
  ["pagination-entry-030", "2026-08-01T00:00:30.000Z"],
  ["pagination-entry-031", "2026-08-01T00:00:31.000Z"],
  ["pagination-entry-032", "2026-08-01T00:00:32.000Z"],
  ["pagination-entry-033", "2026-08-01T00:00:33.000Z"],
  ["pagination-entry-034", "2026-08-01T00:00:34.000Z"],
  ["pagination-entry-035", "2026-08-01T00:00:35.000Z"],
  ["pagination-entry-036", "2026-08-01T00:00:36.000Z"],
  ["pagination-entry-037", "2026-08-01T00:00:37.000Z"],
  ["pagination-entry-038", "2026-08-01T00:00:38.000Z"],
  ["pagination-entry-039", "2026-08-01T00:00:39.000Z"],
  ["pagination-entry-040", "2026-08-01T00:00:40.000Z"],
  ["pagination-entry-041", "2026-08-01T00:00:41.000Z"],
  ["pagination-entry-042", "2026-08-01T00:00:42.000Z"],
  ["pagination-entry-043", "2026-08-01T00:00:43.000Z"],
  ["pagination-entry-044", "2026-08-01T00:00:44.000Z"],
  ["pagination-entry-045", "2026-08-01T00:00:45.000Z"],
  ["pagination-entry-046", "2026-08-01T00:00:46.000Z"],
  ["pagination-entry-047", "2026-08-01T00:00:47.000Z"],
  ["pagination-entry-048", "2026-08-01T00:00:48.000Z"],
  ["pagination-entry-049", "2026-08-01T00:00:49.000Z"],
  ["pagination-entry-050", "2026-08-01T00:00:50.000Z"],
  ["pagination-entry-051", "2026-08-01T00:00:51.000Z"],
  ["pagination-entry-052", "2026-08-01T00:00:52.000Z"],
  ["pagination-entry-053", "2026-08-01T00:00:53.000Z"],
  ["pagination-entry-054", "2026-08-01T00:00:54.000Z"],
  ["pagination-entry-055", "2026-08-01T00:00:55.000Z"],
  ["pagination-entry-056", "2026-08-01T00:00:56.000Z"],
  ["pagination-entry-057", "2026-08-01T00:00:57.000Z"],
  ["pagination-entry-058", "2026-08-01T00:00:58.000Z"],
  ["pagination-entry-059", "2026-08-01T00:00:59.000Z"],
  ["pagination-entry-060", "2026-08-01T00:01:00.000Z"],
  ["pagination-entry-061", "2026-08-01T00:01:01.000Z"],
  ["pagination-entry-062", "2026-08-01T00:01:02.000Z"],
  ["pagination-entry-063", "2026-08-01T00:01:03.000Z"],
  ["pagination-entry-064", "2026-08-01T00:01:04.000Z"],
  ["pagination-entry-065", "2026-08-01T00:01:05.000Z"],
];

async function preloadPaginationEntries(page, noteId, fixtures) {
  await page.evaluate(async ({ fixtures: entries, noteId: id }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    for (const [entryId, timestamp] of entries) {
      transaction.objectStore("kanjiInkEntries").put({
        id: entryId,
        noteId: id,
        strokes: [{ tool: "pen", width: 0.008, points: [{ x: 0.2, y: 0.2, t: 0 }, { x: 0.8, y: 0.8, t: 1 }] }],
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
  }, { fixtures, noteId });
}

test("saved-grid canvas supports tools, history, durable editing, recovery, and export", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await createNote(page);
  const remoteRequests = [];
  page.on("request", (request) => {
    if (!new URL(request.url()).hostname.includes("127.0.0.1")) remoteRequests.push(request.url());
  });

  await openKanjiDialog(page);
  await expect(page.locator("#kanjiInkCanvas")).toHaveAttribute("data-paper-pattern", "ruled-horizontal");
  await expect(page.locator("#kanjiInkCanvas")).toHaveAttribute("data-paper-rule-count", "7");
  await expect(page.locator("#recognizeKanjiButton, #kanjiCandidateList, #kanjiSelectedCharacter")).toHaveCount(0);
  const controls = ["Close", "Pen", "Marker", "Eraser", "Undo", "Redo", "Clear", "Save drawing"];
  for (const name of controls) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toHaveAttribute("title", name);
  }
  await expect(page.getByRole("button", { name: "Pen", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Save drawing", exact: true })).toBeDisabled();

  await drawStroke(page, [{ x: 0.15, y: 0.2 }, { x: 0.35, y: 0.75 }]);
  await expect(page.locator("#kanjiInkStatus")).toHaveText("1 stroke");
  await page.getByRole("button", { name: "Marker", exact: true }).click();
  await drawStroke(page, [{ x: 0.65, y: 0.2 }, { x: 0.82, y: 0.75 }]);
  await expect(page.locator("#kanjiInkStatus")).toHaveText("2 strokes");
  await page.getByRole("button", { name: "Eraser", exact: true }).click();
  await drawStroke(page, [{ x: 0.14, y: 0.48 }, { x: 0.36, y: 0.48 }]);
  await expect(page.locator("#kanjiInkStatus")).toHaveText("1 stroke");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#kanjiInkStatus")).toHaveText("2 strokes");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator("#kanjiInkStatus")).toHaveText("1 stroke");

  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("region", { name: "Discard handwriting draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep drawing" })).toBeFocused();
  await page.getByRole("button", { name: "Keep drawing" }).click();
  await expect(page.locator("#kanjiInkCanvas")).toBeFocused();
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  await openDrawingProjection(page);
  await expect(page.getByText("Kanji drawing", { exact: true })).toBeVisible();
  await expect(page.locator(".kanji-entry-preview")).toHaveAttribute("data-paper-pattern", "ruled-horizontal");
  await expect(page.locator(".kanji-entry-preview")).toHaveAttribute("data-paper-rule-count", "7");

  const first = await storedEntries(page);
  expect(first).toHaveLength(1);
  expect(first[0].schemaVersion).toBe(2);
  expect(first[0].paperStyle).toBe("grid");
  expect(first[0].strokes).toHaveLength(1);
  expect(first[0].strokes[0].tool).toBe("marker");
  expect(first[0].strokes[0].width).toBe(0.024);
  expect(first[0].strokes[0].points[0].t).toBe(0);
  expect(first[0].strokes[0].points.every((point, index, points) => index === 0 || point.t >= points[index - 1].t)).toBe(true);
  const stableId = first[0].id;

  await page.reload();
  await openDrawingProjection(page);
  await page.getByRole("button", { name: "Edit Kanji drawing" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Kanji drawing" })).toBeVisible();
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  await drawStroke(page, [{ x: 0.25, y: 0.8 }, { x: 0.75, y: 0.2 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Kanji drawing" })).toBeFocused();
  const edited = await storedEntries(page);
  expect(edited[0].id).toBe(stableId);
  expect(edited[0].strokes).toHaveLength(2);

  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  const jsonDownloadPromise = page.waitForEvent("download");
  await runCommand(page, "Export Kanji data as JSON");
  const jsonDownload = await jsonDownloadPromise;
  const bundle = parseKanjiExportBundle(await readFile(await jsonDownload.path(), "utf8"));
  expect(bundle.schemaVersion).toBe(4);
  expect(bundle.kanjiInkEntries[0].schemaVersion).toBe(2);
  expect(JSON.stringify(bundle.kanjiInkEntries[0])).not.toContain("character");

  await openDrawingProjection(page);
  await page.getByRole("button", { name: "Delete Kanji drawing" }).click();
  await expect(page.locator("#kanjiInkEntries .kanji-entry")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo handwriting deletion" }).click();
  await expect(page.locator("#kanjiInkEntries .kanji-entry")).toHaveCount(1);
  expect(remoteRequests).toEqual([]);
});

test("pointer cancellation and DPR resize leave normalized geometry usable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await createNote(page, "Pointer lifecycle");
  await openKanjiDialog(page);
  const canvas = page.locator("#kanjiInkCanvas");
  await canvas.dispatchEvent("pointerdown", { pointerId: 91, button: 0, clientX: 300, clientY: 260 });
  await canvas.dispatchEvent("pointermove", { pointerId: 91, button: 0, clientX: 360, clientY: 300 });
  await canvas.dispatchEvent("pointercancel", { pointerId: 91, button: 0, clientX: 360, clientY: 300 });
  await canvas.dispatchEvent("pointerdown", { pointerId: 92, button: 0, clientX: 420, clientY: 280 });
  await canvas.dispatchEvent("lostpointercapture", { pointerId: 92 });
  await page.evaluate(() => {
    Object.defineProperty(globalThis, "devicePixelRatio", { configurable: true, value: 2 });
    globalThis.dispatchEvent(new globalThis.Event("resize"));
  });
  await drawStroke(page, [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  const entries = await storedEntries(page);
  expect(entries).toHaveLength(1);
  expect(entries[0].strokes.every((stroke) => stroke.points.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1))).toBe(true);
});

test("the stroke limit preserves recovery controls and a valid save", async ({ page }) => {
  await createNote(page, "Bounded strokes");
  await openKanjiDialog(page);

  for (let index = 0; index < 32; index += 1) {
    const y = 0.05 + index * 0.028;
    await drawStroke(page, [{ x: 0.1, y }, { x: 0.85, y }]);
  }
  await expect(page.locator("#kanjiInkStatus")).toHaveText("32 strokes");
  await drawStroke(page, [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.2 }]);
  await expect(page.locator("#kanjiInkStatus")).toHaveText("Drawing limit reached. Undo, erase, clear, or save to continue.");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("#kanjiInkStatus")).toHaveText("31 strokes");
  await drawStroke(page, [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.2 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();

  const entries = await storedEntries(page);
  expect(entries).toHaveLength(1);
  expect(entries[0].strokes).toHaveLength(32);
});

test("total point capacity rejects a new stroke before silently dropping its gesture", async ({ page }) => {
  await createNote(page, "Bounded points");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await page.evaluate(async ({ noteId: id }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const strokes = Array.from({ length: 16 }, (_, strokeIndex) => ({
      tool: "pen",
      width: 0.008,
      points: Array.from({ length: strokeIndex === 15 ? 255 : 256 }, (_, pointIndex) => ({
        x: pointIndex / 255,
        y: strokeIndex / 16,
        t: pointIndex,
      })),
    }));
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").put({
      id: "near-total-point-limit",
      noteId: id,
      strokes,
      paperStyle: "grid",
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      schemaVersion: 2,
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { noteId });

  await page.reload();
  await openDrawingProjection(page);
  await page.getByRole("button", { name: "Edit Kanji drawing" }).click();
  await drawStroke(page, [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]);
  await expect(page.locator("#kanjiInkStatus")).toHaveText("Drawing limit reached. Undo, erase, clear, or save to continue.");

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await drawStroke(page, [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  const entries = await storedEntries(page);
  const saved = entries.find((entry) => entry.id === "near-total-point-limit");
  expect(saved.strokes).toHaveLength(1);
  expect(saved.strokes.reduce((total, stroke) => total + stroke.points.length, 0)).toBe(5);
});

test("Escape finalizes an active gesture before keeping and saving the draft", async ({ page }) => {
  await createNote(page, "Active gesture close");
  await openKanjiDialog(page);
  const box = await page.locator("#kanjiInkCanvas").boundingBox();
  if (!box) throw new Error("Kanji canvas is not visible");
  const activePointer = 712;
  await page.locator("#kanjiInkCanvas").dispatchEvent("pointerdown", {
    pointerId: activePointer,
    button: 0,
    clientX: box.x + box.width * 0.2,
    clientY: box.y + box.height * 0.2,
  });
  await page.locator("#kanjiInkCanvas").dispatchEvent("pointermove", {
    pointerId: activePointer,
    button: 0,
    clientX: box.x + box.width * 0.8,
    clientY: box.y + box.height * 0.8,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Discard handwriting draft" })).toBeVisible();
  await page.getByRole("button", { name: "Keep drawing" }).click();
  await drawStroke(page, [{ x: 0.2, y: 0.8 }, { x: 0.8, y: 0.2 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();

  const entries = await storedEntries(page);
  expect(entries).toHaveLength(1);
  expect(entries[0].strokes).toHaveLength(2);
});

test("newest-first pagination keeps a 65th drawing reachable with edit and delete actions", async ({ page }) => {
  await createNote(page, "Paginated handwriting");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await preloadPaginationEntries(page, noteId, PAGINATION_ENTRY_FIXTURES);

  await page.reload();
  await openDrawingProjection(page);
  await expect(page.locator("#kanjiInkCount")).toHaveText("65 entries");
  await expect(page.locator("#kanjiInkEntries .kanji-entry")).toHaveCount(1);
  await expect(page.locator("#kanjiInkEntries .kanji-entry").first()).toHaveAttribute("data-kanji-entry-id", "pagination-entry-065");
  await expect(page.locator('[data-kanji-entry-id="pagination-entry-001"]')).toHaveCount(0);

  const loadMore = page.getByRole("button", { name: "Show older drawings", exact: true });
  await expect(loadMore).toBeVisible();
  await loadMore.click();
  await expect(page.locator("#kanjiInkEntries .kanji-entry")).toHaveCount(64);
  await expect(page.locator('[data-kanji-entry-id="pagination-entry-001"]')).toHaveCount(0);
  await loadMore.click();

  const oldestCard = page.locator('[data-kanji-entry-id="pagination-entry-001"]');
  await expect(oldestCard).toBeVisible();
  await expect(oldestCard.getByRole("button", { name: "Edit Kanji drawing", exact: true })).toBeFocused();
  await oldestCard.getByRole("button", { name: "Edit Kanji drawing", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit Kanji drawing" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await oldestCard.getByRole("button", { name: "Delete Kanji drawing", exact: true }).click();
  await expect(oldestCard).toHaveCount(0);
});

test("newest-first ordering compares parsed instants and breaks equal-instant ties by id", async ({ page }) => {
  await createNote(page, "Offset timestamp ordering");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await preloadPaginationEntries(page, noteId, [
    ["offset-newest", "2026-08-01T01:00:00-02:00"],
    ["offset-equal-a", "2026-08-01T03:00:00+03:00"],
    ["offset-equal-b", "2026-08-01T00:00:00.000Z"],
  ]);

  await page.reload();
  await openDrawingProjection(page);
  await page.getByRole("button", { name: "Show older drawings", exact: true }).click();
  const visibleEntries = page.locator("#kanjiInkEntries .kanji-entry");
  await expect(visibleEntries).toHaveCount(3);
  expect(await visibleEntries.evaluateAll((cards) => (
    cards.map((card) => card.dataset.kanjiEntryId)
  ))).toEqual(["offset-newest", "offset-equal-a", "offset-equal-b"]);
});

test("a fresh 65th drawing stays visible while older drawings remain reachable", async ({ page }) => {
  await createNote(page, "Fresh paginated handwriting");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await preloadPaginationEntries(page, noteId, PAGINATION_ENTRY_FIXTURES.slice(0, 64));

  await page.reload();
  await openDrawingProjection(page);
  await expect(page.locator("#kanjiInkCount")).toHaveText("64 entries");
  await expect(page.locator("#kanjiInkEntries .kanji-entry")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Show older drawings", exact: true })).toBeVisible();

  await openKanjiDialog(page);
  await drawStroke(page, [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  await openDrawingProjection(page);

  const entries = await storedEntries(page);
  const freshEntry = entries.find((entry) => !PAGINATION_ENTRY_FIXTURES.some(([id]) => id === entry.id));
  expect(freshEntry).toBeDefined();
  await expect(page.locator(`#kanjiInkEntries [data-kanji-entry-id="${freshEntry.id}"]`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Show older drawings", exact: true })).toBeVisible();
});

test("legacy V1 cards remain read-only and losslessly exportable", async ({ page }) => {
  await createNote(page, "Legacy handwriting");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await page.evaluate(async ({ noteId: id }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 4);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").put({
      id: "legacy-v1", noteId: id, schemaVersion: 1, revision: 1, character: "人",
      strokes: [[{ x: 0.55, y: 0.1 }, { x: 0.2, y: 0.9 }], [{ x: 0.55, y: 0.1 }, { x: 0.9, y: 0.9 }]],
      recognizer: { engineId: "mynote-geometric-template", engineVersion: "1.0.0", datasetVersion: "mynote-kanji-mvp-1", selectedRank: 0 },
      createdAt: "2026-08-04T00:00:00.000Z", updatedAt: "2026-08-04T00:00:00.000Z",
      legacyVendorField: { raw: "keep" },
    });
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
    database.close();
  }, { noteId });
  await page.reload();
  await openDrawingProjection(page);
  const legacy = page.locator('[data-kanji-schema-version="1"]');
  await expect(legacy).toContainText("人");
  await expect(legacy).toContainText("read only");
  const legacyPreview = legacy.locator(".kanji-entry-preview");
  await expect(legacyPreview).not.toHaveAttribute("data-paper-pattern", "ruled-horizontal");
  await expect(legacyPreview).not.toHaveAttribute("data-paper-rule-count", "7");
  await expect(legacyPreview).toHaveAttribute("data-paper-rendered", "true");
  expect(await legacyPreview.evaluate((canvas) => {
    const context = canvas.getContext("2d");
    return Array.from(context.getImageData(2, 2, 1, 1).data);
  })).toEqual([255, 255, 255, 255]);
  await expect(legacy.getByRole("button", { name: /Edit/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Close note editor" }).click();
  await expect(page.locator("#noteEditorOverlay")).toBeHidden();
  const downloadPromise = page.waitForEvent("download");
  await runCommand(page, "Export Kanji data as JSON");
  const download = await downloadPromise;
  const bundle = parseKanjiExportBundle(await readFile(await download.path(), "utf8"));
  expect(bundle.kanjiInkEntries[0].legacyVendorField).toEqual({ raw: "keep" });
});
