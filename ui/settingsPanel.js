/**
 * @fileoverview Settings Panel UI with tabbed interface.
 * Integrates theme selection, custom theme CRUD, typography preferences, and Japanese learning settings.
 * Reuses existing theme engine and storage — no duplicate persistence.
 */

import { BUILTIN_THEMES } from "../core/theme/themeSchema.js";
import {
  listThemes,
  deleteTheme,
  renameTheme,
  exportThemeToJson,
} from "../core/theme/themeStorage.js";
import { applyThemeTokens } from "../core/theme/themeEngine.js";
import { getSettings, putSettings } from "../core/storage.js";

const TAB_IDS = ["general", "themes", "japanese"];

/**
 * Resolves font family token to system font stack.
 *
 * @param {string} fontFamily
 * @returns {string} CSS font family string
 */
export function resolveFontFamily(fontFamily) {
  if (fontFamily === "sans-serif") return "sans-serif";
  if (fontFamily === "serif") return "Georgia, Cambria, 'Times New Roman', serif";
  if (fontFamily === "mono" || fontFamily === "monospace") {
    return "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
  }
  return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
}

/**
 * Creates a Settings Panel controller.
 *
 * @param {object} options
 * @param {HTMLDialogElement} options.dialog
 * @param {function} options.dbProvider - Returns active IDBDatabase
 * @param {function} [options.onThemeApply] - Called when a theme is applied: (theme) => void
 * @param {function} [options.getActiveThemeId] - Returns current active theme ID
 * @param {function} [options.onImportTheme] - Trigger file import
 * @param {function|object} [options.dailyGoalsState] - Current daily goals state getter
 * @param {function} [options.onDailyGoalChange] - Called with { targetReviewsPerDay, targetNewItemsPerDay }
 * @param {Document} [options.document] - Document reference
 * @returns {object} Controller with open, close, isOpen, switchTab, destroy methods
 */
