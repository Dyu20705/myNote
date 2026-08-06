import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

async function runCommand(page, title) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.locator("#commandInput").fill(title);
  await page.locator("#commandInput").press("Enter");
}

async function openKanjiDialog(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await expect(page.getByRole("dialog", { name: "Add Kanji handwriting" })).toBeVisible();
}

async function drawStrokes(page, strokes) {
  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Kanji canvas is not visible");

  for (const stroke of strokes) {
    const [first, ...rest] = stroke;
    await page.mouse.move(box.x + (first.x * box.width), box.y + (first.y * box.height));
    await page.mouse.down();
    for (const point of rest) {
      await page.mouse.move(box.x + (point.x * box.width), box.y + (point.y * box.height), { steps: 3 });
    }
    await page.mouse.up();
  }
}

const PERSON = [
  [{ x: 0.53, y: 0.08 }, { x: 0.45, y: 0.34 }, { x: 0.32, y: 0.63 }, { x: 0.14, y: 0.92 }],
  [{ x: 0.53, y: 0.08 }, { x: 0.58, y: 0.35 }, { x: 0.72, y: 0.66 }, { x: 0.9, y: 0.93 }],
];

const TREE = [
  [{ x: 0.17, y: 0.38 }, { x: 0.5, y: 0.36 }, { x: 0.84, y: 0.38 }],
  [{ x: 0.51, y: 0.1 }, { x: 0.5, y: 0.45 }, { x: 0.5, y: 0.91 }],
  [{ x: 0.49, y: 0.46 }, { x: 0.35, y: 0.67 }, { x: 0.13, y: 0.89 }],
  [{ x: 0.52, y: 0.47 }, { x: 0.66, y: 0.67 }, { x: 0.88, y: 0.89 }],
];

async function storedEntries(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readonly");
    const getAll = transaction.objectStore("kanjiInkEntries").getAll();
    const entries = await new Promise((resolve, reject) => {
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    });
    database.close();
    return entries;
  });
}

test("Kanji handwriting dual representation is local, durable, searchable, editable, exportable, and recoverable", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await page.locator("#titleInput").fill("Kanji workflow note");
  await page.locator("#contentInput").fill("Body remains canonical and vector-free.");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");

  await openKanjiDialog(page);
  await expect(page.locator("#recognizeKanjiButton")).toBeDisabled();
  await expect(page.locator("#saveKanjiButton")).toBeDisabled();
  await drawStrokes(page, PERSON);
  await expect(page.locator("#recognizeKanjiButton")).toBeEnabled();

  const recognitionRequests = [];
  const recordRequest = (request) => recognitionRequests.push(request.url());
  page.on("request", recordRequest);
  await page.locator("#recognizeKanjiButton").click();
  await expect(page.locator("#kanjiCandidateList button")).toHaveCount(8);
  page.off("request", recordRequest);
  expect(recognitionRequests).toEqual([]);

  await expect(page.locator("#saveKanjiButton")).toBeDisabled();
  await page.locator('#kanjiCandidateList button[data-character="人"]').click();
  await expect(page.locator("#saveKanjiButton")).toBeEnabled();
  await page.locator("#saveKanjiButton").click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  await expect(page.locator("#kanjiInkEntries [data-kanji-character]"))
    .toHaveText("人");

  const firstStored = await storedEntries(page);
  expect(firstStored).toHaveLength(1);
  expect(firstStored[0].character).toBe("人");
  expect(JSON.stringify(firstStored[0].strokes)).not.toContain("Body remains canonical");
  const stableId = firstStored[0].id;

  await page.locator("#searchInput").fill("人");
  await expect(page.locator("#noteList .note-item-title")).toHaveText("Kanji workflow note");
  await page.locator("#searchInput").fill("");

  await page.reload();
  await expect(page.locator("#kanjiInkEntries [data-kanji-character]"))
    .toHaveText("人");
  await page.getByRole("button", { name: "Edit handwriting 人" }).click();
  await expect(page.getByRole("dialog", { name: "Edit Kanji handwriting" })).toBeVisible();
  await page.locator("#clearKanjiButton").click();
  await drawStrokes(page, TREE);
  await page.locator("#recognizeKanjiButton").click();
  await page.locator('#kanjiCandidateList button[data-character="木"]').click();
  await page.locator("#saveKanjiButton").click();
  await expect(page.locator("#kanjiInkEntries [data-kanji-character]"))
    .toHaveText("木");

  const editedStored = await storedEntries(page);
  expect(editedStored).toHaveLength(1);
  expect(editedStored[0].id).toBe(stableId);
  expect(editedStored[0].revision).toBe(2);
  expect(editedStored[0].character).toBe("木");

  const jsonDownloadPromise = page.waitForEvent("download");
  await runCommand(page, "Export Kanji data as JSON");
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe("myNote-kanji-export.json");
  const jsonPath = await jsonDownload.path();
  const json = JSON.parse(await readFile(jsonPath, "utf8"));
  expect(json.schemaVersion).toBe(3);
  expect(json.kanjiInkEntries).toHaveLength(1);
  expect(json.kanjiInkEntries[0].character).toBe("木");
  expect(json.notes[0].content).toBe("Body remains canonical and vector-free.");

  await page.getByRole("button", { name: "Delete handwriting 木" }).click();
  await expect(page.locator("#kanjiInkEntries [data-kanji-character]")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo handwriting deletion" }).click();
  await expect(page.locator("#kanjiInkEntries [data-kanji-character]"))
    .toHaveText("木");

  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Delete active note/ }).click();
  await expect(page.locator("#undoNotice")).toBeVisible();
  await page.locator("#undoDeleteButton").click();
  await expect(page.locator("#kanjiInkEntries [data-kanji-character]"))
    .toHaveText("木");
});

test("Kanji dialog remains keyboard-operable at desktop 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    document.documentElement.style.zoom = "200%";
  });
  await openKanjiDialog(page);
  await expect(page.locator("#closeKanjiDialogButton")).toBeVisible();
  await expect(page.locator("#recognizeKanjiButton")).toBeVisible();
  await expect(page.locator("#saveKanjiButton")).toBeVisible();
  await page.locator("#closeKanjiDialogButton").click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  await expect(page.locator("#noteActionsButton")).toBeFocused();
});
