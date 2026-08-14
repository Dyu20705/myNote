import { expect, test } from "@playwright/test";
import {
  closeNoteEditor,
  createJapaneseNoteFromMenu,
  openJapaneseReview,
  openJapaneseStudyDetails,
} from "./japanese-helpers.mjs";

async function openBlankOrigin(page) {
  await page.route("**/", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>Fixture setup</title>",
    });
  }, { times: 1 });
  await page.goto("/");
}

async function seedDatabase(page, { version, notes = [], reviews = [] }) {
  await openBlankOrigin(page);
  await page.evaluate(async (fixture) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open("myNoteDB", fixture.version);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("notes")) {
        const notesStore = database.createObjectStore("notes", { keyPath: "id" });
        notesStore.createIndex("updatedAt", "updatedAt");
        notesStore.createIndex("pinned", "pinned");
        notesStore.createIndex("archived", "archived");
      }
      if (fixture.version >= 2 && !database.objectStoreNames.contains("studyReviews")) {
        const reviewStore = database.createObjectStore("studyReviews", { keyPath: "noteId" });
        reviewStore.createIndex("nextReviewAt", "nextReviewAt");
        reviewStore.createIndex("notebookType", "notebookType");
        reviewStore.createIndex("status", "status");
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const stores = fixture.version >= 2 ? ["notes", "studyReviews"] : ["notes"];
      const transaction = database.transaction(stores, "readwrite");
      for (const note of fixture.notes) {
        transaction.objectStore("notes").add(note);
      }
      if (fixture.version >= 2) {
        for (const review of fixture.reviews) {
          transaction.objectStore("studyReviews").add(review);
        }
      }
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  }), { version, notes, reviews });
}

async function readDatabaseSnapshot(page, noteId) {
  return page.evaluate(async (id) => new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open("myNoteDB");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["notes", "studyReviews"], "readonly");
      const noteRequest = transaction.objectStore("notes").get(id);
      const reviewsRequest = transaction.objectStore("studyReviews").getAll();
      transaction.oncomplete = () => {
        database.close();
        resolve({ note: noteRequest.result, reviews: reviewsRequest.result });
      };
      transaction.onerror = () => reject(transaction.error);
    };
  }), noteId);
}

async function openJapaneseWorkspace(page) {
  const japaneseButton = page.getByRole("button", { name: "日本語", exact: true });
  await japaneseButton.click();
  await expect(japaneseButton).toHaveAttribute("aria-pressed", "true");
}

async function runCommand(page, title) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.locator("#commandInput").fill(title);
  const downloadPromise = title.startsWith("Export all") ? page.waitForEvent("download") : null;
  await page.locator("#commandInput").press("Enter");
  return downloadPromise ?? undefined;
}

async function flushEditor(page) {
  await page.locator("#contentInput").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");
}

