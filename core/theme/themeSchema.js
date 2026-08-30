/**
 * @fileoverview Theme Schema Definition and Contract Validator.
 * Zero external runtime dependencies.
 */

import { deepFreeze } from "./themeHelpers.js";

export { deepFreeze };
export const THEME_SCHEMA_VERSION = 1;

/**
 * Standard Built-in System Themes
 */
export const BUILTIN_THEMES = deepFreeze({
  "default-light": {
    id: "default-light",
    version: THEME_SCHEMA_VERSION,
    name: "Default Light",
    isDark: false,
    author: "myNote Core",
    colors: {
      background: "#ffffff",
      surface: "#f8f9fa",
      surfaceHover: "#e9ecef",
      textPrimary: "#212529",
      textSecondary: "#6c757d",
      textMuted: "#adb5bd",
      border: "#dee2e6",
      borderFocus: "#4dabf7",
      primary: "#228be6",
      primaryHover: "#1c7ed6",
      accent: "#7950f2",
      statusSuccess: "#2b8a3e",
      statusWarning: "#e67700",
      statusError: "#c92a2a",
    },
    typography: {
      fontFamilyPrimary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontFamilyJapanese: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif',
      fontSizeBasePx: 16,
      lineHeight: 1.5,
    },
    metrics: {
      spacingUnitPx: 8,
      borderRadiusPx: 6,
      sidebarWidthPx: 260,
      overlayMaxWidthPx: 760,
    },
  },

  "nordic-dark": {
    id: "nordic-dark",
    version: THEME_SCHEMA_VERSION,
    name: "Nordic Dark",
    isDark: true,
    author: "myNote Core",
    colors: {
      background: "#2e3440",
      surface: "#3b4252",
      surfaceHover: "#434c5e",
      textPrimary: "#eceff4",
      textSecondary: "#d8dee9",
      textMuted: "#4c566a",
      border: "#4c566a",
      borderFocus: "#88c0d0",
      primary: "#88c0d0",
      primaryHover: "#81a1c1",
      accent: "#b48ead",
      statusSuccess: "#a3be8c",
      statusWarning: "#ebcb8b",
      statusError: "#bf616a",
    },
    typography: {
      fontFamilyPrimary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      fontFamilyJapanese: '"Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif',
      fontSizeBasePx: 16,
      lineHeight: 1.5,
    },
    metrics: {
      spacingUnitPx: 8,
      borderRadiusPx: 8,
      sidebarWidthPx: 260,
      overlayMaxWidthPx: 760,
    },
  },

  "kyoto-paper": {
    id: "kyoto-paper",
    version: THEME_SCHEMA_VERSION,
    name: "Kyoto Paper",
    isDark: false,
    author: "myNote Japanese Workspace",
    colors: {
      background: "#f7f4eb",
      surface: "#ede8db",
      surfaceHover: "#e2dcce",
      textPrimary: "#2c2926",
      textSecondary: "#635e59",
      textMuted: "#968f85",
      border: "#d8d1c3",
      borderFocus: "#b24c3d",
      primary: "#b24c3d",
      primaryHover: "#9a3e30",
      accent: "#3d7068",
      statusSuccess: "#3e704e",
      statusWarning: "#b07328",
      statusError: "#b24c3d",
    },
    typography: {
      fontFamilyPrimary: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontFamilyMono: 'ui-monospace, SFMono-Regular, monospace',
      fontFamilyJapanese: '"Yu Mincho", "Hiragino Mincho ProN", serif',
      fontSizeBasePx: 16,
      lineHeight: 1.6,
    },
    metrics: {
      spacingUnitPx: 8,
      borderRadiusPx: 4,
      sidebarWidthPx: 260,
      overlayMaxWidthPx: 760,
    },
  },
});

const COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*\))$/;

export const REQUIRED_COLOR_TOKENS = Object.freeze([
  "background",
  "surface",
  "surfaceHover",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "border",
  "borderFocus",
  "primary",
  "primaryHover",
  "accent",
  "statusSuccess",
  "statusWarning",
  "statusError",
]);

/**
 * Validates theme ID format.
 *
 * @param {unknown} id
 * @returns {string}
 */
export function validateThemeId(id) {
  if (typeof id !== "string" || !/^[a-z0-9-_]{2,64}$/.test(id)) {
    throw new TypeError("Theme id must be a kebab-case string (2-64 chars)");
  }
  return id;
}

/**
 * Validates theme colors map and returns sanitized copies.
 *
 * @param {unknown} colors
 * @returns {Record<string, string>}
 */
export function validateThemeColors(colors) {
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    throw new TypeError("Theme colors must be an object");
  }

  const cleanColors = {};
  for (const key of REQUIRED_COLOR_TOKENS) {
    const val = colors[key];
    if (typeof val !== "string" || !COLOR_REGEX.test(val.trim())) {
      throw new TypeError(`Invalid or missing color token 'colors.${key}': '${val}'`);
    }
    cleanColors[key] = val.trim();
  }
  return cleanColors;
}

