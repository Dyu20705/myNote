import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
];

const LONG_ENGLISH = "A deliberately long editor line verifies readable measure and wrapping without turning the application shell into a horizontally scrolling document. ".repeat(8);
const LONG_JAPANESE = "日本語の長い文章でも、読みやすい行間と折り返しを保ち、編集内容や操作領域を失わないことを確認します。".repeat(12);
const LONG_MARKDOWN_TOKEN = `\n\n${"unbroken-markdown-token-".repeat(80)}`;

function numericPixels(value) {
  return Number.parseFloat(value.replace("px", ""));
}

test("accepted Figma aliases and intentional font stacks are exposed by CSS", async ({ page }) => {
  await page.goto("/");

  const tokens = await page.locator(":root").evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      canvas: style.getPropertyValue("--mn-bg-canvas").trim(),
      surfaceBase: style.getPropertyValue("--mn-surface-base").trim(),
      surfaceRaised: style.getPropertyValue("--mn-surface-raised").trim(),
      surfaceSelected: style.getPropertyValue("--mn-surface-selected").trim(),
      textPrimary: style.getPropertyValue("--mn-text-primary").trim(),
      textSecondary: style.getPropertyValue("--mn-text-secondary").trim(),
      borderDefault: style.getPropertyValue("--mn-border-default").trim(),
      focus: style.getPropertyValue("--mn-focus-ring").trim(),
      primary: style.getPropertyValue("--mn-action-primary-bg").trim(),
      readable: style.getPropertyValue("--mn-content-readable").trim(),
      uiFont: style.getPropertyValue("--mn-font-ui").trim(),
      japaneseFont: style.getPropertyValue("--mn-font-japanese").trim(),
      monoFont: style.getPropertyValue("--mn-font-mono").trim(),
    };
  });

  expect(tokens).toEqual({
    canvas: "#000000",
    surfaceBase: "#0a0b0d",
    surfaceRaised: "#111318",
    surfaceSelected: "#20242c",
    textPrimary: "#f4f6f8",
    textSecondary: "#b8c0cc",
    borderDefault: "#313743",
    focus: "#38bdf8",
    primary: "#0ea5e9",
    readable: "760px",
    uiFont: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    japaneseFont: "\"Hiragino Kaku Gothic ProN\", \"Yu Gothic UI\", \"Yu Gothic\", Meiryo, \"Noto Sans JP\", sans-serif",
    monoFont: "ui-monospace, SFMono-Regular, Menlo, Consolas, \"Liberation Mono\", monospace",
  });

  const fonts = await page.evaluate(() => ({
    body: globalThis.getComputedStyle(globalThis.document.body).fontFamily,
    japanese: globalThis.getComputedStyle(globalThis.document.querySelector("#japaneseWorkspaceButton")).fontFamily,
    shortcut: globalThis.getComputedStyle(globalThis.document.querySelector(".search-box kbd")).fontFamily,
  }));

  expect(fonts.body.toLowerCase()).not.toContain("monospace");
  expect(fonts.japanese).toMatch(/Hiragino Kaku Gothic ProN|Yu Gothic UI|Yu Gothic|Meiryo|Noto Sans JP/);
  expect(fonts.shortcut.toLowerCase()).toContain("monospace");
});