export function createSettingsPanel({
  dialog,
  dbProvider,
  onThemeApply,
  getActiveThemeId,
  onImportTheme,
  dailyGoalsState,
  onDailyGoalChange,
  document: doc = globalThis.document,
}) {
  let isOpen = false;
  let opener = null;
  let activeTab = "general";
  let themesList = [];

  const tabBar = dialog.querySelector(".settings-tab-bar");
  const panels = {};
  for (const id of TAB_IDS) {
    panels[id] = dialog.querySelector(`[data-settings-panel="${id}"]`);
  }

  async function getDb() {
    return typeof dbProvider === "function" ? await dbProvider() : dbProvider;
  }

  async function loadThemesList() {
    const db = await getDb();
    try {
      themesList = db ? await listThemes(db) : Object.values(BUILTIN_THEMES);
    } catch {
      themesList = Object.values(BUILTIN_THEMES);
    }
  }

  async function switchTab(tabId) {
    if (!TAB_IDS.includes(tabId)) return;
    activeTab = tabId;

    const buttons = tabBar?.querySelectorAll("[role=tab]");
    if (buttons) {
      for (const btn of buttons) {
        const selected = btn.dataset.settingsTab === tabId;
        btn.setAttribute("aria-selected", String(selected));
        btn.setAttribute("tabindex", selected ? "0" : "-1");
      }
    }

    for (const [id, panel] of Object.entries(panels)) {
      if (panel) {
        panel.hidden = id !== tabId;
      }
    }

    if (tabId === "themes") {
      await renderThemesTab();
    } else if (tabId === "japanese") {
      await renderJapaneseSettings();
    } else if (tabId === "general") {
      await renderGeneralSettings();
    }
  }

  function appendSwatches(parent, theme) {
    const swatches = doc.createElement("span");
    swatches.className = "settings-theme-swatches";
    swatches.setAttribute("aria-hidden", "true");
    for (const color of [theme.colors?.background, theme.colors?.primary, theme.colors?.accent]) {
      if (color) {
        const swatch = doc.createElement("span");
        swatch.className = "settings-swatch";
        swatch.style.backgroundColor = color;
        swatches.appendChild(swatch);
      }
    }
    parent.appendChild(swatches);
  }

  async function renderThemesTab() {
    await loadThemesList();
    const currentId = getActiveThemeId ? getActiveThemeId() : null;

    // Render Built-in Themes
    const builtinContainer = panels.themes?.querySelector(".settings-builtin-themes");
    if (builtinContainer) {
      builtinContainer.innerHTML = "";
      const builtinThemes = themesList.filter((t) => Boolean(BUILTIN_THEMES[t.id]));

      for (const theme of builtinThemes) {
        const item = doc.createElement("button");
        item.type = "button";
        item.className = "settings-theme-item";
        item.setAttribute("data-theme-id", theme.id);
        const isActive = theme.id === currentId;
        if (isActive) {
          item.setAttribute("aria-current", "true");
          item.classList.add("settings-theme-active");
        }

        const name = doc.createElement("span");
        name.className = "settings-theme-name";
        name.textContent = theme.name;

        const meta = doc.createElement("span");
        meta.className = "settings-theme-meta";
        meta.textContent = `${theme.isDark ? "Dark" : "Light"} · Built-in`;

        appendSwatches(item, theme);
        item.appendChild(name);
        item.appendChild(meta);

        if (isActive) {
          const badge = doc.createElement("span");
          badge.className = "settings-badge-active";
          badge.textContent = "Active";
          item.appendChild(badge);
        }

        item.addEventListener("click", () => {
          applyThemeTokens(theme);
          if (typeof onThemeApply === "function") {
            onThemeApply(theme);
          }
          void renderThemesTab();
        });

        builtinContainer.appendChild(item);
      }
    }

    // Render Custom Themes
    const customContainer = panels.themes?.querySelector(".settings-custom-themes");
    if (customContainer) {
      customContainer.innerHTML = "";
      const customThemes = themesList.filter((t) => !BUILTIN_THEMES[t.id]);

      if (customThemes.length === 0) {
        const emptyMsg = doc.createElement("p");
        emptyMsg.className = "settings-empty-notice";
        emptyMsg.textContent = "No custom themes imported yet. Use 'Import theme' above to add one.";
        customContainer.appendChild(emptyMsg);
      } else {
        for (const theme of customThemes) {
          const row = doc.createElement("div");
          row.className = "settings-custom-theme-row";
          row.setAttribute("data-theme-id", theme.id);

          const isActive = theme.id === currentId;
          if (isActive) {
            row.classList.add("settings-theme-active");
          }

          const info = doc.createElement("div");
          info.className = "settings-custom-theme-info";

          const name = doc.createElement("span");
          name.className = "settings-theme-name";
          name.textContent = theme.name;

          const meta = doc.createElement("span");
          meta.className = "settings-theme-meta";
          meta.textContent = `${theme.isDark ? "Dark" : "Light"} · Custom`;

          appendSwatches(info, theme);
          info.appendChild(name);
          info.appendChild(meta);

          if (isActive) {
            const badge = doc.createElement("span");
            badge.className = "settings-badge-active";
            badge.textContent = "Active";
            info.appendChild(badge);
          }

          const actions = doc.createElement("div");
          actions.className = "settings-custom-theme-actions";

          // Apply button
          const applyBtn = doc.createElement("button");
          applyBtn.type = "button";
          applyBtn.className = "settings-btn-apply secondary-button";
          applyBtn.textContent = isActive ? "Applied" : "Apply";
          applyBtn.disabled = isActive;
          applyBtn.addEventListener("click", () => {
            applyThemeTokens(theme);
            if (typeof onThemeApply === "function") {
              onThemeApply(theme);
            }
            void renderThemesTab();
          });

          // Rename button
          const renameBtn = doc.createElement("button");
          renameBtn.type = "button";
          renameBtn.className = "settings-btn-rename secondary-button";
          renameBtn.textContent = "Rename";
          renameBtn.addEventListener("click", async () => {
            const newName = doc.defaultView?.prompt?.("Enter new theme name:", theme.name);
            if (newName && newName.trim() && newName.trim() !== theme.name) {
              const db = await getDb();
              if (db) {
                await renameTheme(db, theme.id, newName.trim());
                await renderThemesTab();
              }
            }
          });

          // Export button
          const exportBtn = doc.createElement("button");
          exportBtn.type = "button";
          exportBtn.className = "settings-btn-export secondary-button";
          exportBtn.textContent = "Export";
          exportBtn.addEventListener("click", () => {
            const json = exportThemeToJson(theme);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = doc.createElement("a");
            a.href = url;
            a.download = `theme-${theme.id}.json`;
            doc.body?.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
          });

          // Delete button
          const deleteBtn = doc.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.className = "settings-btn-delete destructive-button";
          deleteBtn.textContent = "Delete";
          deleteBtn.addEventListener("click", async () => {
            const confirmed = doc.defaultView?.confirm?.(`Delete custom theme '${theme.name}'?`) ?? true;
            if (confirmed) {
              const db = await getDb();
              if (db) {
                await deleteTheme(db, theme.id);
                if (theme.id === currentId) {
                  const defaultTheme = BUILTIN_THEMES["default-dark"];
                  applyThemeTokens(defaultTheme);
                  if (typeof onThemeApply === "function") {
                    onThemeApply(defaultTheme);
                  }
                }
                await renderThemesTab();
              }
            }
          });

          actions.appendChild(applyBtn);
          actions.appendChild(renameBtn);
          actions.appendChild(exportBtn);
          actions.appendChild(deleteBtn);

          row.appendChild(info);
          row.appendChild(actions);
          customContainer.appendChild(row);
        }
      }
    }

    // Initialize Typography controls in Themes panel
    await renderTypographySettings();
  }

  async function renderTypographySettings() {
    const db = await getDb();
    const fontSizeSelect = panels.themes?.querySelector("#settingsFontSize");
    const fontFamilySelect = panels.themes?.querySelector("#settingsFontFamily");
    const lineHeightSelect = panels.themes?.querySelector("#settingsLineHeight");

    if (!fontSizeSelect && !fontFamilySelect && !lineHeightSelect) return;

    let typography = { fontSize: "16", fontFamily: "system", lineHeight: "1.5" };
    try {
      if (db) {
        const appSettings = await getSettings(db, "app");
        if (appSettings?.typography) {
          typography = { ...typography, ...appSettings.typography };
        }
      }
    } catch {
      // Use defaults
    }

    if (fontSizeSelect) fontSizeSelect.value = String(typography.fontSize || "16");
    if (fontFamilySelect) fontFamilySelect.value = String(typography.fontFamily || "system");
    if (lineHeightSelect) lineHeightSelect.value = String(typography.lineHeight || "1.5");
  }

  async function handleTypographySave() {
    const fontSizeSelect = panels.themes?.querySelector("#settingsFontSize");
    const fontFamilySelect = panels.themes?.querySelector("#settingsFontFamily");
    const lineHeightSelect = panels.themes?.querySelector("#settingsLineHeight");

    const fontSize = fontSizeSelect?.value || "16";
    const fontFamily = fontFamilySelect?.value || "system";
    const lineHeight = lineHeightSelect?.value || "1.5";

    const typography = { fontSize, fontFamily, lineHeight };
    const resolvedFont = resolveFontFamily(fontFamily);

    // Apply to root element
    if (doc.documentElement?.style) {
      doc.documentElement.style.setProperty("--theme-font-size-base", `${fontSize}px`);
      doc.documentElement.style.setProperty("--theme-line-height", lineHeight);
      doc.documentElement.style.setProperty("--theme-font-primary", resolvedFont);
      doc.documentElement.style.setProperty("--mn-font-ui", resolvedFont);
    }

    const db = await getDb();
    if (db) {
      const appSettings = (await getSettings(db, "app")) || {};
      await putSettings(db, "app", { ...appSettings, typography });
    }
  }

  async function renderGeneralSettings() {
    // General section renders static info
  }

  async function renderJapaneseSettings() {
    const reviewsInput = panels.japanese?.querySelector("#settingsTargetReviews");
    const newItemsInput = panels.japanese?.querySelector("#settingsTargetNewItems");
    if (!reviewsInput || !newItemsInput) return;

    try {
      const state = typeof dailyGoalsState === "function" ? await dailyGoalsState() : dailyGoalsState;
      if (state) {
        reviewsInput.value = state.targetReviewsPerDay ?? 50;
        newItemsInput.value = state.targetNewItemsPerDay ?? 10;
      }
    } catch {
      reviewsInput.value = 50;
      newItemsInput.value = 10;
    }
  }

  function handleJapaneseSettingsSave() {
    const reviewsInput = panels.japanese?.querySelector("#settingsTargetReviews");
    const newItemsInput = panels.japanese?.querySelector("#settingsTargetNewItems");
    if (!reviewsInput || !newItemsInput) return;

    const targetReviewsPerDay = Math.max(1, Math.min(1000, parseInt(reviewsInput.value, 10) || 50));
    const targetNewItemsPerDay = Math.max(0, Math.min(1000, parseInt(newItemsInput.value, 10) || 10));

    if (typeof onDailyGoalChange === "function") {
      onDailyGoalChange({ targetReviewsPerDay, targetNewItemsPerDay });
    }
  }

  async function open(triggerOpener = null) {
    opener = triggerOpener || doc?.activeElement;
    isOpen = true;

    await loadThemesList();
    await switchTab("general");

    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
    }

    const firstTab = tabBar?.querySelector("[role=tab]");
    if (firstTab) firstTab.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
    }

    if (opener && typeof opener.focus === "function") {
      opener.focus();
    }
  }

  function handleKeyDown(event) {
    if (!isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    // Focus Trap: Trap Tab and Shift+Tab within open dialog
    if (event.key === "Tab") {
      const focusableSelectors = [
        'button:not([disabled]):not([tabindex="-1"])',
        '[href]:not([tabindex="-1"])',
        'input:not([disabled]):not([tabindex="-1"])',
        'select:not([disabled]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([tabindex="-1"])',
        '[tabindex="0"]',
      ].join(", ");

      const focusable = Array.from(dialog.querySelectorAll(focusableSelectors))
        .filter((el) => !el.closest("[hidden]") && el.offsetParent !== null);

      if (focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (doc.activeElement === first || !dialog.contains(doc.activeElement)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (doc.activeElement === last || !dialog.contains(doc.activeElement)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      return;
    }

    if (event.target?.getAttribute("role") === "tab") {
      const currentIndex = TAB_IDS.indexOf(activeTab);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = TAB_IDS[(currentIndex + 1) % TAB_IDS.length];
        void switchTab(next);
        tabBar?.querySelector(`[data-settings-tab="${next}"]`)?.focus();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = TAB_IDS[(currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length];
        void switchTab(prev);
        tabBar?.querySelector(`[data-settings-tab="${prev}"]`)?.focus();
      }
      if (event.key === "Home") {
        event.preventDefault();
        void switchTab(TAB_IDS[0]);
        tabBar?.querySelector(`[data-settings-tab="${TAB_IDS[0]}"]`)?.focus();
      }
      if (event.key === "End") {
        event.preventDefault();
        void switchTab(TAB_IDS[TAB_IDS.length - 1]);
        tabBar?.querySelector(`[data-settings-tab="${TAB_IDS[TAB_IDS.length - 1]}"]`)?.focus();
      }
    }
  }

  function handleTabClick(event) {
    const tab = event.target.closest("[data-settings-tab]");
    if (tab) {
      void switchTab(tab.dataset.settingsTab);
    }
  }

  function handleSaveGoals() {
    handleJapaneseSettingsSave();
  }

  function handleImportClick() {
    if (typeof onImportTheme === "function") {
      onImportTheme();
    }
  }

  dialog.addEventListener("keydown", handleKeyDown);
  tabBar?.addEventListener("click", handleTabClick);

  const closeBtn = dialog.querySelector("#closeSettingsButton");
  if (closeBtn) closeBtn.addEventListener("click", close);

  const saveGoalsBtn = dialog.querySelector("#settingsSaveGoals");
  if (saveGoalsBtn) saveGoalsBtn.addEventListener("click", handleSaveGoals);

  const importThemeBtn = dialog.querySelector("#settingsImportThemeButton");
  if (importThemeBtn) importThemeBtn.addEventListener("click", handleImportClick);

  const saveTypographyBtn = dialog.querySelector("#settingsSaveTypography");
  if (saveTypographyBtn) saveTypographyBtn.addEventListener("click", handleTypographySave);

  return {
    open,
    close,
    isOpen() { return isOpen; },
    switchTab,
    renderThemesTab,
    destroy() {
      dialog.removeEventListener("keydown", handleKeyDown);
      tabBar?.removeEventListener("click", handleTabClick);
    },
  };
}
