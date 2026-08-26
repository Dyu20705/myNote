import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_THEMES, validateTheme, THEME_SCHEMA_VERSION } from "../../core/theme/themeSchema.js";

test("Theme Schema Validator — built-in themes pass validation", () => {
  for (const theme of Object.values(BUILTIN_THEMES)) {
    const validated = validateTheme(theme);
    assert.equal(validated.id, theme.id);
    assert.equal(validated.version, THEME_SCHEMA_VERSION);
    assert.equal(typeof validated.colors.primary, "string");
    assert.equal(typeof validated.typography.fontFamilyPrimary, "string");
    assert.equal(typeof validated.metrics.spacingUnitPx, "number");
  }
});

test("Theme Schema Validator — accepts valid custom theme with hex, rgb, rgba, and hsl colors", () => {
  const customTheme = {
    id: "custom-neon-matrix",
    version: 1,
    name: "Custom Neon Matrix",
    isDark: true,
    author: "Matrix Neo",
    colors: {
      background: "#0d1117",
      surface: "rgb(22, 27, 34)",
      surfaceHover: "rgba(33, 38, 45, 0.8)",
      textPrimary: "#58a6ff",
      textSecondary: "hsl(210, 100%, 75%)",
      textMuted: "#8b949e",
      border: "#30363d",
      borderFocus: "#1f6feb",
      primary: "#238636",
      primaryHover: "#2ea043",
      accent: "#a371f7",
      statusSuccess: "#3fb950",
      statusWarning: "#d29922",
      statusError: "#f85149",
    },
    typography: {
      fontFamilyPrimary: "system-ui, sans-serif",
      fontFamilyMono: "monospace",
      fontFamilyJapanese: "sans-serif",
      fontSizeBasePx: 14,
      lineHeight: 1.4,
    },
    metrics: {
      spacingUnitPx: 6,
      borderRadiusPx: 4,
      sidebarWidthPx: 240,
      overlayMaxWidthPx: 800,
    },
  };

  const validated = validateTheme(customTheme);
  assert.equal(validated.id, "custom-neon-matrix");
  assert.equal(validated.name, "Custom Neon Matrix");
  assert.equal(validated.colors.surface, "rgb(22, 27, 34)");
  assert.equal(validated.typography.fontSizeBasePx, 14);
});

test("Theme Schema Validator — rejects invalid or missing fields", () => {
  assert.throws(() => validateTheme(null), /Theme definition must be a non-null object/);
  assert.throws(() => validateTheme([]), /Theme definition must be a non-null object/);
  assert.throws(() => validateTheme({}), /Theme id must be a kebab-case string/);
  assert.throws(() => validateTheme({ id: "INVALID ID WITH SPACES" }), /Theme id must be a kebab-case string/);
  assert.throws(() => validateTheme({ id: "valid-id", version: 99 }), /Theme schema version must be 1/);
  assert.throws(() => validateTheme({ id: "valid-id", version: 1, name: "" }), /Theme name must be a non-empty string/);
  assert.throws(() => validateTheme({ id: "valid-id", version: 1, name: "Name", isDark: "not-a-boolean" }), /Theme isDark flag must be a boolean/);

  const sample = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"]));
  delete sample.colors.primary;
  assert.throws(() => validateTheme(sample), /Invalid or missing color token 'primary'/);

  const invalidColor = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"]));
  invalidColor.colors.background = "not-a-color-string";
  assert.throws(() => validateTheme(invalidColor), /Invalid or missing color token 'background'/);
});

test("Theme Schema Validator — rejects invalid typography and metric bounds", () => {
  const sample = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"]));
  sample.typography.fontSizeBasePx = 5; // Too small (< 10)
  assert.throws(() => validateTheme(sample), /fontSizeBasePx must be a number between 10 and 32/);

  sample.typography.fontSizeBasePx = 16;
  sample.metrics.borderRadiusPx = 100; // Too large (> 24)
  assert.throws(() => validateTheme(sample), /borderRadiusPx must be a number between 0 and 24/);

  sample.metrics.borderRadiusPx = 6;
  sample.metrics.sidebarWidthPx = 100; // Too narrow (< 180)
  assert.throws(() => validateTheme(sample), /sidebarWidthPx must be a number between 180 and 400/);

  sample.metrics.sidebarWidthPx = 260;
  sample.metrics.overlayMaxWidthPx = 3000; // Too wide (> 1200)
  assert.throws(() => validateTheme(sample), /overlayMaxWidthPx must be a number between 480 and 1200/);
});

test("Theme Schema Validator — isolates hostile own getter mutations and provides defensive copy", () => {
  const rawTheme = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"]));
  const validated = validateTheme(rawTheme);

  // Mutating raw theme does not affect validated copy
  rawTheme.colors.primary = "#000000";
  assert.notEqual(validated.colors.primary, "#000000");

  const hostile = Object.create(BUILTIN_THEMES["default-light"]);
  Object.defineProperty(hostile, "name", {
    get() {
      throw new Error("Getter attack");
    },
  });
  assert.throws(() => validateTheme(hostile), /Getter attack/);
});