async function downloadText(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function ordinaryNote(id, overrides = {}) {
  return {
    id,
    title: "Existing ordinary note",
    content: "日本語 content with #jp-vocabulary but no review enrollment.",
    blocks: [{ id: "legacy-block", type: "text", content: "exact bytes" }],
    tags: ["manual"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-02-03T04:05:06.000Z",
    pinned: true,
    archived: false,
    links: ["stale-link"],
    ast: [{ type: "legacy" }],
    checksum: "legacy-checksum",
    searchBlob: "legacy-search-projection",
    version: 7,
    ...overrides,
  };
}

function validReview(noteId, notebookType = "vocabulary", overrides = {}) {
  return {
    noteId,
    notebookType,
    status: "new",
    lastReviewedAt: null,
    nextReviewAt: "2026-07-31T12:00:00.000Z",
    interval: 0,
    ease: 2.5,
    ...overrides,
  };
}

test("fresh database completes all five templates, duplicate guards, dashboard metrics, close/resume, and all rating controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("0 notes");
  await openJapaneseWorkspace(page);

  const createActions = [
    "Create vocabulary note",
    "Create kanji note",
    "Create grammar note",
    "Create today’s output note",
    "Create this week’s planner",
  ];
  for (const [index, action] of createActions.entries()) {
    await createJapaneseNoteFromMenu(page, action);
    await expect(page.locator("#noteCount")).toHaveText(`${index + 2} notes`);
    await closeNoteEditor(page);
  }

  await expect(page.locator("#japaneseDueCount")).toHaveText("5");
  await expect(page.locator("#japaneseNewVocabulary")).toHaveText("1");
  await expect(page.locator("#japaneseDueKanji")).toHaveText("1");
  await expect(page.locator("#japaneseGrammarTotal")).toHaveText("1");
  await expect(page.locator("#japaneseOutputStreak")).toHaveText("1 day");
  await expect(page.locator("#japanesePlannerProgress")).toHaveText("0 / 6");

  await createJapaneseNoteFromMenu(page, "Create today’s output note");
  await closeNoteEditor(page);
  await createJapaneseNoteFromMenu(page, "Create this week’s planner");
  await closeNoteEditor(page);
  await expect(page.locator("#noteCount")).toHaveText("6 notes");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(5);

  const enrollment = await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const state = getActiveStore().getState();
    return {
      noteIds: state.japaneseNoteIds,
      types: state.studyReviews.map((review) => review.notebookType).sort(),
    };
  });
  expect(enrollment.noteIds).toHaveLength(5);
  expect(enrollment.types).toEqual(["grammar", "kanji", "output", "planner", "vocabulary"]);

  const reviewEntry = await openJapaneseReview(page);
  await page.getByRole("button", { name: "Reveal review content" }).click();
  await page.keyboard.press("Escape");
  await expect(reviewEntry).toBeFocused();
  await reviewEntry.click();

  for (const [index, rating] of ["Again", "Hard", "Good", "Easy", "Good"].entries()) {
    if (index > 0) {
      await page.getByRole("button", { name: "Reveal review content" }).click();
    }
    await page.getByRole("button", { name: rating }).click();
  }

  await expect(page.getByText("Review complete")).toBeVisible();
  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
});

