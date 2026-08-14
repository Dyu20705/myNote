async function waitForWorkspace(page, workspace) {
  const id = workspace === "japanese" ? "japaneseWorkspaceButton" : "notesWorkspaceButton";
  await page.waitForFunction((buttonId) => (
    globalThis.document.querySelector(`#${buttonId}`)?.getAttribute("aria-pressed") === "true"
  ), id);
}

async function ensureLegacyOrdinaryBaseline(page) {
  const count = (await page.locator("#noteCount").textContent())?.trim();
  if (count !== "0 notes") return;

  const japanese = page.locator("#japaneseWorkspaceButton");
  const wasJapanese = await japanese.getAttribute("aria-pressed") === "true";
  if (wasJapanese) {
    await page.locator("#notesWorkspaceButton").click();
    await waitForWorkspace(page, "notes");
  }

  await page.getByRole("button", { name: "New note", exact: true }).first().click();
  await closeNoteEditor(page);

  if (wasJapanese) {
    await japanese.click();
    await waitForWorkspace(page, "japanese");
  }
}

export async function openJapaneseCreateMenu(page) {
  const group = page.getByRole("group", { name: "New Japanese note" });
  if (await group.isHidden()) {
    await page.getByRole("button", { name: "New Japanese note" }).click();
  }
  return group;
}

export async function createJapaneseNoteFromMenu(page, action) {
  await ensureLegacyOrdinaryBaseline(page);
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