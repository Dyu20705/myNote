import { expect, test } from "@playwright/test";
import { BUILTIN_THEMES } from "../../core/theme/themeSchema.js";

test("Theme tokens — applies and switches theme CSS custom properties dynamically on root", async ({ page }) => {
  await page.goto("/");

  // 1. Verify default values on root
  const initialCanvas = await page.locator(":root").evaluate((element) => {
    return globalThis.getComputedStyle(element).getPropertyValue("--theme-color-background").trim();
  });
  expect(initialCanvas).toBe("#000000");

  // 2. Apply Nordic Dark dynamically
  await page.evaluate((theme) => {
    // Dynamic import to test engine in browser context
    import("./core/theme/themeEngine.js").then((engine) => {
      engine.applyThemeTokens(theme);
    });
  }, BUILTIN_THEMES["nordic-dark"]);

  // Wait for attribute update
  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "nordic-dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-dark", "true");

  const nordicStyles = await page.locator(":root").evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      bg: style.getPropertyValue("--theme-color-background").trim(),
      surface: style.getPropertyValue("--theme-color-surface").trim(),
      text: style.getPropertyValue("--theme-color-text-primary").trim(),
      primary: style.getPropertyValue("--theme-color-primary").trim(),
      border: style.getPropertyValue("--theme-color-border").trim(),
      borderRadius: style.getPropertyValue("--theme-metric-border-radius").trim(),
    };
  });

  expect(nordicStyles).toEqual({
    bg: "#2e3440",
    surface: "#3b4252",
    text: "#eceff4",
    primary: "#88c0d0",
    border: "#4c566a",
    borderRadius: "8px",
  });

  // 3. Switch to Kyoto Paper
  await page.evaluate((theme) => {
    import("./core/theme/themeEngine.js").then((engine) => {
      engine.applyThemeTokens(theme);
    });
  }, BUILTIN_THEMES["kyoto-paper"]);

  await expect(page.locator("html")).toHaveAttribute("data-theme-id", "kyoto-paper");
  await expect(page.locator("html")).toHaveAttribute("data-theme-dark", "false");

  const kyotoStyles = await page.locator(":root").evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      bg: style.getPropertyValue("--theme-color-background").trim(),
      primary: style.getPropertyValue("--theme-color-primary").trim(),
      fontSize: style.getPropertyValue("--theme-font-size-base").trim(),
    };
  });

  expect(kyotoStyles).toEqual({
    bg: "#f7f4eb",
    primary: "#b24c3d",
    fontSize: "16px",
  });

  // 4. Reset theme
  await page.evaluate(() => {
    import("./core/theme/themeEngine.js").then((engine) => {
      engine.resetThemeTokens();
    });
  });

  await expect(page.locator("html")).not.toHaveAttribute("data-theme-id");
});
