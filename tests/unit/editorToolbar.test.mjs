import test from "node:test";
import assert from "node:assert/strict";
import { createEditorToolbar } from "../../ui/editorToolbar.js";

function createMockElement(tagName = "div", attributes = {}) {
  const children = [];
  const listeners = {};
  const attrs = { ...attributes };
  let hidden = Boolean(attrs.hidden);

  return {
    tagName: tagName.toUpperCase(),
    dataset: {},
    children,
    get hidden() {
      return hidden;
    },
    set hidden(val) {
      hidden = Boolean(val);
    },
    getAttribute(name) {
      return attrs[name] ?? null;
    },
    setAttribute(name, val) {
      attrs[name] = String(val);
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    append(...nodes) {
      children.push(...nodes);
    },
    replaceChildren(...nodes) {
      children.length = 0;
      children.push(...nodes);
    },
    querySelectorAll(selector) {
      if (selector === "button" || selector === ".editor-toolbar-button") {
        return children.filter((child) => child.tagName === "BUTTON");
      }
      return [];
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((item) => item !== fn);
      }
    },
    dispatchEvent(event) {
      if (listeners[event.type]) {
        for (const fn of listeners[event.type]) {
          fn(event);
        }
      }
    },
    focus() {},
  };
}

test("Editor Toolbar — Creation & Validation", async (t) => {
  await t.test("throws when options are missing or invalid", () => {
    assert.throws(() => createEditorToolbar(), /EDITOR_TOOLBAR_OPTIONS_INVALID/);
    assert.throws(() => createEditorToolbar({}), /EDITOR_TOOLBAR_OPTIONS_INVALID/);
    assert.throws(
      () =>
        createEditorToolbar({
          container: createMockElement(),
        }),
      /EDITOR_TOOLBAR_OPTIONS_INVALID/
    );
  });

  await t.test("renders action buttons in container", () => {
    const container = createMockElement("div", { hidden: true });
    const textarea = createMockElement("textarea");
    const actionsCalled = [];
    const toolbar = createEditorToolbar({
      container,
      textarea,
      onAction: (id) => actionsCalled.push(id),
      document: {
        createElement: (tag) => createMockElement(tag),
      },
    });

    const buttons = container.querySelectorAll("button");
    assert.ok(buttons.length >= 7, `Expected at least 7 buttons, got ${buttons.length}`);

    // Check button attributes
    const boldButton = buttons.find((btn) => btn.dataset.action === "bold");
    assert.ok(boldButton, "Bold button must exist");
    assert.equal(boldButton.getAttribute("aria-label"), "Bold");

    // Click bold button
    boldButton.dispatchEvent({ type: "click", preventDefault() {} });
    assert.deepEqual(actionsCalled, ["bold"]);

    toolbar.destroy();
  });

  await t.test("show and hide control visibility", () => {
    const container = createMockElement("div", { hidden: true });
    const textarea = createMockElement("textarea");
    const toolbar = createEditorToolbar({
      container,
      textarea,
      onAction: () => {},
      document: {
        createElement: (tag) => createMockElement(tag),
      },
    });

    assert.equal(toolbar.isVisible(), false);
    toolbar.show();
    assert.equal(toolbar.isVisible(), true);
    assert.equal(container.hidden, false);

    toolbar.hide();
    assert.equal(toolbar.isVisible(), false);
    assert.equal(container.hidden, true);

    toolbar.destroy();
  });
});
