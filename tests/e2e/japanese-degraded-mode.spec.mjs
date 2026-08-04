import { expect, test } from "@playwright/test";

async function seedInvalidReview(page) {
  await page.route("**/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Fixture setup</title>",
    });
  }, { times: 1 });
  await page.goto("/");

  await page.evaluate(async () => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open("myNoteDB", 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      const notesStore = database.createObjectStore("notes", { keyPath: "id" });
      notesStore.createIndex("updatedAt", "updatedAt");
      notesStore.createIndex("pinned", "pinned");
      notesStore.createIndex("archived", "archived");
      const reviewStore = database.createObjectStore("studyReviews", { keyPath: "noteId" });
      reviewStore.createIndex("nextReviewAt", "nextReviewAt");
      reviewStore.createIndex("notebookType", "notebookType");
      reviewStore.createIndex("status", "status");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["notes", "studyReviews"], "readwrite");
      transaction.objectStore("notes").add({
        id: "ordinary-note",
        title: "Ordinary note",
        content: "Unrelated content",
        blocks: [],
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        pinned: false,
        archived: false,
        links: [],
        ast: [],
        checksum: "fixture",
        searchBlob: "ordinary note unrelated content",
        version: 1,
      });
      transaction.objectStore("studyReviews").add({ noteId: "invalid-review" });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  }));
}

test("invalid study data retains Japanese commands with an actionable reason", async ({ page }) => {
  await seedInvalidReview(page);
  await page.goto("/");

  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.getByRole("region", { name: "Needs repair" }))
    .toContainText("study-data-unavailable");

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.locator("#commandInput").fill("Create vocabulary note");
  const command = page.locator("#commandList [data-command-id='legacy.japanese-create-vocabulary']");
  await expect(command).toBeVisible();
  await expect(command).toHaveAttribute("aria-disabled", "true");
  await expect(command).toContainText("Japanese study data is unavailable");
});
