import { expect, test } from "@playwright/test";

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
  await page.evaluate(async (fixture) => {
    await new Promise((resolve, reject) => {
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
    });
  }, { version, notes, reviews });
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
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page.getByRole("button", { name: "日本語" })).toHaveAttribute("aria-pressed", "true");
}

async function runCommand(page, title) {
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.locator("#commandInput").fill(title);
  const downloadPromise = title.startsWith("Export all") ? page.waitForEvent("download") : null;
  await page.locator("#commandInput").press("Enter");
  return downloadPromise ? downloadPromise : undefined;
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
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await openJapaneseWorkspace(page);

  const createActions = [
    "Create vocabulary note",
    "Create kanji note",
    "Create grammar note",
    "Create today’s output note",
    "Create this week’s planner",
  ];

  for (const [index, action] of createActions.entries()) {
    await page.getByRole("button", { name: action }).click();
    await expect(page.locator("#noteCount")).toHaveText(`${index + 2} notes`);
  }

  await expect(page.locator("#japaneseDueCount")).toHaveText("5");
  await expect(page.locator("#japaneseNewVocabulary")).toHaveText("1");
  await expect(page.locator("#japaneseDueKanji")).toHaveText("1");
  await expect(page.locator("#japaneseGrammarTotal")).toHaveText("1");
  await expect(page.locator("#japaneseOutputStreak")).toHaveText("1 day");
  await expect(page.locator("#japanesePlannerProgress")).toHaveText("0 / 6");

  await page.getByRole("button", { name: "Create today’s output note" }).click();
  await page.getByRole("button", { name: "Create this week’s planner" }).click();
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

  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("button", { name: "Reveal review content" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Resume review" })).toBeFocused();
  await page.getByRole("button", { name: "Resume review" }).click();

  const ratings = ["Again", "Hard", "Good", "Easy", "Good"];
  for (const [index, rating] of ratings.entries()) {
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

  await page.getByRole("button", { name: "Create vocabulary note" }).click();
  await expect(page.locator("#noteCount")).toHaveText("2 notes");

  snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toHaveLength(1);
  expect(snapshot.reviews[0].noteId).not.toBe(existing.id);
});

test("valid orphan review remains durable and appears as bounded repair state", async ({ page }) => {
  const existing = ordinaryNote("ordinary-v2");
  await seedDatabase(page, {
    version: 2,
    notes: [existing],
    reviews: [validReview("orphan-review")],
  });

  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await openJapaneseWorkspace(page);

  await expect(page.getByRole("region", { name: "Needs repair" })).toContainText("orphan-review");
  await expect(page.getByRole("region", { name: "Needs repair" })).toContainText("×1");
  await expect(page.locator("#japaneseDueCount")).toHaveText("0");
  await expect(page.getByRole("button", { name: "Start review" })).toBeDisabled();

  const snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toEqual([validReview("orphan-review")]);
});

test("invalid persisted review keeps Notes operational and exposes bounded Japanese bootstrap failure", async ({ page }) => {
  const existing = ordinaryNote("ordinary-with-invalid-review");
  await seedDatabase(page, {
    version: 2,
    notes: [existing],
    reviews: [{ noteId: "invalid-review" }],
  });

  await page.goto("/");
  await expect(page.locator("#noteCount")).toHaveText("1 note");
  await expect(page.locator("#titleInput")).toHaveValue("Existing ordinary note");

  await openJapaneseWorkspace(page);
  await expect(page.getByRole("region", { name: "Needs repair" })).toContainText("study-data-unavailable");
  await expect(page.getByRole("button", { name: "Start review" })).toBeDisabled();
  for (const button of await page.getByRole("group", { name: "Japanese quick create" }).getByRole("button").all()) {
    await expect(button).toBeDisabled();
  }

  const snapshot = await readDatabaseSnapshot(page, existing.id);
  expect(snapshot.note).toEqual(existing);
  expect(snapshot.reviews).toEqual([{ noteId: "invalid-review" }]);
});

test("Markdown and JSON exports retain Japanese note content while scheduling metadata stays separate", async ({ page }) => {
  const title = "日本語 export fixture";
  const content = "日本語の本文\n\n学習内容をそのまま保持する。";

  await page.goto("/");
  await openJapaneseWorkspace(page);
  await page.getByRole("button", { name: "Create vocabulary note" }).click();
  await page.locator("#titleInput").fill(title);
  await page.locator("#contentInput").fill(content);
  await page.locator("#saveButton").click();
  await expect(page.locator("#saveState")).toHaveText("Saved locally");

  const activeId = await page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    return getActiveStore().getState().activeId;
  });

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

  const japaneseButton = page.getByRole("button", { name: "日本語" });
  await japaneseButton.focus();
  await page.keyboard.press("Enter");
  await expect(japaneseButton).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Create vocabulary note" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#japaneseDueCount")).toHaveText("1");

  const startButton = page.getByRole("button", { name: "Start review" });
  await startButton.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal review content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("1");
  await expect(page.getByText("Review complete")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(startButton).toBeFocused();

  const viewportFits = await page.evaluate(() => (
    globalThis.document.documentElement.scrollWidth <= globalThis.document.documentElement.clientWidth
  ));
  expect(viewportFits).toBe(true);
});
