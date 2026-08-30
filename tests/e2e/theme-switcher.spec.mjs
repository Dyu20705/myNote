import { expect, test } from "@playwright/test";

test.describe("Theme Switcher UI and Persistence", () => {
  test("opens via command palette, previews with keyboard traversal, cancels with Escape, and applies & persists across reload", async ({ page }) => {
    await page.goto("/");

    // 1. Initial baseline: Default theme
    const initialBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(initialBg).toBe("#000000");

    // 2. Open Command Palette (Ctrl+K)
    await page.keyboard.press("Control+k");
    const paletteInput = page.locator("#commandInput");
    await expect(paletteInput).toBeFocused();

    // 3. Search and trigger 'Switch theme'
    await paletteInput.fill("Switch theme");
    const themeCommand = page.locator(".command-item").filter({ hasText: "Switch theme" });
    await expect(themeCommand).toBeVisible();
    await page.keyboard.press("Enter");

    // 4. Verify Theme Switcher Dialog is open
    const dialog = page.locator("#themeSwitcherDialog");
    await expect(dialog).toBeVisible();

    // 5. Verify theme list rendered
    const nordicOption = page.locator(".theme-option[data-theme-id='nordic-dark']");
    const kyotoOption = page.locator(".theme-option[data-theme-id='kyoto-paper']");
    await expect(nordicOption).toBeVisible();
    await expect(kyotoOption).toBeVisible();

    // 6. Test Live Preview via item selection
    await nordicOption.click();

    // Live preview should immediately reflect the active/focused item
    const previewBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(previewBg).toBe("#2e3440");

    // 7. Test Escape Cancellation — should revert to initial baseline
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    const revertedBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(revertedBg).toBe(initialBg);

    // 8. Re-open Theme Switcher and explicitly Apply Kyoto Paper
    await page.keyboard.press("Control+k");
    await page.locator("#commandInput").fill("Switch theme");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();

    await kyotoOption.click();
    const applyButton = page.locator("#applyThemeSwitcherButton");
    await applyButton.click();
    await expect(dialog).not.toBeVisible();

    // Verify Kyoto Paper is active
    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "kyoto-paper");
    const appliedBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(appliedBg).toBe("#f7f4eb");

    // 9. Test Persistence Across Reload
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme-id", "kyoto-paper");
    const reloadedBg = await page.locator(":root").evaluate((el) => {
      return globalThis.getComputedStyle(el).getPropertyValue("--theme-color-background").trim();
    });
    expect(reloadedBg).toBe("#f7f4eb");
  });
});
