import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILTIN_THEMES,
  validateTheme,
  validateThemeId,
  validateThemeColors,
  validateThemeTypography,
  validateThemeMetrics,
  deepFreeze,
  THEME_SCHEMA_VERSION,
} from "../../core/theme/themeSchema.js";

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
      fontSizeBasePx: 14.5,
      lineHeight: 1.45,
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
  assert.equal(validated.typography.fontSizeBasePx, 14.5);
  assert.equal(validated.typography.lineHeight, 1.45);
});

test("Theme Schema Validator — rejects invalid top-level fields", () => {
  assert.throws(() => validateTheme(null), /Theme definition must be a non-null object/);
  assert.throws(() => validateTheme([]), /Theme definition must be a non-null object/);
  assert.throws(() => validateTheme(42), /Theme definition must be a non-null object/);
  assert.throws(() => validateTheme({}), /Theme id must be a kebab-case string/);
  assert.throws(() => validateTheme({ id: "INVALID ID WITH SPACES" }), /Theme id must be a kebab-case string/);
  assert.throws(() => validateTheme({ id: "valid-id", version: 99 }), /Theme schema version must be 1/);
  assert.throws(() => validateTheme({ id: "valid-id", version: 1, name: "" }), /Theme name must be a non-empty string/);
  assert.throws(() => validateTheme({ id: "valid-id", version: 1, name: "Name", isDark: "not-a-boolean" }), /Theme isDark flag must be a boolean/);
  assert.throws(
    () => validateTheme({ id: "valid-id", version: 1, name: "Name", isDark: true, author: "a".repeat(65) }),
    /Theme author must be a string under 64 characters/,
  );
});

test("Theme Schema Validator — validateThemeId helper checks edge cases", () => {
  assert.equal(validateThemeId("dark-nord_1"), "dark-nord_1");
  assert.equal(validateThemeId("ab"), "ab");
  assert.equal(validateThemeId("a".repeat(64)), "a".repeat(64));

  assert.throws(() => validateThemeId(""), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId("a"), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId("a".repeat(65)), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId("UPPERCASE-ID"), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId("has space"), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId("special@char"), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId("dot.notation"), /Theme id must be a kebab-case string/);
  assert.throws(() => validateThemeId(null), /Theme id must be a kebab-case string/);
});

test("Theme Schema Validator — validateThemeColors rejects invalid tokens with path", () => {
  assert.throws(() => validateThemeColors(null), /Theme colors must be an object/);
  assert.throws(() => validateThemeColors([]), /Theme colors must be an object/);

  const sample = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"].colors));
  delete sample.primary;
  assert.throws(() => validateThemeColors(sample), /Invalid or missing color token 'colors\.primary'/);

  const invalidColor = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"].colors));
  invalidColor.background = "not-a-color-string";
  assert.throws(() => validateThemeColors(invalidColor), /Invalid or missing color token 'colors\.background'/);

  const nonStringColor = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"].colors));
  nonStringColor.surface = 12345;
  assert.throws(() => validateThemeColors(nonStringColor), /Invalid or missing color token 'colors\.surface'/);

  const invalidHex = JSON.parse(JSON.stringify(BUILTIN_THEMES["default-light"].colors));
  invalidHex.accent = "#ggg";
  assert.throws(() => validateThemeColors(invalidHex), /Invalid or missing color token 'colors\.accent'/);
});

