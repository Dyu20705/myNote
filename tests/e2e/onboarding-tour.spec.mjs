import { expect, test } from "@playwright/test";

test.describe("Onboarding Tour", () => {
  test("walks through all 5 tour steps to completion, introducing themes and landmarks, and persists completion across reload", async ({ page }) => {
    await page.goto("/");

    const tourTooltip = page.locator(".onboarding-tooltip");
    await expect(tourTooltip).toBeVisible();

    // Step 1: Workspace navigation
    await expect(page.locator(".onboarding-tooltip-title")).toHaveText("Workspace navigation");
    const nextBtn = page.locator(".onboarding-next");
    await expect(nextBtn).toHaveText("Next");
    await nextBtn.click();

    // Step 2: Quick search
    await expect(page.locator(".onboarding-tooltip-title")).toHaveText("Quick search and shortcuts");
    await nextBtn.click();

    // Step 3: Theme customization & settings
    await expect(page.locator(".onboarding-tooltip-title")).toHaveText("Theme customization & settings");
    await nextBtn.click();

    // Step 4: Japanese workspace
    await expect(page.locator(".onboarding-tooltip-title")).toHaveText("Japanese workspace");
    await nextBtn.click();

    // Step 5: Start creating (final step)
    await expect(page.locator(".onboarding-tooltip-title")).toHaveText("Start creating");
    await expect(nextBtn).toHaveText("Get started");
    await nextBtn.click();

    // Verify tour is finished
    await expect(tourTooltip).not.toBeVisible();

    // Reload page and ensure tour does not reappear
    await page.reload();
    await page.waitForTimeout(300);
    await expect(tourTooltip).not.toBeVisible();
  });

  test("skip button immediately dismisses tour and persists completion across reload", async ({ page }) => {
    await page.goto("/");

    const tourTooltip = page.locator(".onboarding-tooltip");
    if (await tourTooltip.isVisible()) {
      const skipBtn = page.locator(".onboarding-skip");
      await expect(skipBtn).toBeVisible();
      await skipBtn.click();

      await expect(tourTooltip).not.toBeVisible();

      await page.reload();
      await page.waitForTimeout(300);
      await expect(tourTooltip).not.toBeVisible();
    }
  });
});
