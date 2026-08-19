import { expect, test } from "@playwright/test";
import {
  closeNoteEditor,
  createJapaneseNoteFromMenu,
  openJapaneseCreateMenu,
  openJapaneseReview,
} from "./japanese-helpers.mjs";

const APP_ORIGIN = "http://127.0.0.1:4173";
const DEFERRED_DESTINATIONS = ["Reminders", "Labels", "Trash"];
const FORBIDDEN_COMMAND_IDS = /^(?:reminders?|labels?|trash|analytics|attachments?|formatting|recognition|candidates?|(?:remote[.-]?)?models?|rich[.-]?format(?:ting)?|handwriting[.-]?recognition)(?:[.-]|$)/i;
const FORBIDDEN_HEALTHY_CONTROL_FAMILY = /\b(?:recognition|recognize|candidates?|remote[-\s]?model|analytics?|reminders?|labels?(?:[-\s]?(?:management|manager))?|trash|attachments?|rich[-\s]?(?:format|formatting)|handwriting[-\s]?recognition)\b/i;
const NATIVE_CONTROL_SELECTOR = [
  "button",
  "a[href]",
  "area[href]",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "summary",
  "details",
].join(", ");
const CONTROL_SELECTOR = [
  NATIVE_CONTROL_SELECTOR,
  "[role]",
  "[tabindex]",
  "[contenteditable]",
  "[onclick]",
  "audio[controls]",
  "video[controls]",
  "iframe",
  "embed",
  "object",
].join(", ");

async function installOneShotBootstrapOpenFailure(page) {
  await page.addInitScript(() => {
    const originalOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    let failOnce = true;
    globalThis.indexedDB.open = function open(...args) {
      if (failOnce) {
        failOnce = false;
        throw new globalThis.DOMException("Injected bootstrap failure", "InvalidStateError");
      }
      return originalOpen(...args);
    };
  });
}

async function countForbiddenHealthyControls(page) {
  return page.evaluate(({ selector, nativeControlSelector, patternSource }) => {
    const forbidden = new RegExp(patternSource, "i");
    return [...globalThis.document.querySelectorAll(selector)].reduce((count, control) => {
      if (!(control instanceof globalThis.HTMLElement) || control.hidden || control.getAttribute("aria-hidden") === "true") {
        return count;
      }
      const style = globalThis.getComputedStyle(control);
      if (control.getClientRects().length === 0 || style.visibility === "hidden") return count;
      const tabIndex = control.getAttribute("tabindex");
      const isNonnegativeTabIndex = tabIndex !== null && Number(tabIndex) >= 0;
      const contentEditable = control.getAttribute("contenteditable");
      const isEditable = contentEditable === "" || ["true", "plaintext-only"].includes(contentEditable?.toLowerCase());
      const isNativeOrRoleControl = control.matches(nativeControlSelector)
        || control.matches("[role], [onclick], audio[controls], video[controls], iframe, embed, object");
      if (!isNativeOrRoleControl && !isNonnegativeTabIndex && !isEditable) return count;
      const accessibleReferenceText = (attribute) => (control.getAttribute(attribute) || "")
        .split(/\s+/)
        .map((reference) => globalThis.document.getElementById(reference)?.innerText || "")
        .filter(Boolean)
        .join(" ");
      const associatedLabelText = [...globalThis.document.querySelectorAll("label")]
        .filter((label) => label.control === control)
        .map((label) => label.innerText)
        .filter(Boolean)
        .join(" ");
      const relevantText = control.matches("input, textarea, select, [contenteditable]") ? "" : control.innerText;
      const metadata = [
        relevantText,
        control.getAttribute("aria-label"),
        control.getAttribute("aria-labelledby"),
        accessibleReferenceText("aria-labelledby"),
        control.getAttribute("aria-describedby"),
        accessibleReferenceText("aria-describedby"),
        associatedLabelText,
        control.getAttribute("title"),
        control.id,
        control.getAttribute("name"),
        control.getAttribute("placeholder"),
        control.getAttribute("type"),
        control.getAttribute("value"),
      ].filter(Boolean).join(" ");
      return count + Number(forbidden.test(metadata));
    }, 0);
  }, {
    selector: CONTROL_SELECTOR,
    nativeControlSelector: NATIVE_CONTROL_SELECTOR,
    patternSource: FORBIDDEN_HEALTHY_CONTROL_FAMILY.source,
  });
}

