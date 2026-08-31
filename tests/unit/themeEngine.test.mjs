import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_THEMES } from "../../core/theme/themeSchema.js";
import {
  applyThemeTokens,
  getActiveThemeTokens,
  resetThemeTokens,
  themeToCssVariables,
} from "../../core/theme/themeEngine.js";

function createMockElement() {
  const styles = new Map();
  const attributes = new Map();

  return {
    style: {
      colorScheme: "",
      setProperty(name, value) {
        styles.set(name, String(value));
      },
      removeProperty(name) {
        styles.delete(name);
      },
      getPropertyValue(name) {
        return styles.get(name) || "";
      },
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    _styles: styles,
    _attributes: attributes,
  };
}

test("themeToCssVariables — maps light and dark theme tokens to CSS custom properties with correct units", () => {
  const lightTheme = BUILTIN_THEMES["default-light"];
  const vars = themeToCssVariables(lightTheme);

  // Color tokens
  assert.equal(vars["--theme-color-background"], "#ffffff");
  assert.equal(vars["--theme-color-surface"], "#f8f9fa");
  assert.equal(vars["--theme-color-primary"], "#228be6");
  assert.equal(vars["--theme-color-status-error"], "#c92a2a");

  // Metrics with px units
  assert.equal(vars["--theme-metric-spacing-unit"], "8px");
  assert.equal(vars["--theme-metric-border-radius"], "6px");
  assert.equal(vars["--theme-metric-sidebar-width"], "260px");
  assert.equal(vars["--theme-metric-overlay-max-width"], "760px");

  // Typography with units
  assert.equal(vars["--theme-font-size-base"], "16px");
  assert.equal(vars["--theme-line-height"], "1.5");
  assert.equal(vars["--theme-font-primary"], lightTheme.typography.fontFamilyPrimary);

  // Framework --mn-* aliases
  assert.equal(vars["--mn-bg-canvas"], "#ffffff");
  assert.equal(vars["--mn-surface-base"], "#f8f9fa");
  assert.equal(vars["--mn-text-primary"], "#212529");
  assert.equal(vars["--mn-border-default"], "#dee2e6");
  assert.equal(vars["--mn-focus-ring"], "#4dabf7");
  assert.equal(vars["--mn-action-primary-bg"], "#228be6");
  assert.equal(vars["--mn-content-readable"], "760px");

  // Transitional aliases
  assert.equal(vars["--bg"], "#ffffff");
  assert.equal(vars["--panel"], "#f8f9fa");
  assert.equal(vars["--border"], "#dee2e6");
  assert.equal(vars["--text"], "#212529");
  assert.equal(vars["--focus"], "#4dabf7");
});

test("applyThemeTokens — applies tokens and metadata to target element", () => {
  const element = createMockElement();
  const theme = BUILTIN_THEMES["nordic-dark"];

  applyThemeTokens(theme, element);

  assert.equal(element.style.colorScheme, "dark");
  assert.equal(element.getAttribute("data-theme-id"), "nordic-dark");
  assert.equal(element.getAttribute("data-theme-dark"), "true");
  assert.equal(element.style.getPropertyValue("--theme-color-background"), "#2e3440");
  assert.equal(element.style.getPropertyValue("--mn-bg-canvas"), "#2e3440");
  assert.equal(element.style.getPropertyValue("--mn-text-primary"), "#eceff4");
  assert.equal(element.style.getPropertyValue("--theme-metric-border-radius"), "8px");
});

test("applyThemeTokens — rejects invalid theme structures", () => {
  const element = createMockElement();

  assert.throws(() => applyThemeTokens(null, element), /Theme definition must be a non-null object/);
  assert.throws(() => applyThemeTokens({ id: "invalid" }, element));
  assert.equal(element._styles.size, 0);
});

test("getActiveThemeTokens — extracts active theme custom properties from element", () => {
  const element = createMockElement();
  applyThemeTokens(BUILTIN_THEMES["kyoto-paper"], element);

  const active = getActiveThemeTokens(element);
  assert.equal(active["--theme-color-background"], "#f7f4eb");
  assert.equal(active["--theme-color-primary"], "#b24c3d");
  assert.equal(active["--theme-font-size-base"], "16px");
});

test("resetThemeTokens — removes all theme properties and attributes", () => {
  const element = createMockElement();
  applyThemeTokens(BUILTIN_THEMES["nordic-dark"], element);
  assert.ok(element._styles.size > 0);

  resetThemeTokens(element);
  assert.equal(element._styles.size, 0);
  assert.equal(element.style.colorScheme, "");
  assert.equal(element.getAttribute("data-theme-id"), null);
  assert.equal(element.getAttribute("data-theme-dark"), null);
});
