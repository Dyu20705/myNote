export async function openJapaneseCreateMenu(page) {
  const group = page.getByRole("group", { name: "New Japanese note" });
  if (await group.isHidden()) {
    await page.getByRole("button", { name: "New Japanese note" }).click();
  }
  return group;
}

export async function createJapaneseNoteFromMenu(page, action) {
  const group = await openJapaneseCreateMenu(page);
  await group.getByRole("button", { name: action }).click();
  await group.waitFor({ state: "hidden" });
  await page.waitForFunction(() => !globalThis.document
    .querySelector("#japaneseCreate")
    ?.hasAttribute("aria-busy"));
}

export async function closeNoteEditor(page) {
  const overlay = page.locator("#noteEditorOverlay");
  if (await overlay.isVisible()) {
    await page.getByRole("button", { name: "Close note editor" }).click();
  }
  await overlay.waitFor({ state: "hidden" });
}

export async function openJapaneseReview(page) {
  const button = page.locator("#japaneseReviewEntryButton");
  await button.waitFor({ state: "visible" });
  await button.click();
  await page.getByRole("dialog", { name: "Japanese review session" }).waitFor({ state: "visible" });
  return button;
}

export async function openJapaneseStudyDetails(page) {
  const button = page.locator("#japaneseStudyDetailsToggle");
  if (await button.getAttribute("aria-expanded") !== "true") {
    await button.click();
  }
  await page.locator("#japaneseDashboard").waitFor({ state: "visible" });
  return button;
}
