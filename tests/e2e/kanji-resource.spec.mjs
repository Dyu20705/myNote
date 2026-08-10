import { expect, test } from "@playwright/test";

const KANJI_RESOURCE_BUDGET = Object.freeze({
  codecSamples: 5,
  maxCodecSampleMs: 1_000,
  maxCanonicalEntryBytes: 262_144,
  maxCodecEnvelopeBytes: 8 * 1024 * 1024,
  maxNoteContextLoadMs: 2_000,
  maxPreviewWindowRenderMs: 5_000,
  previewWindowEntries: 64,
});

function recordResourceEvidence(testInfo, phase, measurement) {
  const rawEvidence = {
    phase,
    chromiumProject: testInfo.project.name,
    ...measurement,
  };
  const serialized = JSON.stringify(rawEvidence);
  testInfo.annotations.push({ type: "kanji-resource-evidence", description: serialized });
  console.info(`[kanji-resource-evidence] ${serialized}`);
}

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
  // Equivalent responsive-layout evidence only; Playwright viewport emulation
  // does not exercise native browser zoom, OS display scaling, or physical input.
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

test("bounded drawing evidence validates maximum V2 shape, reloads note context, and renders 64 previews", async ({ page }, testInfo) => {
  await page.goto("/");

  const codecEvidence = await page.evaluate(({ sampleCount }) => {
    return import("/core/kanjiInkEntry.js").then(({ serializeKanjiInkEntry, validateKanjiInkEntryV2 }) => {
      const strokeLengths = [256, ...Array(27).fill(124), ...Array(4).fill(123)];
      let pointOffset = 0;
      const strokes = strokeLengths.map((pointCount) => {
        const strokeOffset = pointOffset;
        pointOffset += pointCount;
        return {
          tool: "pen",
          width: 0.008,
          points: Array.from({ length: pointCount }, (_, pointIndex) => ({
            x: (strokeOffset + pointIndex) / 4096,
            y: 0.123456789012345,
            t: pointIndex,
          })),
        };
      });
      const entry = {
        id: "resource-max-shape",
        noteId: "resource-note",
        strokes,
        paperStyle: "grid",
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        schemaVersion: 2,
      };
      const validated = validateKanjiInkEntryV2(entry);
      let warmupOperations = 0;
      serializeKanjiInkEntry(validateKanjiInkEntryV2(entry));
      warmupOperations += 1;
      const durations = [];
      let serialized = "";
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const startedAt = globalThis.performance.now();
        serialized = serializeKanjiInkEntry(validateKanjiInkEntryV2(entry));
        durations.push(Number((globalThis.performance.now() - startedAt).toFixed(3)));
      }
      return {
        sampleCount: durations.length,
        warmupOperations,
        durationsMs: durations,
        maxDurationMs: Math.max(...durations),
        canonicalEntryBytes: new TextEncoder().encode(JSON.stringify(validated)).length,
        codecEnvelopeBytes: new TextEncoder().encode(serialized).length,
        maxPointsPerStroke: Math.max(...entry.strokes.map((stroke) => stroke.points.length)),
        strokes: entry.strokes.length,
        points: entry.strokes.reduce((total, stroke) => total + stroke.points.length, 0),
      };
    });
  }, { sampleCount: KANJI_RESOURCE_BUDGET.codecSamples });

  recordResourceEvidence(testInfo, "codec", { durationsMs: codecEvidence.durationsMs });
  expect(codecEvidence).toMatchObject({
    sampleCount: KANJI_RESOURCE_BUDGET.codecSamples,
    warmupOperations: 1,
    maxPointsPerStroke: 256,
    strokes: 32,
    points: 4_096,
  });
  expect(codecEvidence.canonicalEntryBytes).toBeLessThanOrEqual(KANJI_RESOURCE_BUDGET.maxCanonicalEntryBytes);
  expect(codecEvidence.codecEnvelopeBytes).toBeLessThanOrEqual(KANJI_RESOURCE_BUDGET.maxCodecEnvelopeBytes);
  expect(codecEvidence.maxDurationMs).toBeLessThan(KANJI_RESOURCE_BUDGET.maxCodecSampleMs);

  await page.locator("#titleInput").fill("Bounded drawing evidence");
  await page.locator("#contentInput").fill("64-preview resource fixture.");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved locally");
  const noteId = await page.locator(".note-item[aria-current='true']").getAttribute("data-id");
  await page.evaluate(async ({ noteId: id, entryCount }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    for (let index = 0; index < entryCount; index += 1) {
      const timestamp = new Date(Date.UTC(2026, 7, 10) + index * 1_000).toISOString();
      transaction.objectStore("kanjiInkEntries").put({
        id: `resource-entry-${String(index).padStart(3, "0")}`,
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
  }, { noteId, entryCount: KANJI_RESOURCE_BUDGET.previewWindowEntries + 1 });

  const contextEvidence = await page.evaluate(async () => {
    const { kanjiInkApp } = await import("/ui/kanjiInkView.js");
    const durations = [];
    for (let load = 0; load < 2; load += 1) {
      const startedAt = globalThis.performance.now();
      await kanjiInkApp.synchronize();
      durations.push(Number((globalThis.performance.now() - startedAt).toFixed(3)));
    }
    return { durationsMs: durations, loadCount: durations.length, maxDurationMs: Math.max(...durations) };
  });
  recordResourceEvidence(testInfo, "context", { durationsMs: contextEvidence.durationsMs });
  expect(contextEvidence.loadCount).toBe(2);
  expect(contextEvidence.maxDurationMs).toBeLessThan(KANJI_RESOURCE_BUDGET.maxNoteContextLoadMs);
  await expect(page.locator("#kanjiInkCount")).toHaveText("65 entries");
  await expect(page.locator(".kanji-entry")).toHaveCount(KANJI_RESOURCE_BUDGET.previewWindowEntries);

  const previewStartedAt = Date.now();
  await page.locator("#detailsButton").click();
  await expect(page.locator(".kanji-entry-preview[data-paper-rendered='true']")).toHaveCount(
    KANJI_RESOURCE_BUDGET.previewWindowEntries,
  );
  const previewDurationMs = Date.now() - previewStartedAt;
  recordResourceEvidence(testInfo, "preview", { durationMs: previewDurationMs });
  expect(previewDurationMs).toBeLessThan(KANJI_RESOURCE_BUDGET.maxPreviewWindowRenderMs);
  await expect(page.getByRole("button", { name: "Show older drawings" })).toBeVisible();
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
    const nativeRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
    const nativeCancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);
    const pendingAnimationFrames = new Set();
    const counts = {
      created: 0, observed: 0, unobserved: 0, disconnected: 0,
      activeObservers: 0, activeTargets: 0,
      scheduledFrames: 0, cancelledFrames: 0, executedFrames: 0, pendingFrames: 0,
    };
    globalThis.kanjiPreviewObserverCounts = counts;
    globalThis.requestAnimationFrame = (callback) => {
      const frameId = nativeRequestAnimationFrame((timestamp) => {
        if (pendingAnimationFrames.delete(frameId)) {
          counts.executedFrames += 1;
          counts.pendingFrames -= 1;
        }
        callback(timestamp);
      });
      pendingAnimationFrames.add(frameId);
      counts.scheduledFrames += 1;
      counts.pendingFrames += 1;
      return frameId;
    };
    globalThis.cancelAnimationFrame = (frameId) => {
      if (pendingAnimationFrames.delete(frameId)) {
        counts.cancelledFrames += 1;
        counts.pendingFrames -= 1;
      }
      nativeCancelAnimationFrame(frameId);
    };
    globalThis.kanjiAwaitTwoNativeFrames = () => new Promise((resolve) => {
      nativeRequestAnimationFrame(() => nativeRequestAnimationFrame(resolve));
    });
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
  expect(Math.max(...hiddenSnapshots.map((snapshot) => snapshot.pendingFrames))).toBeLessThanOrEqual(4);
  await page.evaluate(() => globalThis.kanjiAwaitTwoNativeFrames());
  expect(await page.evaluate(() => globalThis.kanjiPreviewObserverCounts.pendingFrames)).toBe(0);

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

  const destroyedSnapshot = await page.evaluate(async ({ noteId: id }) => {
    const request = globalThis.indexedDB.open("myNoteDB", 3);
    const database = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("kanjiInkEntries", "readwrite");
    transaction.objectStore("kanjiInkEntries").put({
      id: "observer-destroy-race",
      noteId: id,
      strokes: [{ tool: "pen", width: 0.008, points: [{ x: 0.2, y: 0.2, t: 0 }, { x: 0.8, y: 0.8, t: 1 }] }],
      paperStyle: "grid",
      createdAt: "2026-08-10T00:01:00.000Z",
      updatedAt: "2026-08-10T00:01:00.000Z",
      schemaVersion: 2,
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    const { kanjiInkApp } = await import("/ui/kanjiInkView.js");
    await kanjiInkApp.synchronize();
    kanjiInkApp.destroy();
    return { ...globalThis.kanjiPreviewObserverCounts };
  }, { noteId });
  expect(destroyedSnapshot.pendingFrames).toBe(0);
  await page.evaluate(() => globalThis.kanjiAwaitTwoNativeFrames());
  expect(await page.evaluate(() => ({
    observers: globalThis.kanjiPreviewObserverCounts.activeObservers,
    targets: globalThis.kanjiPreviewObserverCounts.activeTargets,
    pendingFrames: globalThis.kanjiPreviewObserverCounts.pendingFrames,
  }))).toEqual({ observers: 0, targets: 0, pendingFrames: 0 });
});
