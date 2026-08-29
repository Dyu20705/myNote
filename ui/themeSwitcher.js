import { applyThemeTokens } from "../core/theme/themeEngine.js";
import { BUILTIN_THEMES } from "../core/theme/themeSchema.js";
import { listThemes } from "../core/theme/themeStorage.js";

export function createThemeSwitcher({ db, onThemeChange }) {
  const dialog = document.createElement("dialog");
  dialog.className = "theme-switcher-dialog";
  dialog.setAttribute("aria-label", "Theme Switcher");

  const select = document.createElement("select");
  select.setAttribute("data-testid", "theme-select");

  dialog.appendChild(select);
  document.body.appendChild(dialog);

  let allThemes = [];

  const populateThemes = async () => {
    select.innerHTML = "";
    const userThemes = await listThemes(db);
    allThemes = [...Object.values(BUILTIN_THEMES), ...userThemes];

    for (const theme of allThemes) {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      select.appendChild(option);
    }

    const activeThemeId = arguments[0].activeThemeId || "default-light";
    select.value = activeThemeId;
  };

  select.addEventListener("change", async (e) => {
    const themeId = e.target.value;
    const theme = allThemes.find(t => t.id === themeId);
    if (theme) {
      applyThemeTokens({ colors: theme.colors, typography: theme.typography, metrics: theme.metrics });
      if (onThemeChange) {
        const isCustom = !Object.keys(BUILTIN_THEMES).includes(themeId);
        await onThemeChange(themeId, isCustom);
      }
    }
  });

  return {
    show: async () => {
      await populateThemes();
      dialog.showModal();
    },
    hide: () => {
      dialog.close();
    }
  };
}
