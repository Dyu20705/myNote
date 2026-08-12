import {
  JAPANESE_FILTER_ERRORS,
  resolveJapaneseCommonFilter,
} from "../core/japaneseFilters.js";

const REQUIRED_ELEMENTS = Object.freeze([
  "root",
  "panel",
  "toggle",
  "commonFilters",
  "chips",
  "dateFrom",
  "dateTo",
  "notebookType",
  "clear",
  "status",
]);

function validateDependencies(options) {
  const validElements = options.elements
    && REQUIRED_ELEMENTS.every((name) => name === "commonFilters"
      ? Array.isArray(options.elements[name])
        && options.elements[name].length > 0
        && options.elements[name].every((element) => element instanceof HTMLElement)
      : options.elements[name] instanceof HTMLElement);
  const validFilter = options.filter
    && typeof options.filter.getFilters === "function"
    && typeof options.filter.update === "function"
    && typeof options.filter.reset === "function"
    && typeof options.filter.isActive === "function"
    && typeof options.filter.getValidationError === "function";
  if (!validElements
    || !validFilter
    || typeof options.getState !== "function"
    || typeof options.subscribe !== "function"
    || typeof options.requestRefresh !== "function") {
    throw new TypeError("Invalid Japanese filter controller dependencies");
  }
}

function resultCount(state) {
  const enrolled = new Set(Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds : []);
  return (Array.isArray(state.filteredIds) ? state.filteredIds : [])
    .filter((id) => enrolled.has(id)).length;
}

export function createJapaneseFilterController(options) {
  validateDependencies(options);
  const {
    elements,
    filter,
    getState,
    subscribe,
    requestRefresh,
  } = options;
  const onError = typeof options.onError === "function" ? options.onError : () => {};
  let refreshToken = 0;
  let disclosureOpen = false;

  const chipDefinitions = Object.freeze([
    {
      key: "fromDate",
      active: (value) => Boolean(value),
      label: (value) => `From: ${value}`,
      reset: "",
    },
    {
      key: "toDate",
      active: (value) => Boolean(value),
      label: (value) => `To: ${value}`,
      reset: "",
    },
    {
      key: "notebookType",
      active: (value) => value !== "all",
      label: (value) => `Type: ${value[0].toUpperCase()}${value.slice(1)}`,
      reset: "all",
    },
  ]);

  function syncControls() {
    const values = filter.getFilters();
    elements.dateFrom.value = values.fromDate;
    elements.dateTo.value = values.toDate;
    elements.notebookType.value = values.notebookType;
    elements.dateTo.min = values.fromDate;
    elements.dateFrom.max = values.toDate;
    for (const button of elements.commonFilters) {
      const value = button.dataset.japaneseCommonFilter;
      const pressed = value === "all"
        ? values.notebookType === "all"
        : values.notebookType === value;
      button.setAttribute("aria-pressed", String(pressed));
    }
  }

  function render(state = getState()) {
    const japanese = state?.workspace === "japanese";
    elements.root.hidden = !japanese;
    elements.panel.hidden = !disclosureOpen;
    elements.toggle.setAttribute("aria-expanded", String(disclosureOpen));
    if (!japanese) {
      return;
    }

    const error = filter.getValidationError();
    const invalidRange = error === JAPANESE_FILTER_ERRORS.INVALID_DATE_RANGE;
    elements.dateFrom.setAttribute("aria-invalid", String(invalidRange));
    elements.dateTo.setAttribute("aria-invalid", String(invalidRange));
    elements.status.dataset.state = invalidRange ? "error" : "ready";
    elements.clear.hidden = !filter.isActive();
    renderChips(filter.getFilters());

    if (invalidRange) {
      elements.status.textContent = "Created from must be on or before Created to";
      return;
    }

    const total = new Set(Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds : []).size;
    const visible = resultCount(state);
    elements.status.textContent = `Showing ${visible} of ${total} Japanese ${total === 1 ? "note" : "notes"}`;
  }

  function renderChips(values) {
    elements.chips.replaceChildren(...chipDefinitions
      .filter((definition) => definition.active(values[definition.key]))
      .map((definition) => {
        const label = definition.label(values[definition.key]);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "japanese-filter-chip";
        button.textContent = `${label} ×`;
        button.setAttribute("aria-label", `Remove ${label} filter`);
        button.addEventListener("click", () => {
          filter.update({ [definition.key]: definition.reset });
          syncControls();
          render();
          refresh();
          if (definition.key === "notebookType") {
            elements.commonFilters.find((control) => (
              control.dataset.japaneseCommonFilter === "all"
            ))?.focus();
          } else {
            elements.toggle.focus();
          }
        });
        return button;
      }));
  }

  async function refresh() {
    const token = ++refreshToken;
    elements.root.setAttribute("aria-busy", "true");
    try {
      await requestRefresh();
    } catch (error) {
      onError(error);
    } finally {
      if (token === refreshToken) {
        elements.root.removeAttribute("aria-busy");
        render();
      }
    }
  }

  function readControls() {
    filter.update({
      fromDate: elements.dateFrom.value,
      toDate: elements.dateTo.value,
      notebookType: elements.notebookType.value,
    });
    syncControls();
    render();
    refresh();
  }

  function clearFilters() {
    filter.reset();
    syncControls();
    render();
    refresh();
    elements.commonFilters.find((button) => (
      button.dataset.japaneseCommonFilter === "all"
    ))?.focus();
  }

  function selectCommonFilter(event) {
    const notebookType = resolveJapaneseCommonFilter(
      event.currentTarget.dataset.japaneseCommonFilter,
    );
    if (notebookType === null) {
      return;
    }
    filter.update({ notebookType });
    syncControls();
    render();
    refresh();
  }

  function toggleDisclosure() {
    disclosureOpen = !disclosureOpen;
    render();
    if (disclosureOpen) {
      elements.dateFrom.focus();
    }
  }

  elements.dateFrom.addEventListener("input", readControls);
  elements.dateTo.addEventListener("input", readControls);
  elements.notebookType.addEventListener("change", readControls);
  elements.clear.addEventListener("click", clearFilters);
  elements.toggle.addEventListener("click", toggleDisclosure);
  for (const button of elements.commonFilters) {
    button.addEventListener("click", selectCommonFilter);
  }
  const unsubscribe = subscribe(render);

  syncControls();
  render();

  return {
    destroy() {
      elements.dateFrom.removeEventListener("input", readControls);
      elements.dateTo.removeEventListener("input", readControls);
      elements.notebookType.removeEventListener("change", readControls);
      elements.clear.removeEventListener("click", clearFilters);
      elements.toggle.removeEventListener("click", toggleDisclosure);
      for (const button of elements.commonFilters) {
        button.removeEventListener("click", selectCommonFilter);
      }
      unsubscribe();
    },
    render,
  };
}
