/**
 * @fileoverview Dynamic CSS Variables Engine and Theme Token Mapping.
 * Translates contract-validated theme tokens into root CSS custom properties.
 */

import { validateTheme } from "./themeSchema.js";

/**
 * Converts a theme object into a flat record of CSS variable key-value pairs.
 *
 * @param {object} theme Validated theme definition
 * @returns {Record<string, string>}
 */
export function themeToCssVariables(theme) {
  const validated = validateTheme(theme);
  const { colors, typography, metrics } = validated;

  const vars = {
    // Direct Theme Token Variables
    "--theme-color-background": colors.background,
    "--theme-color-surface": colors.surface,
    "--theme-color-surface-hover": colors.surfaceHover,
    "--theme-color-text-primary": colors.textPrimary,
    "--theme-color-text-secondary": colors.textSecondary,
    "--theme-color-text-muted": colors.textMuted,
    "--theme-color-border": colors.border,
    "--theme-color-border-focus": colors.borderFocus,
    "--theme-color-primary": colors.primary,
    "--theme-color-primary-hover": colors.primaryHover,
    "--theme-color-accent": colors.accent,
    "--theme-color-status-success": colors.statusSuccess,
    "--theme-color-status-warning": colors.statusWarning,
    "--theme-color-status-error": colors.statusError,

    "--theme-font-primary": typography.fontFamilyPrimary,
    "--theme-font-mono": typography.fontFamilyMono,
    "--theme-font-japanese": typography.fontFamilyJapanese,
    "--theme-font-size-base": `${typography.fontSizeBasePx}px`,
    "--theme-line-height": `${typography.lineHeight}`,

    "--theme-metric-spacing-unit": `${metrics.spacingUnitPx}px`,
    "--theme-metric-border-radius": `${metrics.borderRadiusPx}px`,
    "--theme-metric-sidebar-width": `${metrics.sidebarWidthPx}px`,
    "--theme-metric-overlay-max-width": `${metrics.overlayMaxWidthPx}px`,

    // Framework --mn-* design tokens
    "--mn-bg-canvas": colors.background,
    "--mn-surface-base": colors.surface,
    "--mn-surface-raised": colors.surface,
    "--mn-surface-overlay": colors.surface,
    "--mn-surface-hover": colors.surfaceHover,
    "--mn-surface-selected": colors.surfaceHover,
    "--mn-surface-disabled": colors.surface,
    "--mn-text-primary": colors.textPrimary,
    "--mn-text-secondary": colors.textSecondary,
    "--mn-text-muted": colors.textMuted,
    "--mn-border-subtle": colors.border,
    "--mn-border-default": colors.border,
    "--mn-border-strong": colors.border,
    "--mn-focus-ring": colors.borderFocus,
    "--mn-action-primary-bg": colors.primary,
    "--mn-action-primary-hover": colors.primaryHover,
    "--mn-danger-border": colors.statusError,
    "--mn-danger-text": colors.statusError,
    "--mn-warning-text": colors.statusWarning,
    "--mn-success-text": colors.statusSuccess,

    "--mn-font-ui": typography.fontFamilyPrimary,
    "--mn-font-mono": typography.fontFamilyMono,
    "--mn-font-japanese": typography.fontFamilyJapanese,
    "--mn-sidebar-default": `${metrics.sidebarWidthPx}px`,
    "--mn-content-readable": `${metrics.overlayMaxWidthPx}px`,
    "--mn-radius-md": `${metrics.borderRadiusPx}px`,
    "--mn-space-2": `${metrics.spacingUnitPx}px`,

    // Transitional aliases
    "--bg": colors.background,
    "--panel": colors.surface,
    "--panel-2": colors.surface,
    "--border": colors.border,
    "--border-strong": colors.border,
    "--text": colors.textPrimary,
    "--muted": colors.textMuted,
    "--focus": colors.borderFocus,
  };

  return vars;
}

const APPLIED_VARIABLES = Object.freeze([
  "--theme-color-background",
  "--theme-color-surface",
  "--theme-color-surface-hover",
  "--theme-color-text-primary",
  "--theme-color-text-secondary",
  "--theme-color-text-muted",
  "--theme-color-border",
  "--theme-color-border-focus",
  "--theme-color-primary",
  "--theme-color-primary-hover",
  "--theme-color-accent",
  "--theme-color-status-success",
  "--theme-color-status-warning",
  "--theme-color-status-error",
  "--theme-font-primary",
  "--theme-font-mono",
  "--theme-font-japanese",
  "--theme-font-size-base",
  "--theme-line-height",
  "--theme-metric-spacing-unit",
  "--theme-metric-border-radius",
  "--theme-metric-sidebar-width",
  "--theme-metric-overlay-max-width",
  "--mn-bg-canvas",
  "--mn-surface-base",
  "--mn-surface-raised",
  "--mn-surface-overlay",
  "--mn-surface-hover",
  "--mn-surface-selected",
  "--mn-surface-disabled",
  "--mn-text-primary",
  "--mn-text-secondary",
  "--mn-text-muted",
  "--mn-border-subtle",
  "--mn-border-default",
  "--mn-border-strong",
  "--mn-focus-ring",
  "--mn-action-primary-bg",
  "--mn-action-primary-hover",
  "--mn-danger-border",
  "--mn-danger-text",
  "--mn-warning-text",
  "--mn-success-text",
  "--mn-font-ui",
  "--mn-font-mono",
  "--mn-font-japanese",
  "--mn-sidebar-default",
  "--mn-content-readable",
  "--mn-radius-md",
  "--mn-space-2",
  "--bg",
  "--panel",
  "--panel-2",
  "--border",
  "--border-strong",
  "--text",
  "--muted",
  "--focus",
]);

/**
 * Applies a theme to the specified root or container DOM element.
 *
 * @param {object} theme Theme definition
 * @param {HTMLElement} [targetElement] Target element, defaults to document.documentElement
 */
export function applyThemeTokens(theme, targetElement = globalThis.document?.documentElement) {
  if (!targetElement) return;

  const validated = validateTheme(theme);
  const vars = themeToCssVariables(validated);

  if (targetElement.style) {
    for (const [name, val] of Object.entries(vars)) {
      targetElement.style.setProperty(name, val);
    }
    targetElement.style.colorScheme = validated.isDark ? "dark" : "light";
  }

  if (typeof targetElement.setAttribute === "function") {
    targetElement.setAttribute("data-theme-id", validated.id);
    targetElement.setAttribute("data-theme-dark", String(validated.isDark));
  }
}

/**
 * Resets theme overrides on the target element, reverting to default stylesheet variables.
 *
 * @param {HTMLElement} [targetElement]
 */
export function resetThemeTokens(targetElement = globalThis.document?.documentElement) {
  if (!targetElement) return;

  if (targetElement.style) {
    for (const prop of APPLIED_VARIABLES) {
      targetElement.style.removeProperty(prop);
    }
    targetElement.style.colorScheme = "";
  }

  if (typeof targetElement.removeAttribute === "function") {
    targetElement.removeAttribute("data-theme-id");
    targetElement.removeAttribute("data-theme-dark");
  }
}

/**
 * Reads all active theme custom properties on the target element.
 *
 * @param {HTMLElement} [targetElement]
 * @returns {Record<string, string>}
 */
export function getActiveThemeTokens(targetElement = globalThis.document?.documentElement) {
  if (!targetElement || !targetElement.style) return {};

  const result = {};
  for (const prop of APPLIED_VARIABLES) {
    const val = targetElement.style.getPropertyValue(prop);
    if (val) {
      result[prop] = val;
    }
  }
  return result;
}
