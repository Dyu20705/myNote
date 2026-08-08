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

export async function openJapaneseReviewSubview(page) {
  const button = page
    .getByRole("navigation", { name: "Japanese workspace views" })
    .getByRole("button", { name: /^Review/ });
  if (await button.getAttribute("aria-pressed") !== "true") {
    await button.click();
  }
  return button;
}
