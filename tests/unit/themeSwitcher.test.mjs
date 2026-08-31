import assert from "node:assert/strict";
import test from "node:test";
import { BUILTIN_THEMES } from "../../core/theme/themeSchema.js";
import { createThemeSwitcher } from "../../ui/themeSwitcher.js";

function createMockElement(tagName = "div") {
  const children = [];
  const attributes = new Map();
  const listeners = new Map();
  const classList = new Set();
  const styles = new Map();

  return {
    tagName: tagName.toUpperCase(),
    children,
    classList: {
      add(cls) {
        classList.add(cls);
      },
      remove(cls) {
        classList.delete(cls);
      },
      contains(cls) {
        return classList.has(cls);
      },
    },
    style: {
      setProperty(k, v) {
        styles.set(k, v);
      },
      removeProperty(k) {
        styles.delete(k);
      },
      getPropertyValue(k) {
        return styles.get(k) || "";
      },
    },
    setAttribute(k, v) {
      attributes.set(k, String(v));
    },
    getAttribute(k) {
      return attributes.get(k) ?? null;
    },
    removeAttribute(k) {
      attributes.delete(k);
    },
    hasAttribute(k) {
      return attributes.has(k);
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
    },
    appendChild(child) {
      children.push(child);
      child.parentElement = this;
    },
    querySelector(selector) {
      if (selector.startsWith("[data-theme-id=")) {
        const id = selector.slice(16, -2);
        return children.find((c) => c.getAttribute("data-theme-id") === id) || null;
      }
      return null;
    },
    querySelectorAll() {
      return children;
    },
    focus() {
      this._focused = true;
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
    open: false,
    _listeners: listeners,
  };
}

function createMockDocument() {
  const root = createMockElement("html");
  return {
    documentElement: root,
    activeElement: null,
    createElement(tag) {
      return createMockElement(tag);
    },
  };
}

test("createThemeSwitcher — opens dialog, renders themes, and handles apply", async () => {
  const dialog = createMockElement("dialog");
  const listElement = createMockElement("div");
  const closeButton = createMockElement("button");
  const cancelButton = createMockElement("button");
  const applyButton = createMockElement("button");

  let appliedTheme = null;
  const switcher = createThemeSwitcher({
    dialog,
    listElement,
    closeButton,
    cancelButton,
    applyButton,
    dbProvider: null,
    document: createMockDocument(),
    onApply: (theme) => {
      appliedTheme = theme;
    },
  });

  await switcher.open();
  assert.equal(dialog.open, true);
  assert.ok(listElement.children.length >= Object.keys(BUILTIN_THEMES).length);

  // Apply button clicks
  const applyHandler = applyButton._listeners.get("click")?.[0];
  assert.ok(applyHandler);
  await applyHandler();

  assert.equal(dialog.open, false);
  assert.ok(appliedTheme);
  assert.equal(appliedTheme.id, "default-dark");

  switcher.destroy();
});

test("createThemeSwitcher — cancels and reverts theme on Escape keydown", async () => {
  const dialog = createMockElement("dialog");
  const listElement = createMockElement("div");

  const switcher = createThemeSwitcher({
    dialog,
    listElement,
    dbProvider: null,
    document: createMockDocument(),
  });

  await switcher.open();
  assert.equal(dialog.open, true);

  // Dispatch Escape keydown
  const keyHandler = dialog._listeners.get("keydown")?.[0];
  assert.ok(keyHandler);
  let prevented = false;
  keyHandler({
    key: "Escape",
    preventDefault: () => {
      prevented = true;
    },
  });

  assert.equal(prevented, true);
  assert.equal(dialog.open, false);

  switcher.destroy();
});