test("core controls expose visible focus and composite search focus", async ({ page }) => {
  await page.goto("/");

  const focusTargets = [
    "#notesWorkspaceButton",
    "#searchInput",
    "#newNoteButton",
    "#refreshButton",
  ];
  for (const selector of focusTargets) {
    const target = page.locator(selector);
    await target.focus();
    const focusStyle = await target.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
      };
    });
    expect(focusStyle.outlineStyle, `${selector} focus outline style`).toBe("solid");
    expect(numericPixels(focusStyle.outlineWidth), `${selector} focus outline width`).toBeGreaterThanOrEqual(2);
    expect(focusStyle.outlineColor, `${selector} focus outline color`).toBe("rgb(56, 189, 248)");
    expect(numericPixels(focusStyle.outlineOffset), `${selector} focus outline offset`).toBeGreaterThanOrEqual(2);
  }

  await page.locator("#searchInput").focus();
  const searchFocus = await page.locator(".search-box").evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      borderColor: style.borderTopColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(searchFocus.borderColor).toBe("rgb(56, 189, 248)");
  expect(searchFocus.boxShadow).not.toBe("none");

  await page.locator("#noteList .note-item").first().click();
  const overlayFocusTargets = [
    "#titleInput",
    "#pinNoteButton",
    "#detailsButton",
    "#noteActionsButton",
    "#closeNoteEditorButton",
    "#contentInput",
  ];
  for (const [index, selector] of overlayFocusTargets.entries()) {
    const target = page.locator(selector);
    if (index === 0) {
      await target.focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
    const focusStyle = await target.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
      };
    });
    expect(focusStyle.outlineStyle, `${selector} focus outline style`).toBe("solid");
    expect(numericPixels(focusStyle.outlineWidth), `${selector} focus outline width`).toBeGreaterThanOrEqual(2);
    expect(focusStyle.outlineColor, `${selector} focus outline color`).toBe("rgb(56, 189, 248)");
    expect(numericPixels(focusStyle.outlineOffset), `${selector} focus outline offset`).toBeGreaterThanOrEqual(2);
  }
});

test("selected, disabled, busy, invalid, and destructive states are not color-only", async ({ page }) => {
  await page.goto("/");

  const selected = await page.locator("#notesWorkspaceButton").evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      boxShadow: style.boxShadow,
      fontWeight: Number.parseInt(style.fontWeight, 10),
      borderWidth: style.borderLeftWidth,
    };
  });
  expect(selected.boxShadow).toContain("inset");
  expect(selected.fontWeight).toBeGreaterThanOrEqual(600);
  expect(numericPixels(selected.borderWidth)).toBeGreaterThanOrEqual(1);

  await page.locator("#japaneseWorkspaceButton").click();
  await page.getByRole("navigation", { name: "Japanese workspace views" })
    .getByRole("button", { name: /^Review/ })
    .click();
  const disabled = page.locator("#startReviewButton");
  await expect(disabled).toBeDisabled();
  const disabledStyle = await disabled.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      cursor: style.cursor,
      opacity: Number.parseFloat(style.opacity),
      borderStyle: style.borderStyle,
    };
  });
  expect(disabledStyle.cursor).toBe("not-allowed");
  expect(disabledStyle.opacity).toBeLessThan(1);
  expect(disabledStyle.borderStyle).toBe("dashed");

  await page.getByRole("button", { name: "Japanese Notes", exact: true }).click();
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const invalidInput = page.locator("#japaneseDateFrom");
  await invalidInput.evaluate((element) => element.setAttribute("aria-invalid", "true"));
  const invalidStyle = await invalidInput.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return {
      borderColor: style.borderTopColor,
      borderStyle: style.borderStyle,
      boxShadow: style.boxShadow,
    };
  });
  expect(invalidStyle.borderColor).toBe("rgb(244, 63, 94)");
  expect(invalidStyle.borderStyle).toBe("double");
  expect(invalidStyle.boxShadow).not.toBe("none");

  await page.locator("#notesWorkspaceButton").click();
  const busy = page.locator("#refreshButton");
  await busy.evaluate((element) => {
    element.setAttribute("aria-busy", "true");
    element.disabled = true;
  });
  const busyStyle = await busy.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    const after = globalThis.getComputedStyle(element, "::after");
    return {
      cursor: style.cursor,
      afterContent: after.content,
      afterDisplay: after.display,
    };
  });
  expect(busyStyle.cursor).toBe("progress");
  expect(busyStyle.afterContent).not.toBe("none");
  expect(busyStyle.afterContent).not.toBe("normal");
  expect(busyStyle.afterDisplay).not.toBe("none");

  await page.locator("#noteList .note-item").first().click();
  await page.getByRole("button", { name: "More actions" }).click();
  const deleteButton = page.locator("#noteActionsList [data-command-id='notes.delete']");
  await expect(deleteButton).toHaveAccessibleName(/Delete active note/);
  const destructive = await deleteButton.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    const labelStyle = globalThis.getComputedStyle(element.querySelector("strong"));
    return {
      color: labelStyle.color,
      borderColor: style.borderTopColor,
      fontWeight: Number.parseInt(labelStyle.fontWeight, 10),
    };
  });
  expect(destructive.color).toBe("rgb(251, 113, 133)");
  expect(destructive.borderColor).toBe("rgba(244, 63, 94, 0.32)");
  expect(destructive.fontWeight).toBeGreaterThanOrEqual(600);
});

