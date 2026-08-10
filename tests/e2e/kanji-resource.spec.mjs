import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth === globalThis.document.documentElement.clientWidth)).toBe(true);
}

async function openAndClose(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
  await page.waitForFunction(() => globalThis.document.querySelector('link[data-kanji-ink-styles="true"]')?.sheet?.cssRules.length > 0);
  expect(await page.locator(".kanji-ink-shell").evaluate((shell) => (
    [...shell.children].slice(0, 5).map((child) => child.className)
  ))).toEqual([
    "kanji-ink-header",
    "kanji-ink-toolbar",
    "kanji-canvas-frame",
    "kanji-ink-footer",
    "kanji-ink-status",
  ]);
  await expect(page.locator("#kanjiInkCanvas")).toHaveAttribute("data-paper-pattern", "ruled-horizontal");
  await expect(page.locator("#kanjiInkCanvas")).toHaveAttribute("data-paper-rule-count", "7");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  await expect(page.locator("#noteActionsButton")).toBeFocused();
  await expectNoHorizontalOverflow(page);
}

test("repeated open and close retains one dialog, stylesheet, command, and bounded desktop layout", async ({ page }) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await openAndClose(page);
  }

  for (let iteration = 0; iteration < 17; iteration += 1) await openAndClose(page);
  await expect(page.locator("#kanjiInkDialog")).toHaveCount(1);
  await expect(page.locator('link[data-kanji-ink-styles="true"]')).toHaveCount(1);
  await page.locator("#noteActionsButton").click();
  await expect(page.getByRole("menuitem", { name: /Add Kanji handwriting/ })).toHaveCount(1);

  await page.keyboard.press("Escape");
  // A 1440×900 desktop at 200% browser zoom exposes a 720×450 CSS viewport.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await page.waitForFunction(() => globalThis.document.querySelector('link[data-kanji-ink-styles="true"]')?.sheet?.cssRules.length > 0);
  const dialogBox = await page.locator("#kanjiInkDialog").boundingBox();
  const canvasBox = await page.locator("#kanjiInkCanvas").boundingBox();
  const toolbarBox = await page.getByRole("toolbar", { name: "Drawing tools" }).boundingBox();
  const footerBox = await page.locator(".kanji-ink-footer").boundingBox();
  for (const box of [dialogBox, canvasBox, toolbarBox, footerBox]) expect(box).not.toBeNull();
  expect(canvasBox.width / canvasBox.height).toBeCloseTo(2, 2);
  expect(canvasBox.y).toBeGreaterThanOrEqual(dialogBox.y);
  expect(canvasBox.y + canvasBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
  expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);
  const responsiveMetrics = await page.locator("#kanjiInkDialog").evaluate((dialog) => {
    const shell = dialog.querySelector(".kanji-ink-shell");
    return {
      dialog: { clientHeight: dialog.clientHeight, scrollHeight: dialog.scrollHeight },
      shell: { clientHeight: shell.clientHeight, scrollHeight: shell.scrollHeight },
    };
  });
  expect(responsiveMetrics.dialog.scrollHeight).toBe(responsiveMetrics.dialog.clientHeight);
  expect(responsiveMetrics.shell.scrollHeight).toBe(responsiveMetrics.shell.clientHeight);
  await expect(page.getByRole("toolbar", { name: "Drawing tools" })).toBeInViewport();
  await expect(page.locator(".kanji-ink-footer")).toBeInViewport();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("#noteActionsButton")).toBeFocused();
});

test("capture fallback finishes outside releases and leaves no temporary document listeners", async ({ page }) => {
  await page.goto("/");
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Kanji canvas is not visible");
  await page.evaluate(() => {
    const canvasElement = globalThis.document.getElementById("kanjiInkCanvas");
    canvasElement.setPointerCapture = () => { throw new Error("capture unavailable"); };
    const add = globalThis.document.addEventListener.bind(globalThis.document);
    const remove = globalThis.document.removeEventListener.bind(globalThis.document);
    globalThis.kanjiPointerFallbackCounts = { added: 0, removed: 0 };
    globalThis.document.addEventListener = (type, listener, options) => {
      if (type === "pointerup" || type === "pointercancel") globalThis.kanjiPointerFallbackCounts.added += 1;
      return add(type, listener, options);
    };
    globalThis.document.removeEventListener = (type, listener, options) => {
      if (type === "pointerup" || type === "pointercancel") globalThis.kanjiPointerFallbackCounts.removed += 1;
      return remove(type, listener, options);
    };
  });

  await canvas.dispatchEvent("pointerdown", { pointerId: 801, button: 0, clientX: box.x + box.width * 0.2, clientY: box.y + box.height * 0.2 });
  await canvas.dispatchEvent("pointermove", { pointerId: 801, button: 0, clientX: box.x + box.width * 0.8, clientY: box.y + box.height * 0.8 });
  await page.evaluate(({ x, y }) => globalThis.document.dispatchEvent(new globalThis.PointerEvent("pointerup", {
    pointerId: 801, button: 0, clientX: x, clientY: y,
  })), { x: box.x + box.width * 0.8, y: box.y + box.height * 0.8 });

  await canvas.dispatchEvent("pointerdown", { pointerId: 802, button: 0, clientX: box.x + box.width * 0.2, clientY: box.y + box.height * 0.8 });
  await canvas.dispatchEvent("pointermove", { pointerId: 802, button: 0, clientX: box.x + box.width * 0.8, clientY: box.y + box.height * 0.2 });
  await canvas.dispatchEvent("pointerup", { pointerId: 802, button: 0, clientX: box.x + box.width * 0.8, clientY: box.y + box.height * 0.2 });
  await expect(page.locator("#kanjiInkStatus")).toHaveText("2 strokes");
  await page.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  if (await page.locator("#noteInspector").isHidden()) await page.locator("#detailsButton").click();

  for (const pointerId of [803, 804]) {
    await page.getByRole("button", { name: "Edit Kanji drawing" }).click();
    await canvas.dispatchEvent("pointerdown", { pointerId, button: 0, clientX: box.x + box.width * 0.5, clientY: box.y + box.height * 0.5 });
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.locator("#kanjiInkDialog")).not.toBeVisible();
  }

  expect(await page.evaluate(() => globalThis.kanjiPointerFallbackCounts)).toEqual({ added: 8, removed: 8 });
});

