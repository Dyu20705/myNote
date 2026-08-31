/**
 * @fileoverview Lightweight onboarding tour with step-based tooltips.
 * Points to real UI landmarks. Completion persisted in IndexedDB.
 * No startup race — called explicitly after bootstrap.
 */

import { getSettings, putSettings } from "../core/storage.js";

const TOUR_STEPS = Object.freeze([
  {
    target: "#workspaceNavigation",
    title: "Workspace navigation",
    content: "Switch between Notes, Archive, and Japanese workspaces to organize your study.",
    position: "bottom",
  },
  {
    target: "#searchInput",
    title: "Quick search",
    content: "Search across all your notes instantly. Press / to focus search from anywhere.",
    position: "bottom",
  },
  {
    target: "#commandPalette",
    title: "Command palette",
    content: "Press Ctrl+K (or Cmd+K) to access every command: create notes, switch themes, start reviews, and more.",
    position: "bottom",
    fallbackTarget: "body",
  },
  {
    target: "#japaneseWorkspaceButton",
    title: "Japanese workspace",
    content: "Study Japanese with SRS flashcards, kanji drawing, gamification, and Quick Study sessions.",
    position: "bottom",
  },
  {
    target: "#newNoteButton",
    title: "Start creating",
    content: "Create your first note and explore themes, formatting tools, and the command palette. Welcome to myNote!",
    position: "bottom",
  },
]);

/**
 * Creates an onboarding tour controller.
 *
 * @param {object} options
 * @param {HTMLElement} options.container - Container element for tour tooltip
 * @param {function} options.dbProvider - Returns active IDBDatabase
 * @param {Document} [options.document] - Document reference
 * @returns {object} Controller with start, dismiss, isComplete, destroy methods
 */
