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
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill("Body remains canonical and vector-free.");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");
}

async function openKanjiDialog(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
}

async function openDetails(page) {
  if (await page.locator("#noteInspector").isHidden()) await page.locator("#detailsButton").click();
  await expect(page.locator("#noteInspector")).toBeVisible();
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
    const request = globalThis.indexedDB.open("myNoteDB", 3);
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

test("saved-grid canvas supports tools, history, durable editing, recovery, and export", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await createNote(page);
  const remoteRequests = [];
  page.on("request", (request) => {
    if (!new URL(request.url()).hostname.includes("127.0.0.1")) remoteRequests.push(request.url());
  });

  await openKanjiDialog(page);
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
  await openDetails(page);
  await expect(page.getByText("Kanji drawing", { exact: true })).toBeVisible();

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
  await openDetails(page);
  await page.getByRole("button", { name: "Edit Kanji drawing" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Kanji drawing" })).toBeVisible();
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  await drawStroke(page, [{ x: 0.25, y: 0.8 }, { x: 0.75, y: 0.2 }]);
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Kanji drawing" })).toBeFocused();
  const edited = await storedEntries(page);
  expect(edited[0].id).toBe(stableId);
  expect(edited[0].strokes).toHaveLength(2);

  const jsonDownloadPromise = page.waitForEvent("download");
  await runCommand(page, "Export Kanji data as JSON");
  const jsonDownload = await jsonDownloadPromise;
  const bundle = parseKanjiExportBundle(await readFile(await jsonDownload.path(), "utf8"));
  expect(bundle.schemaVersion).toBe(4);
  expect(bundle.kanjiInkEntries[0].schemaVersion).toBe(2);
  expect(JSON.stringify(bundle.kanjiInkEntries[0])).not.toContain("character");

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

test("legacy V1 cards remain read-only and losslessly exportable", async ({ page }) => {
  await createNote(page, "Legacy handwriting");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await page.evaluate(async ({ noteId: id }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
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
  await openDetails(page);
  const legacy = page.locator('[data-kanji-schema-version="1"]');
  await expect(legacy).toContainText("人");
  await expect(legacy).toContainText("read only");
  await expect(legacy.getByRole("button", { name: /Edit/ })).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await runCommand(page, "Export Kanji data as JSON");
  const download = await downloadPromise;
  const bundle = parseKanjiExportBundle(await readFile(await download.path(), "utf8"));
  expect(bundle.kanjiInkEntries[0].legacyVendorField).toEqual({ raw: "keep" });
});
