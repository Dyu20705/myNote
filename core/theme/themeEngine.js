export function applyThemeTokens(tokens) {
  const root = document.documentElement;
  for (const [category, values] of Object.entries(tokens)) {
    for (const [key, value] of Object.entries(values)) {
      root.style.setProperty(`--theme-${category}-${key}`, value);
    }
  }
}