test("Theme Schema Validator — validateThemeTypography checks bounds and font families", () => {
  assert.throws(() => validateThemeTypography(null), /Theme typography must be an object/);
  assert.throws(() => validateThemeTypography([]), /Theme typography must be an object/);

  const baseTypo = { ...BUILTIN_THEMES["default-light"].typography };

  assert.throws(
    () => validateThemeTypography({ ...baseTypo, fontFamilyPrimary: "" }),
    /typography\.fontFamilyPrimary must be a non-empty string/,
  );
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, fontFamilyMono: "   " }),
    /typography\.fontFamilyMono must be a non-empty string/,
  );
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, fontFamilyJapanese: null }),
    /typography\.fontFamilyJapanese must be a non-empty string/,
  );

  // fontSizeBasePx bounds: 10 - 32
  assert.equal(validateThemeTypography({ ...baseTypo, fontSizeBasePx: 10 }).fontSizeBasePx, 10);
  assert.equal(validateThemeTypography({ ...baseTypo, fontSizeBasePx: 32 }).fontSizeBasePx, 32);
  assert.equal(validateThemeTypography({ ...baseTypo, fontSizeBasePx: 14.5 }).fontSizeBasePx, 14.5);
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, fontSizeBasePx: 9.9 }),
    /typography\.fontSizeBasePx must be a number between 10 and 32/,
  );
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, fontSizeBasePx: 32.1 }),
    /typography\.fontSizeBasePx must be a number between 10 and 32/,
  );
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, fontSizeBasePx: Number.NaN }),
    /typography\.fontSizeBasePx must be a number between 10 and 32/,
  );

  // lineHeight bounds: 1.0 - 2.5
  assert.equal(validateThemeTypography({ ...baseTypo, lineHeight: 1.0 }).lineHeight, 1.0);
  assert.equal(validateThemeTypography({ ...baseTypo, lineHeight: 2.5 }).lineHeight, 2.5);
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, lineHeight: 0.9 }),
    /typography\.lineHeight must be a number between 1.0 and 2.5/,
  );
  assert.throws(
    () => validateThemeTypography({ ...baseTypo, lineHeight: 2.6 }),
    /typography\.lineHeight must be a number between 1.0 and 2.5/,
  );
});

test("Theme Schema Validator — validateThemeMetrics checks layout boundaries", () => {
  assert.throws(() => validateThemeMetrics(null), /Theme metrics must be an object/);
  assert.throws(() => validateThemeMetrics([]), /Theme metrics must be an object/);

  const baseMetrics = { ...BUILTIN_THEMES["default-light"].metrics };

  // spacingUnitPx: 4 - 16
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, spacingUnitPx: 3 }),
    /metrics\.spacingUnitPx must be a number between 4 and 16/,
  );
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, spacingUnitPx: 17 }),
    /metrics\.spacingUnitPx must be a number between 4 and 16/,
  );

  // borderRadiusPx: 0 - 24
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, borderRadiusPx: -1 }),
    /metrics\.borderRadiusPx must be a number between 0 and 24/,
  );
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, borderRadiusPx: 25 }),
    /metrics\.borderRadiusPx must be a number between 0 and 24/,
  );

  // sidebarWidthPx: 180 - 400
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, sidebarWidthPx: 179 }),
    /metrics\.sidebarWidthPx must be a number between 180 and 400/,
  );
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, sidebarWidthPx: 401 }),
    /metrics\.sidebarWidthPx must be a number between 180 and 400/,
  );

  // overlayMaxWidthPx: 480 - 1200
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, overlayMaxWidthPx: 479 }),
    /metrics\.overlayMaxWidthPx must be a number between 480 and 1200/,
  );
  assert.throws(
    () => validateThemeMetrics({ ...baseMetrics, overlayMaxWidthPx: 1201 }),
    /metrics\.overlayMaxWidthPx must be a number between 480 and 1200/,
  );
});

test("Theme Schema Validator — deepFreeze utility creates immutable nested objects", () => {
  const target = {
    nested: {
      count: 1,
      deeper: {
        value: "test",
      },
    },
  };
  const frozen = deepFreeze(target);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(Object.isFrozen(frozen.nested), true);
  assert.equal(Object.isFrozen(frozen.nested.deeper), true);

  assert.throws(() => {
    frozen.nested.count = 2;
  }, /Cannot assign to read only property/);
});

test("Theme Schema Validator — rejects prototype pollution attempts", () => {
  const payload = JSON.parse('{"id":"custom-theme","version":1,"name":"Pollution Test","isDark":false,"colors":{"background":"#fff","surface":"#fff","surfaceHover":"#fff","textPrimary":"#000","textSecondary":"#000","textMuted":"#000","border":"#000","borderFocus":"#000","primary":"#000","primaryHover":"#000","accent":"#000","statusSuccess":"#000","statusWarning":"#000","statusError":"#000"},"typography":{"fontFamilyPrimary":"sans-serif","fontFamilyMono":"monospace","fontFamilyJapanese":"sans-serif","fontSizeBasePx":16,"lineHeight":1.5},"metrics":{"spacingUnitPx":8,"borderRadiusPx":4,"sidebarWidthPx":240,"overlayMaxWidthPx":800},"__proto__":{"polluted":true}}');
  const validated = validateTheme(payload);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(validated.polluted, undefined);
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