async function expectVisibleWithinViewport(page, locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function commandSnapshot(page) {
  return page.evaluate(async () => {
    const { commandRuntime } = await import("/app.js");
    return commandRuntime.snapshot();
  });
}

async function activeCanonicalNoteShape(page) {
  return page.evaluate(async () => {
    const { getActiveStore } = await import("/core/state.js");
    const state = getActiveStore().getState();
    const note = state.notes.find((candidate) => candidate.id === state.activeId);
    return note ? Object.keys(note).sort() : [];
  });
}

test("release shell exposes only owner-backed navigation and bounded commands", async ({ page }) => {
  await page.goto("/");

  const workspace = page.getByRole("navigation", { name: "Workspace" });
  await expect(workspace).toBeVisible();
  await expect(workspace.getByRole("button")).toHaveCount(3);
  await expect(workspace.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(workspace.getByRole("button", { name: "日本語", exact: true })).toHaveAttribute("aria-pressed", "false");

  for (const label of DEFERRED_DESTINATIONS) {
    await expect(workspace.getByRole("button", { name: label, exact: true })).toHaveCount(0);
    await expect(workspace.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }

  const refresh = page.getByRole("button", { name: "Refresh" });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect(workspace.getByRole("button", { name: "Notes", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await countForbiddenHealthyControls(page)).toBe(0);

  const commands = await commandSnapshot(page);
  expect(commands.length).toBeGreaterThan(0);
  expect(commands.length).toBeLessThanOrEqual(128);
  expect(commands.some(({ id }) => id === "notes.archive")).toBe(true);
  expect(commands.map(({ id }) => id).filter((id) => FORBIDDEN_COMMAND_IDS.test(id))).toEqual([]);
  expect(commands.filter(({ available }) => !available).every(({ unavailableReason }) => (
    typeof unavailableReason === "string" && unavailableReason.trim().length > 0
  ))).toBe(true);
});

test("healthy release surfaces expose no forbidden controls", async ({ page }) => {
  await page.goto("/");
  expect(await countForbiddenHealthyControls(page)).toBe(0);

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  expect(await countForbiddenHealthyControls(page)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();

  await page.locator("#japaneseWorkspaceButton").click();
  await expect(page.locator("#japaneseWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
  expect(await countForbiddenHealthyControls(page)).toBe(0);

  const createMenu = await openJapaneseCreateMenu(page);
  await expect(createMenu).toBeVisible();
  expect(await countForbiddenHealthyControls(page)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(createMenu).toBeHidden();

  await createJapaneseNoteFromMenu(page, "Create vocabulary note");
  await closeNoteEditor(page);
  const reviewEntry = await openJapaneseReview(page);
  const reviewDialog = page.getByRole("dialog", { name: "Japanese review session" });
  await expect(reviewDialog).toBeVisible();
  expect(await countForbiddenHealthyControls(page)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(reviewDialog).toBeHidden();
  await expect(reviewEntry).toBeFocused();

  await page.locator("#notesWorkspaceButton").click();
  await expect(page.locator("#notesWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#noteList .note-item").first().click();
  const actions = page.getByRole("menu", { name: "Note actions" });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await expect(actions).toBeVisible();
  expect(await countForbiddenHealthyControls(page)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(actions).toBeHidden();

  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: /Add drawing/ }).click();
  const drawingDialog = page.getByRole("dialog", { name: "Draw Kanji" });
  await expect(drawingDialog).toBeVisible();
  expect(await countForbiddenHealthyControls(page)).toBe(0);
  await drawingDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(drawingDialog).toBeHidden();
});

test("workspace transitions preserve ordinary context and keyboard return", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await closeNoteEditor(page);

  const search = page.locator("#searchInput");
  await search.fill("synthetic-release-query");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");

  const notes = page.locator("#notesWorkspaceButton");
  const japanese = page.locator("#japaneseWorkspaceButton");
  await notes.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#archiveWorkspaceButton")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(japanese).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(japanese).toHaveAttribute("aria-pressed", "true");

  await japanese.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#archiveWorkspaceButton")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(notes).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(notes).toHaveAttribute("aria-pressed", "true");
  await expect(search).toHaveValue("synthetic-release-query");
  await expect(page.locator("#noteList .empty-state")).toContainText("No notes match this search");
});

for (const viewport of [
  { width: 1024, height: 768, label: "minimum desktop" },
  { width: 1280, height: 720, label: "wide desktop" },
  { width: 1440, height: 900, label: "reference desktop" },
  { width: 720, height: 450, label: "200 percent layout proxy" },
]) {
  test(`${viewport.label} keeps the document and primary actions contained`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const overflow = await page.evaluate(() => (
      globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth
    ));
    expect(overflow).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "New note", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();

    await installOneShotBootstrapOpenFailure(page);
    await page.reload();
    const recovery = page.locator("#applicationRecovery");
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    const reset = page.getByRole("button", { name: "Reset local data…", exact: true });
    await expectVisibleWithinViewport(page, recovery);
    await expectVisibleWithinViewport(page, retry);
    await expectVisibleWithinViewport(page, reset);
    const recoveryOverflow = await page.evaluate(() => (
      globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth
    ));
    expect(recoveryOverflow).toBeLessThanOrEqual(1);
    await retry.click();
    await expect(recovery).toBeHidden();
  });
}

test("saved-grid drawing stays local and outside canonical note content", async ({ page }) => {
  let externalRequestCount = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== APP_ORIGIN) externalRequestCount += 1;
  });

  await page.goto("/");
  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await expect(page.locator("#noteEditorOverlay")).toBeVisible();
  await page.locator("#titleInput").fill("Synthetic release note");
  await page.locator("#contentInput").fill("Synthetic content only");
  await page.locator("#contentInput").press("Control+Enter");
  await expect(page.locator("#saveState")).toHaveText("Saved");

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: /Add drawing/ }).click();
  const dialog = page.getByRole("dialog", { name: "Draw Kanji" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Pen", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "Marker", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Eraser", exact: true })).toBeVisible();
  await expect(page.locator("#recognizeKanjiButton, #kanjiCandidateList, #kanjiSelectedCharacter")).toHaveCount(0);
  expect(await countForbiddenHealthyControls(page)).toBe(0);

  const canvas = page.locator("#kanjiInkCanvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 6 });
  await page.mouse.up();
  await dialog.getByRole("button", { name: "Save drawing", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#noteDrawingRegion .kanji-entry")).toHaveCount(1);

  const noteKeys = await activeCanonicalNoteShape(page);
  expect(noteKeys).not.toContain("strokes");
  expect(noteKeys).not.toContain("paperStyle");
  expect(externalRequestCount).toBe(0);
});
