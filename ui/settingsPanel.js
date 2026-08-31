/**
 * @fileoverview Settings Panel UI with tabbed interface.
 * Integrates theme selection, app preferences, and Japanese learning settings.
 * Reuses existing theme engine and storage — no duplicate persistence.
 */

import { BUILTIN_THEMES } from "../core/theme/themeSchema.js";
import { listThemes } from "../core/theme/themeStorage.js";
import { applyThemeTokens } from "../core/theme/themeEngine.js";

const TAB_IDS = ["general", "themes", "japanese"];

/**
 * Creates a Settings Panel controller.
 *
 * @param {object} options
 * @param {HTMLDialogElement} options.dialog
 * @param {function} options.dbProvider - Returns active IDBDatabase
 * @param {function} [options.onThemeApply] - Called when a theme is applied: (theme) => void
 * @param {function} [options.getActiveThemeId] - Returns current active theme ID
 * @param {object} [options.dailyGoalsState] - Current daily goals state getter
 * @param {function} [options.onDailyGoalChange] - Called with { targetReviewsPerDay, targetNewItemsPerDay }
 * @param {Document} [options.document] - Document reference
 * @returns {object} Controller with open, close, destroy methods
 */
export function createSettingsPanel({
  dialog,
  dbProvider,
  onThemeApply,
  getActiveThemeId,
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

  function switchTab(tabId) {
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
      renderThemesList();
    }
    if (tabId === "japanese") {
      renderJapaneseSettings();
    }
  }

  function renderThemesList() {
    const container = panels.themes?.querySelector(".settings-theme-list");
    if (!container) return;
    container.innerHTML = "";

    const currentId = getActiveThemeId ? getActiveThemeId() : null;

    for (const theme of themesList) {
      const item = doc.createElement("button");
      item.type = "button";
      item.className = "settings-theme-item";
      item.setAttribute("data-theme-id", theme.id);
      if (theme.id === currentId) {
        item.setAttribute("aria-current", "true");
        item.classList.add("settings-theme-active");
      }

      const name = doc.createElement("span");
      name.className = "settings-theme-name";
      name.textContent = theme.name;

      const meta = doc.createElement("span");
      meta.className = "settings-theme-meta";
      const isBuiltin = Boolean(BUILTIN_THEMES[theme.id]);
      meta.textContent = `${theme.isDark ? "Dark" : "Light"} · ${isBuiltin ? "Built-in" : "Custom"}`;

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

      item.appendChild(name);
      item.appendChild(meta);
      item.appendChild(swatches);

      item.addEventListener("click", () => {
        applyThemeTokens(theme);
        if (typeof onThemeApply === "function") {
          onThemeApply(theme);
        }
        renderThemesList();
      });

      container.appendChild(item);
    }
  }

  function renderJapaneseSettings() {
    const reviewsInput = panels.japanese?.querySelector("#settingsTargetReviews");
    const newItemsInput = panels.japanese?.querySelector("#settingsTargetNewItems");
    if (!reviewsInput || !newItemsInput) return;

    const state = typeof dailyGoalsState === "function" ? dailyGoalsState() : dailyGoalsState;
    if (state) {
      reviewsInput.value = state.targetReviewsPerDay ?? 50;
      newItemsInput.value = state.targetNewItemsPerDay ?? 10;
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

    const db = typeof dbProvider === "function" ? await dbProvider() : dbProvider;
    try {
      themesList = db ? await listThemes(db) : Object.values(BUILTIN_THEMES);
    } catch {
      themesList = Object.values(BUILTIN_THEMES);
    }

    switchTab("general");

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

    if (event.target?.getAttribute("role") === "tab") {
      const currentIndex = TAB_IDS.indexOf(activeTab);
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        const next = TAB_IDS[(currentIndex + 1) % TAB_IDS.length];
        switchTab(next);
        tabBar?.querySelector(`[data-settings-tab="${next}"]`)?.focus();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        const prev = TAB_IDS[(currentIndex - 1 + TAB_IDS.length) % TAB_IDS.length];
        switchTab(prev);
        tabBar?.querySelector(`[data-settings-tab="${prev}"]`)?.focus();
      }
      if (event.key === "Home") {
        event.preventDefault();
        switchTab(TAB_IDS[0]);
        tabBar?.querySelector(`[data-settings-tab="${TAB_IDS[0]}"]`)?.focus();
      }
      if (event.key === "End") {
        event.preventDefault();
        switchTab(TAB_IDS[TAB_IDS.length - 1]);
        tabBar?.querySelector(`[data-settings-tab="${TAB_IDS[TAB_IDS.length - 1]}"]`)?.focus();
      }
    }
  }

  function handleTabClick(event) {
    const tab = event.target.closest("[data-settings-tab]");
    if (tab) {
      switchTab(tab.dataset.settingsTab);
    }
  }

  function handleSaveGoals() {
    handleJapaneseSettingsSave();
  }

  dialog.addEventListener("keydown", handleKeyDown);
  tabBar?.addEventListener("click", handleTabClick);

  const closeBtn = dialog.querySelector("#closeSettingsButton");
  if (closeBtn) closeBtn.addEventListener("click", close);

  const saveGoalsBtn = dialog.querySelector("#settingsSaveGoals");
  if (saveGoalsBtn) saveGoalsBtn.addEventListener("click", handleSaveGoals);

  return {
    open,
    close,
    isOpen() { return isOpen; },
    destroy() {
      dialog.removeEventListener("keydown", handleKeyDown);
      tabBar?.removeEventListener("click", handleTabClick);
    },
  };
}