export function createOnboardingTour({
  container,
  dbProvider,
  document: doc = globalThis.document,
}) {
  let currentStep = 0;
  let isActive = false;
  let tooltipEl = null;
  let overlayEl = null;
  let completed = false;

  const prefersReducedMotion = () =>
    doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false;

  async function getDb() {
    return typeof dbProvider === "function" ? await dbProvider() : dbProvider;
  }

  async function checkComplete() {
    try {
      const db = await getDb();
      if (!db) return false;
      const settings = await getSettings(db, "app");
      return settings?.onboardingComplete === true;
    } catch {
      return false;
    }
  }

  async function markComplete() {
    completed = true;
    try {
      const db = await getDb();
      if (!db) return;
      const settings = (await getSettings(db, "app")) || {};
      await putSettings(db, "app", { ...settings, onboardingComplete: true });
    } catch {
      // Persistence failure is non-critical — tour just won't be suppressed next time
    }
  }

  function getTargetElement(step) {
    const el = doc.querySelector(step.target);
    if (el && el.offsetParent !== null) return el;
    if (step.fallbackTarget) return doc.querySelector(step.fallbackTarget);
    return null;
  }

  function findNextValidStep(from) {
    for (let i = from; i < TOUR_STEPS.length; i++) {
      if (getTargetElement(TOUR_STEPS[i])) return i;
    }
    return -1;
  }

  function findPrevValidStep(from) {
    for (let i = from; i >= 0; i--) {
      if (getTargetElement(TOUR_STEPS[i])) return i;
    }
    return -1;
  }

  function createOverlay() {
    overlayEl = doc.createElement("div");
    overlayEl.className = "onboarding-overlay";
    overlayEl.setAttribute("aria-hidden", "true");
    container.appendChild(overlayEl);
    overlayEl.addEventListener("click", dismiss);
  }

  function positionTooltip(targetEl) {
    if (!tooltipEl || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const step = TOUR_STEPS[currentStep];
    const pos = step?.position || "bottom";

    tooltipEl.style.position = "fixed";
    tooltipEl.style.zIndex = "10001";

    if (pos === "bottom") {
      tooltipEl.style.top = `${rect.bottom + 12}px`;
      tooltipEl.style.left = `${Math.max(8, Math.min(rect.left, doc.defaultView.innerWidth - 340))}px`;
    } else if (pos === "top") {
      tooltipEl.style.bottom = `${doc.defaultView.innerHeight - rect.top + 12}px`;
      tooltipEl.style.left = `${Math.max(8, Math.min(rect.left, doc.defaultView.innerWidth - 340))}px`;
    }
  }

  function renderStep() {
    if (!isActive) return;

    const validIndex = findNextValidStep(currentStep);
    if (validIndex < 0) {
      finish();
      return;
    }
    currentStep = validIndex;

    const step = TOUR_STEPS[currentStep];
    const targetEl = getTargetElement(step);
    if (!targetEl) {
      finish();
      return;
    }

    if (tooltipEl) tooltipEl.remove();

    tooltipEl = doc.createElement("div");
    tooltipEl.className = "onboarding-tooltip";
    tooltipEl.setAttribute("role", "dialog");
    tooltipEl.setAttribute("aria-label", `Tour step ${currentStep + 1} of ${TOUR_STEPS.length}: ${step.title}`);

    if (prefersReducedMotion()) {
      tooltipEl.classList.add("reduced-motion");
    }

    const header = doc.createElement("div");
    header.className = "onboarding-tooltip-header";

    const title = doc.createElement("strong");
    title.className = "onboarding-tooltip-title";
    title.textContent = step.title;

    const progress = doc.createElement("span");
    progress.className = "onboarding-tooltip-progress";
    progress.textContent = `${currentStep + 1} / ${TOUR_STEPS.length}`;

    header.appendChild(title);
    header.appendChild(progress);

    const body = doc.createElement("p");
    body.className = "onboarding-tooltip-body";
    body.textContent = step.content;

    const actions = doc.createElement("div");
    actions.className = "onboarding-tooltip-actions";

    const skipBtn = doc.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "onboarding-skip";
    skipBtn.textContent = "Skip tour";
    skipBtn.addEventListener("click", dismiss);

    actions.appendChild(skipBtn);

    if (currentStep > 0) {
      const prevIndex = findPrevValidStep(currentStep - 1);
      if (prevIndex >= 0) {
        const prevBtn = doc.createElement("button");
        prevBtn.type = "button";
        prevBtn.className = "onboarding-prev";
        prevBtn.textContent = "Previous";
        prevBtn.addEventListener("click", () => {
          currentStep = prevIndex;
          renderStep();
        });
        actions.appendChild(prevBtn);
      }
    }

    const isLast = findNextValidStep(currentStep + 1) < 0;
    const nextBtn = doc.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "onboarding-next primary-button";
    nextBtn.textContent = isLast ? "Get started" : "Next";
    nextBtn.addEventListener("click", () => {
      if (isLast) {
        finish();
      } else {
        currentStep = currentStep + 1;
        renderStep();
      }
    });
    actions.appendChild(nextBtn);

    tooltipEl.appendChild(header);
    tooltipEl.appendChild(body);
    tooltipEl.appendChild(actions);

    container.appendChild(tooltipEl);
    positionTooltip(targetEl);
    nextBtn.focus();
  }

  async function start() {
    if (isActive || completed) return false;

    const alreadyDone = await checkComplete();
    if (alreadyDone) {
      completed = true;
      return false;
    }

    isActive = true;
    currentStep = 0;
    container.hidden = false;
    createOverlay();
    renderStep();
    return true;
  }

  async function finish() {
    isActive = false;
    await markComplete();
    cleanup();
  }

  async function dismiss() {
    isActive = false;
    await markComplete();
    cleanup();
  }

  function cleanup() {
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
    container.hidden = true;
  }

  function handleKeyDown(event) {
    if (!isActive) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
  }

  function handleOutsidePointer(event) {
    if (!isActive || !tooltipEl) return;
    if (!tooltipEl.contains(event.target)) {
      dismiss();
    }
  }

  container.addEventListener("keydown", handleKeyDown);
  if (typeof doc?.addEventListener === "function") {
    doc.addEventListener("pointerdown", handleOutsidePointer, true);
  }

  return {
    start,
    dismiss,
    isActive() { return isActive; },
    isComplete() { return completed; },
    destroy() {
      cleanup();
      container.removeEventListener("keydown", handleKeyDown);
      if (typeof doc?.removeEventListener === "function") {
        doc.removeEventListener("pointerdown", handleOutsidePointer, true);
      }
    },
  };
}

export { TOUR_STEPS };