test("preview layout observer ownership stays bounded across hidden synchronization and teardown", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeResizeObserver = globalThis.ResizeObserver;
    const counts = {
      created: 0, observed: 0, unobserved: 0, disconnected: 0,
      activeObservers: 0, activeTargets: 0,
    };
    globalThis.kanjiPreviewObserverCounts = counts;
    globalThis.ResizeObserver = class InstrumentedResizeObserver {
      constructor(callback) {
        this.targets = new Set();
        this.active = true;
        this.native = new NativeResizeObserver((entries) => callback(entries, this));
        counts.created += 1;
        counts.activeObservers += 1;
      }

      observe(target) {
        if (!this.targets.has(target)) {
          this.targets.add(target);
          counts.observed += 1;
          counts.activeTargets += 1;
        }
        this.native.observe(target);
      }

      unobserve(target) {
        if (this.targets.delete(target)) {
          counts.unobserved += 1;
          counts.activeTargets -= 1;
        }
        this.native.unobserve(target);
      }

      disconnect() {
        counts.disconnected += 1;
        counts.activeTargets -= this.targets.size;
        this.targets.clear();
        if (this.active) {
          this.active = false;
          counts.activeObservers -= 1;
        }
        this.native.disconnect();
      }
    };
  });

  await page.goto("/");
  await page.locator("#titleInput").fill("Observer lifecycle");
  await page.locator("#contentInput").fill("Hidden inspector observer regression.");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await page.evaluate(async ({ noteId: id }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    for (let index = 0; index < 4; index += 1) {
      transaction.objectStore("kanjiInkEntries").put({
        id: `observer-entry-${index}`,
        noteId: id,
        strokes: [{ tool: "pen", width: 0.008, points: [{ x: 0.2, y: 0.2, t: 0 }, { x: 0.8, y: 0.8, t: 1 }] }],
        paperStyle: "grid",
        createdAt: `2026-08-10T00:00:0${index}.000Z`,
        updatedAt: `2026-08-10T00:00:0${index}.000Z`,
        schemaVersion: 2,
      });
    }
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, { noteId });

  await page.reload();
  await expect(page.locator("#noteInspector")).toBeHidden();
  await expect(page.locator("#kanjiInkCount")).toHaveText("4 entries");
  const hiddenSnapshots = await page.evaluate(async () => {
    const { kanjiInkApp } = await import("/ui/kanjiInkView.js");
    const snapshots = [];
    for (let iteration = 0; iteration < 6; iteration += 1) {
      await kanjiInkApp.synchronize();
      snapshots.push({ ...globalThis.kanjiPreviewObserverCounts });
    }
    return snapshots;
  });
  expect(Math.max(...hiddenSnapshots.map((snapshot) => snapshot.activeObservers))).toBeLessThanOrEqual(1);
  expect(Math.max(...hiddenSnapshots.map((snapshot) => snapshot.activeTargets))).toBeLessThanOrEqual(4);

  await page.locator("#detailsButton").click();
  await expect(page.locator(".kanji-entry-preview[data-paper-rendered='true']")).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => globalThis.kanjiPreviewObserverCounts.activeTargets)).toBe(0);
  await page.locator("#detailsButton").click();
  await page.evaluate(async () => (await import("/ui/kanjiInkView.js")).kanjiInkApp.synchronize());
  expect(await page.evaluate(() => globalThis.kanjiPreviewObserverCounts.activeTargets)).toBeLessThanOrEqual(4);

  await page.evaluate(async () => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").clear();
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    await (await import("/ui/kanjiInkView.js")).kanjiInkApp.synchronize();
  });
  expect(await page.evaluate(() => globalThis.kanjiPreviewObserverCounts.activeTargets)).toBe(0);

  await page.evaluate(async () => (await import("/ui/kanjiInkView.js")).kanjiInkApp.destroy());
  expect(await page.evaluate(() => ({
    observers: globalThis.kanjiPreviewObserverCounts.activeObservers,
    targets: globalThis.kanjiPreviewObserverCounts.activeTargets,
  }))).toEqual({ observers: 0, targets: 0 });
});