test("success, warning, and error status utilities include non-color indicators", async ({ page }) => {
  await page.goto("/");

  const states = [
    { name: "success", color: "rgb(74, 222, 128)" },
    { name: "warning", color: "rgb(251, 191, 36)" },
    { name: "error", color: "rgb(251, 113, 133)" },
  ];
  await page.evaluate((items) => {
    for (const item of items) {
      const status = globalThis.document.createElement("span");
      status.className = "status-message";
      status.dataset.state = item.name;
      status.dataset.testStatus = item.name;
      status.textContent = `${item.name} status`;
      globalThis.document.body.append(status);
    }
  }, states);

  for (const state of states) {
    const statusStyle = await page.locator(`[data-test-status="${state.name}"]`).evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        color: style.color,
        boxShadow: style.boxShadow,
        fontWeight: Number.parseInt(style.fontWeight, 10),
        paddingInlineStart: style.paddingInlineStart,
      };
    });
    expect(statusStyle.color).toBe(state.color);
    expect(statusStyle.boxShadow).toContain("inset");
    expect(statusStyle.fontWeight).toBeGreaterThanOrEqual(600);
    expect(numericPixels(statusStyle.paddingInlineStart)).toBeGreaterThanOrEqual(8);
  }
});

for (const viewport of VIEWPORTS) {
  test(`readable editor and long mixed content remain bounded at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const title = `${LONG_ENGLISH.slice(0, 220)} 日本語の長いタイトル`;
    const content = `${LONG_ENGLISH}\n\n${LONG_JAPANESE}${LONG_MARKDOWN_TOKEN}`;
    await page.locator("#noteList .note-item").first().click();
    await page.locator("#titleInput").fill(title);
    await page.locator("#contentInput").fill(content);

    const geometry = await page.evaluate(() => {
      const titleInput = globalThis.document.querySelector("#titleInput");
      const contentInput = globalThis.document.querySelector("#contentInput");
      const title = titleInput.getBoundingClientRect();
      const content = contentInput.getBoundingClientRect();
      return {
        titleWidth: title.width,
        contentWidth: content.width,
        contentVisibleHeight: Math.max(0, Math.min(content.bottom, globalThis.innerHeight) - Math.max(content.top, 0)),
        contentScrollWidth: contentInput.scrollWidth,
        contentClientWidth: contentInput.clientWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
        viewportWidth: globalThis.document.documentElement.clientWidth,
        contentOverflowWrap: globalThis.getComputedStyle(contentInput).overflowWrap,
      };
    });

    expect(geometry.titleWidth).toBeLessThanOrEqual(760);
    expect(geometry.contentWidth).toBeLessThanOrEqual(760);
    expect(geometry.contentVisibleHeight).toBeGreaterThanOrEqual(160);
    expect(geometry.contentScrollWidth).toBeLessThanOrEqual(geometry.contentClientWidth);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(["anywhere", "break-word"]).toContain(geometry.contentOverflowWrap);

    await page.getByRole("button", { name: "Close note editor" }).click();
    await page.locator("#japaneseWorkspaceButton").click();
    await expect(page.locator("#japaneseWorkspaceButton")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#editorRegion")).toBeHidden();
    await page.locator("#notesWorkspaceButton").click();
    await page.locator('.note-item[aria-current="true"]').click();
    await expect(page.locator("#titleInput")).toHaveValue(title);
    await expect(page.locator("#contentInput")).toHaveValue(content);
  });
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("interactive visual states do not require motion", async ({ page }) => {
    await page.goto("/");
    const styles = await page.locator("#newNoteButton").evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      return {
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });
    expect(styles.animationName).toBe("none");
    expect(styles.animationDuration).toBe("0s");
    expect(styles.transitionDuration).toBe("0s");
  });
});
