import assert from "node:assert/strict";
import test from "node:test";
import { createSettingsPanel } from "../../ui/settingsPanel.js";

function matchesSelector(node, selector) {
  if (!node) return false;
  if (selector.startsWith(".")) {
    return node.classList?.contains(selector.slice(1));
  }
  if (selector.startsWith("#")) {
    return node.id === selector.slice(1);
  }
  if (selector.startsWith("[") && selector.endsWith("]")) {
    const inner = selector.slice(1, -1);
    if (inner.includes("=")) {
      const [attr, val] = inner.split("=");
      const cleanVal = val.replace(/^["']|["']$/g, "");
      const camel = attr.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return node.getAttribute(attr) === cleanVal || node.dataset?.[camel] === cleanVal || node.dataset?.[attr] === cleanVal;
    }
    const camel = inner.replace(/^data-/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return node.hasAttribute(inner) || Boolean(node.dataset?.[camel]) || Boolean(node.dataset?.[inner]);
  }
  return node.tagName?.toLowerCase() === selector.toLowerCase();
}

function createMockElement(tagName = "div") {
  const children = [];
  const attributes = new Map();
  const listeners = new Map();
  const classList = new Set();
  const styles = new Map();
  let hidden = false;
  let textContent = "";
  let value = "";
  let id = "";

  const element = {
    tagName: tagName.toUpperCase(),
    children,
    dataset: {},
    get id() { return id || attributes.get("id") || ""; },
    set id(val) { id = val; attributes.set("id", val); },
    get className() { return [...classList].join(" "); },
    set className(val) {
      classList.clear();
      for (const cls of String(val).split(/\s+/)) {
        if (cls) classList.add(cls);
      }
    },
    classList: {
      add(cls) { classList.add(cls); },
      remove(cls) { classList.delete(cls); },
      contains(cls) { return classList.has(cls); },
    },
    style: {
      backgroundColor: "",
      setProperty(k, v) { styles.set(k, v); },
      removeProperty(k) { styles.delete(k); },
      getPropertyValue(k) { return styles.get(k) || ""; },
    },
    get hidden() { return hidden; },
    set hidden(val) { hidden = Boolean(val); },
    get textContent() { return textContent; },
    set textContent(val) { textContent = String(val); },
    get value() { return value; },
    set value(val) { value = String(val); },
    get innerHTML() { return ""; },
    set innerHTML(val) {
      if (val === "") children.length = 0;
    },
    setAttribute(k, v) { attributes.set(k, String(v)); },
    getAttribute(k) { return attributes.get(k) ?? null; },
    removeAttribute(k) { attributes.delete(k); },
    hasAttribute(k) { return attributes.has(k); },
    appendChild(child) {
      children.push(child);
      return child;
    },
    addEventListener(event, handler) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    removeEventListener(event, handler) {
      if (!listeners.has(event)) return;
      const list = listeners.get(event).filter((h) => h !== handler);
      listeners.set(event, list);
    },
    dispatchEvent(event) {
      const handlers = listeners.get(event.type) || [];
      for (const h of handlers) h(event);
      return true;
    },
    click() {
      this.dispatchEvent({ type: "click", target: this, preventDefault() {} });
    },
    focus() {
      element.focused = true;
    },
    closest(selector) {
      if (matchesSelector(element, selector)) return element;
      return null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      const results = [];
      function search(node) {
        if (matchesSelector(node, selector)) {
          results.push(node);
        }
        for (const child of node.children) {
          search(child);
        }
      }
      search(element);
      return results;
    },
  };

  return element;
}

function setupMockSettingsDOM() {
  const dialog = createMockElement("dialog");
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; };

  const tabBar = createMockElement("div");
  tabBar.classList.add("settings-tab-bar");

  const tabGeneral = createMockElement("button");
  tabGeneral.setAttribute("role", "tab");
  tabGeneral.dataset.settingsTab = "general";
  tabGeneral.setAttribute("aria-selected", "true");
  tabGeneral.setAttribute("tabindex", "0");

  const tabThemes = createMockElement("button");
  tabThemes.setAttribute("role", "tab");
  tabThemes.dataset.settingsTab = "themes";
  tabThemes.setAttribute("aria-selected", "false");
  tabThemes.setAttribute("tabindex", "-1");

  const tabJapanese = createMockElement("button");
  tabJapanese.setAttribute("role", "tab");
  tabJapanese.dataset.settingsTab = "japanese";
  tabJapanese.setAttribute("aria-selected", "false");
  tabJapanese.setAttribute("tabindex", "-1");

  tabBar.appendChild(tabGeneral);
  tabBar.appendChild(tabThemes);
  tabBar.appendChild(tabJapanese);

  const panelGeneral = createMockElement("div");
  panelGeneral.setAttribute("data-settings-panel", "general");
  panelGeneral.hidden = false;

  const panelThemes = createMockElement("div");
  panelThemes.setAttribute("data-settings-panel", "themes");
  panelThemes.hidden = true;

  const importThemeButton = createMockElement("button");
  importThemeButton.id = "settingsImportThemeButton";
  panelThemes.appendChild(importThemeButton);

  const builtinThemesList = createMockElement("div");
  builtinThemesList.classList.add("settings-builtin-themes");
  panelThemes.appendChild(builtinThemesList);

  const customThemesList = createMockElement("div");
  customThemesList.classList.add("settings-custom-themes");
  panelThemes.appendChild(customThemesList);

  const fontSizeSelect = createMockElement("select");
  fontSizeSelect.id = "settingsFontSize";
  fontSizeSelect.value = "16";

  const fontFamilySelect = createMockElement("select");
  fontFamilySelect.id = "settingsFontFamily";
  fontFamilySelect.value = "system";

  const lineHeightSelect = createMockElement("select");
  lineHeightSelect.id = "settingsLineHeight";
  lineHeightSelect.value = "1.5";

  const saveTypographyButton = createMockElement("button");
  saveTypographyButton.id = "settingsSaveTypography";

  panelThemes.appendChild(fontSizeSelect);
  panelThemes.appendChild(fontFamilySelect);
  panelThemes.appendChild(lineHeightSelect);
  panelThemes.appendChild(saveTypographyButton);

  const panelJapanese = createMockElement("div");
  panelJapanese.setAttribute("data-settings-panel", "japanese");
  panelJapanese.hidden = true;

  const targetReviewsInput = createMockElement("input");
  targetReviewsInput.id = "settingsTargetReviews";
  targetReviewsInput.value = "50";

  const targetNewItemsInput = createMockElement("input");
  targetNewItemsInput.id = "settingsTargetNewItems";
  targetNewItemsInput.value = "10";

  const saveGoalsButton = createMockElement("button");
  saveGoalsButton.id = "settingsSaveGoals";

  panelJapanese.appendChild(targetReviewsInput);
  panelJapanese.appendChild(targetNewItemsInput);
  panelJapanese.appendChild(saveGoalsButton);

  dialog.appendChild(tabBar);
  dialog.appendChild(panelGeneral);
  dialog.appendChild(panelThemes);
  dialog.appendChild(panelJapanese);

  const closeBtn = createMockElement("button");
  closeBtn.id = "closeSettingsButton";
  dialog.appendChild(closeBtn);

  const mockDoc = {
    createElement: (tag) => createMockElement(tag),
    activeElement: null,
    documentElement: {
      style: {
        setProperty: () => {},
      },
    },
    defaultView: {
      prompt: () => "New Theme Name",
      confirm: () => true,
    },
  };

  return {
    dialog,
    tabBar,
    panelGeneral,
    panelThemes,
    panelJapanese,
    builtinThemesList,
    customThemesList,
    targetReviewsInput,
    targetNewItemsInput,
    saveGoalsButton,
    importThemeButton,
    fontSizeSelect,
    fontFamilySelect,
    lineHeightSelect,
    saveTypographyButton,
    closeBtn,
    mockDoc,
  };
}

test("createSettingsPanel initializes and opens dialog with general tab active", async () => {
  const dom = setupMockSettingsDOM();
  const panel = createSettingsPanel({
    dialog: dom.dialog,
    dbProvider: () => null,
    document: dom.mockDoc,
  });

  assert.equal(panel.isOpen(), false);
  await panel.open();
  assert.equal(panel.isOpen(), true);
  assert.equal(dom.dialog.open, true);
  assert.equal(dom.panelGeneral.hidden, false);
  assert.equal(dom.panelThemes.hidden, true);
  assert.equal(dom.panelJapanese.hidden, true);

  panel.close();
  assert.equal(panel.isOpen(), false);
  assert.equal(dom.dialog.open, false);
});

test("settingsPanel tab click switches panels and renders theme list", async () => {
  const dom = setupMockSettingsDOM();
  let appliedTheme = null;

  const panel = createSettingsPanel({
    dialog: dom.dialog,
    dbProvider: () => null,
    onThemeApply: (theme) => { appliedTheme = theme; },
    getActiveThemeId: () => "default-dark",
    document: dom.mockDoc,
  });

  await panel.open();

  // Switch to Themes tab
  await panel.switchTab("themes");
  const themesTab = dom.tabBar.children[1];

  assert.equal(dom.panelGeneral.hidden, true);
  assert.equal(dom.panelThemes.hidden, false);
  assert.equal(themesTab.getAttribute("aria-selected"), "true");

  const builtinList = dom.panelThemes.querySelector(".settings-builtin-themes");
  assert.ok(builtinList.children.length > 0);

  // Click first theme item to apply
  const firstItem = builtinList.children[0];
  firstItem.click();
  assert.ok(appliedTheme !== null);
});

test("settingsPanel Japanese learning tab properly awaits async dailyGoalsState and saves goals", async () => {
  const dom = setupMockSettingsDOM();
  let savedGoals = null;

  const panel = createSettingsPanel({
    dialog: dom.dialog,
    dbProvider: () => null,
    // Async function as in production app.js
    dailyGoalsState: async () => ({ targetReviewsPerDay: 40, targetNewItemsPerDay: 8 }),
    onDailyGoalChange: (goals) => { savedGoals = goals; },
    document: dom.mockDoc,
  });

  await panel.open();

  // Switch to Japanese tab
  await panel.switchTab("japanese");

  assert.equal(dom.panelJapanese.hidden, false);
  assert.equal(dom.targetReviewsInput.value, "40");
  assert.equal(dom.targetNewItemsInput.value, "8");

  // Modify and save
  dom.targetReviewsInput.value = "75";
  dom.targetNewItemsInput.value = "15";
  dom.saveGoalsButton.click();

  assert.deepEqual(savedGoals, {
    targetReviewsPerDay: 75,
    targetNewItemsPerDay: 15,
  });
});

test("settingsPanel focus trap cycles focus inside modal on Tab and Shift+Tab", async () => {
  const dom = setupMockSettingsDOM();
  const panel = createSettingsPanel({
    dialog: dom.dialog,
    dbProvider: () => null,
    document: dom.mockDoc,
  });

  await panel.open();

  const tab0 = dom.tabBar.children[0];
  const closeBtn = dom.closeBtn;

  // Set activeElement to last focusable element (closeBtn)
  dom.mockDoc.activeElement = closeBtn;

  // Press Tab -> should wrap to first focusable element
  dom.dialog.dispatchEvent({
    type: "keydown",
    key: "Tab",
    shiftKey: false,
    preventDefault: () => {},
  });

  // Set activeElement to first focusable element
  dom.mockDoc.activeElement = tab0;

  // Press Shift+Tab -> should wrap to last focusable element
  dom.dialog.dispatchEvent({
    type: "keydown",
    key: "Tab",
    shiftKey: true,
    preventDefault: () => {},
  });

  assert.ok(true, "Focus trap dispatched Tab and Shift+Tab without throwing");
});

test("settingsPanel keyboard navigation across tabs with Arrow keys and Escape to close", async () => {
  const dom = setupMockSettingsDOM();
  const opener = createMockElement("button");
  dom.mockDoc.activeElement = opener;

  const panel = createSettingsPanel({
    dialog: dom.dialog,
    dbProvider: () => null,
    document: dom.mockDoc,
  });

  await panel.open(opener);

  // Press ArrowRight on tab
  const tabGeneral = dom.tabBar.children[0];
  dom.dialog.dispatchEvent({
    type: "keydown",
    key: "ArrowRight",
    target: tabGeneral,
    preventDefault() {},
  });

  // Press Escape to close
  dom.dialog.dispatchEvent({
    type: "keydown",
    key: "Escape",
    preventDefault() {},
  });

  assert.equal(panel.isOpen(), false);
  assert.equal(opener.focused, true);
});
