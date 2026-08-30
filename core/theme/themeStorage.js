/**
 * @fileoverview Theme Storage and Parser abstractions.
 * Manages custom user theme persistence, file import/export, and schema validation.
 */

import { BUILTIN_THEMES, validateTheme } from "./themeSchema.js";
import {
  deleteUserThemeFromDb,
  getUserThemeFromDb,
  listUserThemesFromDb,
  saveUserThemeToDb,
} from "../storage.js";

const MAX_THEME_JSON_BYTES = 262144; // 256 KB

/**
 * Safely parses and validates a theme JSON string.
 *
 * @param {string} jsonString
 * @returns {object} Validated defensive copy of theme definition
 */
export function importThemeFromJson(jsonString) {
  if (typeof jsonString !== "string") {
    throw new TypeError("Theme JSON must be a string");
  }
  if (jsonString.length > MAX_THEME_JSON_BYTES) {
    throw new RangeError(`Theme JSON exceeds maximum allowed size (${MAX_THEME_JSON_BYTES} bytes)`);
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new TypeError(`Invalid theme JSON: ${error.message}`, { cause: error });
  }

  return validateTheme(parsed);
}

/**
 * Serializes a validated theme to formatted JSON.
 *
 * @param {object} theme
 * @returns {string}
 */
export function exportThemeToJson(theme) {
  const validated = validateTheme(theme);
  return JSON.stringify(validated, null, 2);
}

/**
 * Retrieves all themes (both built-in and user-custom themes).
 *
 * @param {IDBDatabase} db
 * @returns {Promise<Array<object>>}
 */
export async function listThemes(db) {
  const userThemes = await listUserThemesFromDb(db);
  return [...Object.values(BUILTIN_THEMES), ...userThemes];
}

/**
 * Retrieves a single theme by ID.
 *
 * @param {IDBDatabase} db
 * @param {string} id
 * @returns {Promise<object|undefined>}
 */
export async function getTheme(db, id) {
  if (BUILTIN_THEMES[id]) {
    return structuredClone(BUILTIN_THEMES[id]);
  }
  return getUserThemeFromDb(db, id);
}

/**
 * Saves a user-created theme to the database.
 * Blocks overwriting built-in system themes.
 *
 * @param {IDBDatabase} db
 * @param {object} theme
 * @returns {Promise<void>}
 */
export async function saveTheme(db, theme) {
  const validated = validateTheme(theme);
  if (BUILTIN_THEMES[validated.id]) {
    throw new Error(`Cannot overwrite built-in theme '${validated.id}'`);
  }
  return saveUserThemeToDb(db, validated);
}

/**
 * Renames an existing custom user theme.
 *
 * @param {IDBDatabase} db
 * @param {string} id
 * @param {string} newName
 * @returns {Promise<void>}
 */
export async function renameTheme(db, id, newName) {
  if (BUILTIN_THEMES[id]) {
    throw new Error(`Cannot rename built-in theme '${id}'`);
  }
  const existing = await getUserThemeFromDb(db, id);
  if (!existing) {
    throw new Error(`Theme not found: '${id}'`);
  }
  existing.name = newName;
  const validated = validateTheme(existing);
  return saveUserThemeToDb(db, validated);
}

/**
 * Deletes a user theme by ID.
 * Blocks deleting built-in system themes.
 *
 * @param {IDBDatabase} db
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTheme(db, id) {
  if (BUILTIN_THEMES[id]) {
    throw new Error(`Cannot delete built-in theme '${id}'`);
  }
  return deleteUserThemeFromDb(db, id);
}
