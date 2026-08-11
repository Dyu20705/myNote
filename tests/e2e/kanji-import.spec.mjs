import { expect, test } from "@playwright/test";

async function runCommand(page, title) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.locator("#commandInput").fill(title);
  await page.locator("#commandInput").press("Enter");
}

function importBundle() {
  const timestamp = "2026-08-04T02:00:00.000Z";
  return {
    schemaVersion: 3,
    exportedAt: timestamp,
    notes: [
      {
        id: "imported-kanji-note",
        title: "Imported Kanji bundle",
        content: "Imported canonical body",
        blocks: [
          {
            id: "imported-block",
            type: "paragraph",
            content: "Imported canonical body",
            meta: {},
          },
        ],
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        pinned: false,
        archived: false,
        links: [],
        ast: [{ type: "paragraph", text: "Imported canonical body" }],
        checksum: "746a026e",
        version: 1,
        searchBlob: "imported kanji bundle imported canonical body  ",
      },
    ],
    kanjiInkEntries: [
      {
        id: "imported-kanji-ink",
        noteId: "imported-kanji-note",
        schemaVersion: 1,
        revision: 1,
        character: "木",
        strokes: [
          [{ x: 0.17, y: 0.38 }, { x: 0.5, y: 0.36 }, { x: 0.84, y: 0.38 }],
          [{ x: 0.51, y: 0.1 }, { x: 0.5, y: 0.45 }, { x: 0.5, y: 0.91 }],
          [{ x: 0.49, y: 0.46 }, { x: 0.35, y: 0.67 }, { x: 0.13, y: 0.89 }],
          [{ x: 0.52, y: 0.47 }, { x: 0.66, y: 0.67 }, { x: 0.88, y: 0.89 }],
        ],
        recognizer: {
          engineId: "mynote-geometric-template",
          engineVersion: "1.0.0",
          datasetVersion: "mynote-kanji-mvp-1",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    recognizerAttribution: {
      engineId: "mynote-geometric-template",
      engineVersion: "1.0.0",
      datasetVersion: "mynote-kanji-mvp-1",
      source: "Project-owned geometric templates; no third-party runtime dataset.",
    },
  };
}

test("JSON import validates, restores atomically, and becomes searchable after reload", async ({ page }) => {
  await page.goto("/");

  const chooserPromise = page.waitForEvent("filechooser");
  await runCommand(page, "Import Kanji data from JSON");
  const chooser = await chooserPromise;
  const reloadPromise = page.waitForEvent("load");
  await chooser.setFiles({
    name: "kanji-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importBundle())),
  });
  await reloadPromise;

  await expect(page.locator("#noteCount")).toHaveText("2 notes");
  await page.locator("#searchInput").fill("Imported Kanji bundle");
  await expect(page.locator("#noteList .note-item-title")).toHaveText("Imported Kanji bundle");
  await page.locator("#noteList .note-item-title").click();
  await page.locator("#detailsButton").click();
  await expect(page.locator('#kanjiInkEntries [data-kanji-schema-version="1"]'))
    .toContainText("木");
  await expect(page.locator("#contentInput")).toHaveValue("Imported canonical body");
});

test("invalid JSON import reports failure without changing notes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");

  const chooserPromise = page.waitForEvent("filechooser");
  await runCommand(page, "Import Kanji data from JSON");
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json"),
  });

  await expect(page.locator("#kanjiImportStatus"))
    .toHaveText("Kanji import failed. No data changed.");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
});
