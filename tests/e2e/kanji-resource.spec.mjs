import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth === globalThis.document.documentElement.clientWidth)).toBe(true);
}

async function openAndClose(page) {
  await page.locator("#noteActionsButton").click();
  await page.getByRole("menuitem", { name: /Add Kanji handwriting/ }).click();
  await expect(page.locator("#kanjiInkDialog")).toBeVisible();
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
  await openAndClose(page);
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