test("populated v1 upgrade preserves exact note bytes and never enrolls existing notes automatically", async ({ page }) => {
  const existing = ordinaryNote("existing-v1");
  await seedDatabase(page, { version: 1, notes: [existing] });

  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await expect(page.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");

  let snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toEqual([]);

  await openJapaneseWorkspace(page);
  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
  await expect(page.locator("#noteList .note-item-title")).toHaveCount(0);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await expect(page.locator("#noteCount")).toHaveText("2 notes");

  snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toHaveLength(1);
  expect(snapshot.reviews[0].noteId).not.toBe(existing.id);
});

test("valid orphan review remains durable and appears as bounded repair state", async ({ page }) => {
  const existing = ordinaryNote("ordinary-v2");
  const orphanNoteId = "missing-review-owner";
  await seedDatabase(page, {
    version: 2,
    notes: [existing],
    reviews: [validReview(orphanNoteId)],
  });

  await page.goto("/");
  await openJapaneseWorkspace(page);
  await openJapaneseStudyDetails(page);
  const repair = page.getByRole("region", { name: "Needs repair" });
  await expect(repair).toContainText("orphan-review");
  await expect(repair).not.toContainText(orphanNoteId);
  await expect(repair).toContainText("×1");
  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
  await expect(page.locator("#japaneseReviewEntryButton")).toBeDisabled();

  const snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toEqual([validReview(orphanNoteId)]);
});

test("invalid persisted review keeps Notes operational and exposes bounded Japanese bootstrap failure", async ({ page }) => {
  const existing = ordinaryNote("ordinary-with-invalid-review");
  await seedDatabase(page, {
    version: 2,
    notes: [existing],
    reviews: [{ noteId: "invalid-review" }],
  });

  await page.goto("/");
  await expect(page.locator("#titleInput")).toHaveValue("Existing ordinary note");
  await openJapaneseWorkspace(page);
  await openJapaneseStudyDetails(page);
  await expect(page.getByRole("region", { name: "Needs repair" })).toContainText("study-data-unavailable");
  await expect(page.locator("#japaneseReviewEntryButton")).toBeDisabled();
  await expect(page.getByRole("button", { name: "New Japanese note" })).toBeDisabled();

  const snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toEqual([{ noteId: "invalid-review" }]);
});

test("Markdown and JSON exports retain Japanese note content while scheduling metadata stays separate", async ({ page }) => {
  const title = "日本語 export fixture";
  const content = "日本語の本文\n\n学習内容をそのまま保持する。";

  await page.goto("/");
  await openJapaneseWorkspace(page);
  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await expect.poll(async () => page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const state = getActiveStore().getState();
    return state.studyReviews.some((review) => (
      review.noteId === state.activeId && review.notebookType === "vocabulary"
    ));
  })).toBe(true);

  const activeId = await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    return getActiveStore().getState().activeId;
  });
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await flushEditor(page);
  await closeNoteEditor(page);

  await expect.poll(async () => {
    const snapshot = await readDatabaseSnapshot(page, activeId);
    return { title: snapshot.note?.title, content: snapshot.note?.content };
  }).toEqual({ title, content });

  const jsonDownload = await runCommand(page, "Export all as JSON");
  const exportedJson = JSON.parse(await downloadText(jsonDownload));
  const exportedNote = exportedJson.find((note) => note.id === activeId);
  expect(exportedNote.title).toBe(title);
  expect(exportedNote.content).toBe(content);
  expect(exportedNote).not.toHaveProperty("notebookType");
  expect(exportedNote).not.toHaveProperty("nextReviewAt");
  expect(exportedNote).not.toHaveProperty("ease");

  const markdownDownload = await runCommand(page, "Export all as Markdown");
  const exportedMarkdown = await downloadText(markdownDownload);
  expect(exportedMarkdown).toContain(`# ${title}`);
  expect(exportedMarkdown).toContain(content);
  expect(exportedMarkdown).not.toContain("nextReviewAt");
  expect(exportedMarkdown).not.toContain("ease: 2.5");

  const snapshot = await readDatabaseSnapshot(page, activeId);
  const review = snapshot.reviews.find((item) => item.noteId === activeId);
  expect(review.notebookType).toBe("vocabulary");
  expect(review).toHaveProperty("nextReviewAt");
  expect(review).toHaveProperty("ease");
});

test("narrow reduced-motion keyboard path preserves focus, modal semantics, and viewport bounds", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const japaneseButton = page.getByRole("button", { name: "日本語", exact: true });
  await japaneseButton.focus();
  await page.keyboard.press("Enter");
  await expect(japaneseButton).toHaveAttribute("aria-pressed", "true");

  const createTrigger = page.getByRole("button", { name: "New Japanese note" });
  await createTrigger.focus();
  await page.keyboard.press("Enter");
  const vocabularyAction = page.getByRole("group", { name: "New Japanese note" })
    .getByRole("button", { name: "Create vocabulary note" });
  await expect(vocabularyAction).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#japaneseDueCount")).toHaveText("1");
  await expect(page.locator("#titleInput")).toHaveValue("New vocabulary");
  await expect(page.locator("#titleInput")).toBeFocused();
  await closeNoteEditor(page);

  const reviewEntry = page.locator("#japaneseReviewEntryButton");
  await reviewEntry.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal review content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("1");
  await expect(page.getByText("Review complete")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reviewEntry).toBeDisabled();
  await expect(japaneseButton).toBeFocused();

  const viewportFits = await page.evaluate(() => (
    globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth
  ));
  expect(viewportFits).toBe(true);
});
