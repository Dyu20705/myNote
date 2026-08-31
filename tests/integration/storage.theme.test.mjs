import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { BUILTIN_THEMES } from "../../core/theme/themeSchema.js";
import {
  deleteTheme,
  exportThemeToJson,
  getTheme,
  importThemeFromJson,
  listThemes,
  renameTheme,
  saveTheme,
} from "../../core/theme/themeStorage.js";
import {
  exportDatabase,
  getSettings,
  getUserThemeFromDb,
  importDatabase,
  listUserThemesFromDb,
  openDatabase,
  putSettings,
  STORE_SETTINGS,
  STORE_USER_THEMES,
} from "../../core/storage.js";

await import("fake-indexeddb/auto");

const DATABASE_NAME = "myNoteDB";
const openHandles = new Set();

function closeAllDatabaseHandles() {
  for (const database of openHandles) {
    database.close();
  }
  openHandles.clear();
}

function deleteTestDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Test database deletion was blocked by an open handle."));
  });
}

async function openTestDatabase() {
  const database = await openDatabase();
  openHandles.add(database);
  return database;
}

function makeCustomTheme(id = "custom-emerald", overrides = {}) {
  return {
    id,
    version: 1,
    name: "Custom Emerald",
    isDark: true,
    author: "Test Author",
    colors: {
      background: "#062817",
      surface: "#0b3d24",
      surfaceHover: "#115232",
      textPrimary: "#a7f3d0",
      textSecondary: "#6ee7b7",
      textMuted: "#34d399",
      border: "#10b981",
      borderFocus: "#34d399",
      primary: "#10b981",
      primaryHover: "#059669",
      accent: "#6ee7b7",
      statusSuccess: "#10b981",
      statusWarning: "#fbbf24",
      statusError: "#f87171",
    },
    typography: {
      fontFamilyPrimary: "system-ui, sans-serif",
      fontFamilyMono: "monospace",
      fontFamilyJapanese: "sans-serif",
      fontSizeBasePx: 15,
      lineHeight: 1.5,
    },
    metrics: {
      spacingUnitPx: 8,
      borderRadiusPx: 6,
      sidebarWidthPx: 260,
      overlayMaxWidthPx: 760,
    },
    ...overrides,
  };
}

describe("Theme Storage and Settings Persistence (DB v6)", () => {
  beforeEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  afterEach(async () => {
    closeAllDatabaseHandles();
    await deleteTestDatabase();
  });

  test("fresh database creates v6 schema with userThemes and settings stores", async () => {
    const db = await openTestDatabase();
    assert.equal(db.version, 6);
    assert.ok(db.objectStoreNames.contains(STORE_USER_THEMES));
    assert.ok(db.objectStoreNames.contains(STORE_SETTINGS));

    const themes = await listUserThemesFromDb(db);
    assert.deepEqual(themes, []);

    const appSettings = await getSettings(db, "app");
    assert.equal(appSettings, undefined);
  });

  test("settings CRUD — stores, retrieves, and updates key-value settings", async () => {
    const db = await openTestDatabase();

    await putSettings(db, "app", { activeThemeId: "nordic-dark", isCustomTheme: false });
    const fetched = await getSettings(db, "app");
    assert.deepEqual(fetched, { activeThemeId: "nordic-dark", isCustomTheme: false });

    await putSettings(db, "app", { activeThemeId: "custom-emerald", isCustomTheme: true });
    const updated = await getSettings(db, "app");
    assert.deepEqual(updated, { activeThemeId: "custom-emerald", isCustomTheme: true });
  });

  test("themeStorage CRUD — saves, gets, lists, renames, and deletes custom user themes", async () => {
    const db = await openTestDatabase();
    const theme = makeCustomTheme("custom-ruby", { name: "Ruby Sunset" });

    // Save
    await saveTheme(db, theme);

    // Get
    const fetched = await getTheme(db, "custom-ruby");
    assert.equal(fetched.id, "custom-ruby");
    assert.equal(fetched.name, "Ruby Sunset");

    // List (merges built-ins + user themes)
    const all = await listThemes(db);
    assert.ok(all.some((t) => t.id === "default-light"));
    assert.ok(all.some((t) => t.id === "custom-ruby"));

    // Rename
    await renameTheme(db, "custom-ruby", "Ruby Sunset V2");
    const renamed = await getTheme(db, "custom-ruby");
    assert.equal(renamed.name, "Ruby Sunset V2");

    // Delete
    await deleteTheme(db, "custom-ruby");
    assert.equal(await getUserThemeFromDb(db, "custom-ruby"), undefined);
  });

  test("built-in theme protection — cannot save, rename, or delete built-in themes", async () => {
    const db = await openTestDatabase();

    await assert.rejects(
      () => saveTheme(db, { ...BUILTIN_THEMES["default-light"], name: "Hacked Light" }),
      /Cannot overwrite built-in theme/,
    );

    await assert.rejects(
      () => renameTheme(db, "default-light", "New Name"),
      /Cannot rename built-in theme/,
    );

    await assert.rejects(
      () => deleteTheme(db, "default-light"),
      /Cannot delete built-in theme/,
    );
  });

  test("importThemeFromJson — safely parses, validates, and rejects invalid theme JSON", () => {
    const validJson = JSON.stringify(makeCustomTheme());
    const imported = importThemeFromJson(validJson);
    assert.equal(imported.id, "custom-emerald");

    // Reject malformed JSON
    assert.throws(() => importThemeFromJson("{ invalid json }"), /Invalid theme JSON/);

    // Reject non-string or oversized (> 256KB)
    assert.throws(() => importThemeFromJson(null), /Theme JSON must be a string/);
    assert.throws(() => importThemeFromJson("a".repeat(300000)), /Theme JSON exceeds maximum allowed size/);

    // Reject schema-invalid theme
    assert.throws(
      () => importThemeFromJson(JSON.stringify({ id: "bad", version: 1, name: "Bad", isDark: false, colors: {} })),
      /Invalid or missing color token/,
    );
  });

  test("exportThemeToJson — serializes validated theme to formatted JSON", () => {
    const theme = makeCustomTheme();
    const jsonStr = exportThemeToJson(theme);
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.id, theme.id);
    assert.equal(parsed.name, theme.name);
  });

  test("exportDatabase and importDatabase round-trip preserves userThemes and settings", async () => {
    let db = await openTestDatabase();

    const customTheme = makeCustomTheme("custom-gold", { name: "Gold Leaf" });
    await saveTheme(db, customTheme);
    await putSettings(db, "app", { activeThemeId: "custom-gold", isCustomTheme: true });

    // Export
    const snapshot = await exportDatabase(db);
    assert.equal(snapshot.schemaVersion, 6);
    assert.ok(Array.isArray(snapshot.userThemes));
    assert.equal(snapshot.userThemes.length, 1);
    assert.equal(snapshot.userThemes[0].id, "custom-gold");
    assert.ok(Array.isArray(snapshot.settings));
    assert.equal(snapshot.settings.length, 1);

    // Reset DB
    closeAllDatabaseHandles();
    await deleteTestDatabase();
    db = await openTestDatabase();

    // Import
    await importDatabase(db, snapshot);

    // Verify persistence
    const restoredTheme = await getTheme(db, "custom-gold");
    assert.equal(restoredTheme.name, "Gold Leaf");
    const restoredSettings = await getSettings(db, "app");
    assert.deepEqual(restoredSettings, { activeThemeId: "custom-gold", isCustomTheme: true });
  });
});
