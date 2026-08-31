import assert from "node:assert/strict";
import test from "node:test";
import { createOnboardingTour, TOUR_STEPS } from "../../ui/onboardingTour.js";

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
      return node.getAttribute(attr) === cleanVal || node.dataset?.[attr] === cleanVal;
    }
    return node.hasAttribute(inner);
  }
  return node.tagName?.toLowerCase() === selector.toLowerCase();
}

function createMockElement(tagName = "div") {
  const children = [];
  const attributes = new Map();
  const listeners = new Map();
  const classList = new Set();
  let hidden = false;
  let textContent = "";
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
      position: "",
      zIndex: "",
      top: "",
      left: "",
      bottom: "",
    },
    offsetParent: {}, // simulate visible element
    getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 50, right: 200, width: 150, height: 40 }),
    get hidden() { return hidden; },
    set hidden(val) { hidden = Boolean(val); },
    get textContent() { return textContent; },
    set textContent(val) { textContent = String(val); },
    setAttribute(k, v) { attributes.set(k, String(v)); },
    getAttribute(k) { return attributes.get(k) ?? null; },
    removeAttribute(k) { attributes.delete(k); },
    hasAttribute(k) { return attributes.has(k); },
    appendChild(child) {
      children.push(child);
      return child;
    },
    remove() {
      // no-op mock
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

test("onboardingTour steps are defined with required properties", () => {
  assert.ok(TOUR_STEPS.length >= 4);
  for (const step of TOUR_STEPS) {
    assert.ok(step.target);
    assert.ok(step.title);
    assert.ok(step.content);
  }
});

test("createOnboardingTour starts when not completed", async () => {
  const container = createMockElement("div");
  container.hidden = true;

  const mockTarget = createMockElement("button");

  const mockDoc = {
    createElement: (tag) => createMockElement(tag),
    querySelector: () => mockTarget,
    defaultView: {
      innerWidth: 1024,
      innerHeight: 768,
      matchMedia: () => ({ matches: false }),
    },
  };

  const tour = createOnboardingTour({
    container,
    dbProvider: () => null,
    document: mockDoc,
  });

  assert.equal(tour.isActive(), false);
  const started = await tour.start();
  assert.equal(started, true);
  assert.equal(tour.isActive(), true);
  assert.equal(container.hidden, false);

  tour.dismiss();
  assert.equal(tour.isActive(), false);
});

test("onboardingTour step progression works and advances on next click", async () => {
  const container = createMockElement("div");
  const mockTarget = createMockElement("button");

  const mockDoc = {
    createElement: (tag) => createMockElement(tag),
    querySelector: () => mockTarget,
    defaultView: {
      innerWidth: 1024,
      innerHeight: 768,
      matchMedia: () => ({ matches: false }),
    },
  };

  const tour = createOnboardingTour({
    container,
    dbProvider: () => null,
    document: mockDoc,
  });

  await tour.start();
  assert.equal(tour.isActive(), true);

  const nextBtn = container.querySelector(".onboarding-next");
  assert.ok(nextBtn);
  assert.equal(nextBtn.textContent, "Next");

  // Advance step
  nextBtn.click();
  assert.equal(tour.isActive(), true);

  // Skip tour
  const skipBtn = container.querySelector(".onboarding-skip");
  assert.ok(skipBtn);
  skipBtn.click();
  assert.equal(tour.isActive(), false);
  assert.equal(tour.isComplete(), true);
});
