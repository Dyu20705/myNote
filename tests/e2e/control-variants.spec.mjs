import { expect, test } from "@playwright/test";

async function appendVariantButton(page, className, label) {
  return page.evaluate(({ className: targetClass, label: targetLabel }) => {
    const button = globalThis.document.createElement("button");
    button.type = "button";
    button.className = targetClass;
    button.textContent = targetLabel;
    button.dataset.testVariant = targetClass;
    globalThis.document.body.append(button);
  }, { className, label });
}

async function styleFor(page, className) {
  return page.locator(`[data-test-variant="${className}"]`).evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderTopColor,
      borderStyle: style.borderTopStyle,
      color: style.color,
      fontWeight: Number.parseInt(style.fontWeight, 10),
      minHeight: style.minHeight,
    };
  });
}

test("primary, secondary, quiet, and destructive controls expose distinct bounded variants", async ({ page }) => {
  await page.goto("/");

  await appendVariantButton(page, "primary-button", "Primary");
  await appendVariantButton(page, "secondary-button", "Secondary");
  await appendVariantButton(page, "quiet-button", "Quiet");
  await appendVariantButton(page, "destructive-button", "Delete permanently");

  expect(await styleFor(page, "primary-button")).toMatchObject({
    background: "rgb(14, 165, 233)",
    border: "rgb(14, 165, 233)",
    color: "rgb(0, 0, 0)",
    fontWeight: 600,
    minHeight: "40px",
  });

  expect(await styleFor(page, "secondary-button")).toMatchObject({
    background: "rgb(17, 19, 24)",
    border: "rgb(49, 55, 67)",
    color: "rgb(184, 192, 204)",
    minHeight: "40px",
  });

  expect(await styleFor(page, "quiet-button")).toMatchObject({
    background: "rgba(0, 0, 0, 0)",
    border: "rgba(0, 0, 0, 0)",
    borderStyle: "solid",
    color: "rgb(184, 192, 204)",
    minHeight: "40px",
  });

  expect(await styleFor(page, "destructive-button")).toMatchObject({
    background: "rgba(0, 0, 0, 0)",
    border: "rgb(244, 63, 94)",
    color: "rgb(251, 113, 133)",
    fontWeight: 600,
    minHeight: "40px",
  });
});