/**
 * Validates typography metrics and font families.
 *
 * @param {unknown} typography
 * @returns {object}
 */
export function validateThemeTypography(typography) {
  if (!typography || typeof typography !== "object" || Array.isArray(typography)) {
    throw new TypeError("Theme typography must be an object");
  }

  const { fontFamilyPrimary, fontFamilyMono, fontFamilyJapanese, fontSizeBasePx, lineHeight } = typography;

  if (typeof fontFamilyPrimary !== "string" || fontFamilyPrimary.trim().length === 0) {
    throw new TypeError("typography.fontFamilyPrimary must be a non-empty string");
  }
  if (typeof fontFamilyMono !== "string" || fontFamilyMono.trim().length === 0) {
    throw new TypeError("typography.fontFamilyMono must be a non-empty string");
  }
  if (typeof fontFamilyJapanese !== "string" || fontFamilyJapanese.trim().length === 0) {
    throw new TypeError("typography.fontFamilyJapanese must be a non-empty string");
  }
  if (typeof fontSizeBasePx !== "number" || Number.isNaN(fontSizeBasePx) || fontSizeBasePx < 10 || fontSizeBasePx > 32) {
    throw new TypeError("typography.fontSizeBasePx must be a number between 10 and 32");
  }
  if (typeof lineHeight !== "number" || Number.isNaN(lineHeight) || lineHeight < 1.0 || lineHeight > 2.5) {
    throw new TypeError("typography.lineHeight must be a number between 1.0 and 2.5");
  }

  return {
    fontFamilyPrimary: fontFamilyPrimary.trim(),
    fontFamilyMono: fontFamilyMono.trim(),
    fontFamilyJapanese: fontFamilyJapanese.trim(),
    fontSizeBasePx,
    lineHeight,
  };
}

/**
 * Validates structural metrics and layout boundaries.
 *
 * @param {unknown} metrics
 * @returns {object}
 */
export function validateThemeMetrics(metrics) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    throw new TypeError("Theme metrics must be an object");
  }

  const { spacingUnitPx, borderRadiusPx, sidebarWidthPx, overlayMaxWidthPx } = metrics;

  if (typeof spacingUnitPx !== "number" || Number.isNaN(spacingUnitPx) || spacingUnitPx < 4 || spacingUnitPx > 16) {
    throw new TypeError("metrics.spacingUnitPx must be a number between 4 and 16");
  }
  if (typeof borderRadiusPx !== "number" || Number.isNaN(borderRadiusPx) || borderRadiusPx < 0 || borderRadiusPx > 24) {
    throw new TypeError("metrics.borderRadiusPx must be a number between 0 and 24");
  }
  if (typeof sidebarWidthPx !== "number" || Number.isNaN(sidebarWidthPx) || sidebarWidthPx < 180 || sidebarWidthPx > 400) {
    throw new TypeError("metrics.sidebarWidthPx must be a number between 180 and 400");
  }
  if (typeof overlayMaxWidthPx !== "number" || Number.isNaN(overlayMaxWidthPx) || overlayMaxWidthPx < 480 || overlayMaxWidthPx > 1200) {
    throw new TypeError("metrics.overlayMaxWidthPx must be a number between 480 and 1200");
  }

  return {
    spacingUnitPx,
    borderRadiusPx,
    sidebarWidthPx,
    overlayMaxWidthPx,
  };
}

/**
 * Validates a theme object against the contract.
 * Returns a defensive copy on success, or throws a descriptive TypeError.
 *
 * @param {unknown} input
 * @returns {object} Clean validated theme copy
 */
export function validateTheme(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Theme definition must be a non-null object");
  }

  const { id, version, name, isDark, author, colors, typography, metrics } = input;

  const validId = validateThemeId(id);

  if (version !== THEME_SCHEMA_VERSION) {
    throw new TypeError(`Theme schema version must be ${THEME_SCHEMA_VERSION}`);
  }

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 64) {
    throw new TypeError("Theme name must be a non-empty string under 64 characters");
  }

  if (typeof isDark !== "boolean") {
    throw new TypeError("Theme isDark flag must be a boolean");
  }

  if (author !== undefined && (typeof author !== "string" || author.length > 64)) {
    throw new TypeError("Theme author must be a string under 64 characters");
  }

  const cleanColors = validateThemeColors(colors);
  const cleanTypography = validateThemeTypography(typography);
  const cleanMetrics = validateThemeMetrics(metrics);

  return {
    id: validId,
    version,
    name: name.trim(),
    isDark,
    author: author ? author.trim() : "Custom",
    colors: cleanColors,
    typography: cleanTypography,
    metrics: cleanMetrics,
  };
}
