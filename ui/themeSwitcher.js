/**
 * @fileoverview Theme Switcher UI Component.
 * Implements accessible modal dialog for previewing, browsing, and applying themes.
 */

import { BUILTIN_THEMES } from "../core/theme/themeSchema.js";
import { getTheme, listThemes } from "../core/theme/themeStorage.js";
import { applyThemeTokens, resetThemeTokens } from "../core/theme/themeEngine.js";

/**
 * Creates and binds a Theme Switcher UI controller.
 *
 * @param {object} options
 * @param {HTMLDialogElement} options.dialog
 * @param {HTMLElement} options.listElement
 * @param {HTMLElement} [options.closeButton]
 * @param {HTMLElement} [options.cancelButton]
 * @param {HTMLElement} [options.applyButton]
 * @param {object} options.dbProvider - Async function or object returning active IDBDatabase
 * @param {function} [options.onApply] - Callback when a theme is permanently applied: (theme) => void
 * @param {function} [options.getActiveThemeId] - Function returning currently active theme ID
 * @returns {object} Controller with open, close, and destroy methods
 */
export function createThemeSwitcher({
  dialog,
  listElement,
  closeButton,
  cancelButton,
  applyButton,
  dbProvider,
  onApply,
  document: doc = globalThis.document,
}) {
  let initialOpener = null;
  let initialTheme = null;
  let selectedTheme = null;
  let themesList = [];
  let isOpen = false;

  async function getDb() {
    return typeof dbProvider === "function" ? await dbProvider() : dbProvider;
  }

  function renderThemeItem(theme, isSelected) {
    const item = doc.createElement("div");
    item.className = "theme-option";
    item.setAttribute("role", "option");
    item.setAttribute("tabindex", "0");
    item.setAttribute("data-theme-id", theme.id);
    item.setAttribute("aria-selected", isSelected ? "true" : "false");

    const info = doc.createElement("div");
    info.className = "theme-option-info";

    const name = doc.createElement("span");
    name.className = "theme-option-name";
    name.textContent = theme.name;

    const meta = doc.createElement("span");
    meta.className = "theme-option-type";
    meta.textContent = `${theme.isDark ? "Dark" : "Light"}${BUILTIN_THEMES[theme.id] ? " · Built-in" : " · Custom"}`;

    info.appendChild(name);
    info.appendChild(meta);

    const swatches = doc.createElement("div");
    swatches.className = "theme-preview-swatches";
    swatches.setAttribute("aria-hidden", "true");

    const bgSwatch = doc.createElement("span");
    bgSwatch.className = "theme-swatch";
    bgSwatch.style.backgroundColor = theme.colors.background;
    bgSwatch.title = `Background: ${theme.colors.background}`;

    const priSwatch = doc.createElement("span");
    priSwatch.className = "theme-swatch";
    priSwatch.style.backgroundColor = theme.colors.primary;
    priSwatch.title = `Primary: ${theme.colors.primary}`;

    const accSwatch = doc.createElement("span");
    accSwatch.className = "theme-swatch";
    accSwatch.style.backgroundColor = theme.colors.accent;
    accSwatch.title = `Accent: ${theme.colors.accent}`;

    swatches.appendChild(bgSwatch);
    swatches.appendChild(priSwatch);
    swatches.appendChild(accSwatch);

    item.appendChild(info);
    item.appendChild(swatches);

    item.addEventListener("mouseenter", () => {
      previewTheme(theme);
    });

    item.addEventListener("click", () => {
      selectTheme(theme);
    });

    return item;
  }

  function previewTheme(theme) {
    applyThemeTokens(theme);
  }

  function selectTheme(theme) {
    selectedTheme = theme;
    previewTheme(theme);

    const items = listElement.querySelectorAll(".theme-option");
    for (const el of items) {
      const isCurrent = el.getAttribute("data-theme-id") === theme.id;
      el.setAttribute("aria-selected", isCurrent ? "true" : "false");
      if (isCurrent) {
        el.focus();
      }
    }
  }

  function navigateList(direction) {
    if (!themesList.length) return;
    const currentIndex = themesList.findIndex((t) => t.id === selectedTheme?.id);
    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = themesList.length - 1;
    if (nextIndex >= themesList.length) nextIndex = 0;

    const nextTheme = themesList[nextIndex];
    selectTheme(nextTheme);
  }

  async function open(opener = null) {
    initialOpener = opener || doc?.activeElement;
    isOpen = true;

    const db = await getDb();
    themesList = db ? await listThemes(db) : Object.values(BUILTIN_THEMES);

    const currentId = doc?.documentElement?.getAttribute("data-theme-id");
    initialTheme = currentId ? ((db ? await getTheme(db, currentId) : null) || BUILTIN_THEMES[currentId]) : null;
    selectedTheme = initialTheme || BUILTIN_THEMES["default-dark"];

    listElement.innerHTML = "";
    for (const theme of themesList) {
      const isSelected = theme.id === selectedTheme.id;
      const el = renderThemeItem(theme, isSelected);
      listElement.appendChild(el);
    }

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute("open", "");
    }

    const activeEl = listElement.querySelector(`[data-theme-id="${selectedTheme.id}"]`);
    if (activeEl) {
      activeEl.focus();
    } else if (listElement.firstElementChild) {
      listElement.firstElementChild.focus();
    }
  }

  function close(revert = true) {
    if (!isOpen) return;
    isOpen = false;

    if (revert) {
      if (initialTheme) {
        applyThemeTokens(initialTheme);
      } else {
        resetThemeTokens();
      }
    }

    if (typeof dialog.close === "function") {
      if (dialog.open) {
        dialog.close();
      }
    } else {
      dialog.removeAttribute("open");
    }

    if (initialOpener && typeof initialOpener.focus === "function") {
      initialOpener.focus();
    }
  }

  async function apply() {
    if (selectedTheme) {
      applyThemeTokens(selectedTheme);
      if (typeof onApply === "function") {
        await onApply(selectedTheme);
      }
      initialTheme = selectedTheme;
    }
    close(false);
  }

  function handleKeyDown(event) {
    if (!isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      navigateList(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      navigateList(-1);
      return;
    }

    if (event.key === "Enter") {
      if (event.target && event.target.classList?.contains("theme-option")) {
        event.preventDefault();
        apply();
      }
    }
  }

  dialog.addEventListener("keydown", handleKeyDown);

  if (closeButton) {
    closeButton.addEventListener("click", () => close(true));
  }
  if (cancelButton) {
    cancelButton.addEventListener("click", () => close(true));
  }
  if (applyButton) {
    applyButton.addEventListener("click", () => apply());
  }

  return {
    open,
    close,
    destroy() {
      dialog.removeEventListener("keydown", handleKeyDown);
    },
  };
}
