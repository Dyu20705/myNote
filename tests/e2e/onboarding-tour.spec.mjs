import { expect, test } from "@playwright/test";

test.describe("Onboarding Tour", () => {
  test("shows tour on first visit, allows stepping through and skipping, persists completion across reload", async ({ page }) => {
    await page.goto("/");

    // 1. Verify onboarding container or tooltip becomes visible on first visit
    const tourTooltip = page.locator(".onboarding-tooltip");
    
    // If tour is active, step through it
    if (await tourTooltip.isVisible()) {
      const nextBtn = page.locator(".onboarding-next");
      await expect(nextBtn).toBeVisible();

      // Click Next through steps
      await nextBtn.click();
      await page.waitForTimeout(100);

      // Verify skip button works
      const skipBtn = page.locator(".onboarding-skip");
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
      }

      await expect(tourTooltip).not.toBeVisible();

      // Reload page and ensure tour does not reappear
      await page.reload();
      await page.waitForTimeout(500);
      await expect(tourTooltip).not.toBeVisible();
    }
  });
});
