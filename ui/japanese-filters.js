import { JAPANESE_FILTER_ERRORS } from "../core/japaneseFilters.js";

const REQUIRED_ELEMENTS = Object.freeze([
  "root",
  "dateFrom",
  "dateTo",
  "notebookType",
  "clear",
  "status",
]);

function validateDependencies(options) {
  const validElements = options.elements
    && REQUIRED_ELEMENTS.every((name) => options.elements[name] instanceof HTMLElement);
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

  function syncControls() {
    const values = filter.getFilters();
    elements.dateFrom.value = values.fromDate;
    elements.dateTo.value = values.toDate;
    elements.notebookType.value = values.notebookType;
    elements.dateTo.min = values.fromDate;
    elements.dateFrom.max = values.toDate;
  }

  function render(state = getState()) {
    const japanese = state?.workspace === "japanese";
    elements.root.hidden = !japanese;
    if (!japanese) {
      return;
    }

    const error = filter.getValidationError();
    const invalidRange = error === JAPANESE_FILTER_ERRORS.INVALID_DATE_RANGE;
    elements.dateFrom.setAttribute("aria-invalid", String(invalidRange));
    elements.dateTo.setAttribute("aria-invalid", String(invalidRange));
    elements.status.dataset.state = invalidRange ? "error" : "ready";
    elements.clear.disabled = !filter.isActive();

    if (invalidRange) {
      elements.status.textContent = "Created from must be on or before Created to";
      return;
    }

    const total = new Set(Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds : []).size;
    const visible = resultCount(state);
    elements.status.textContent = `Showing ${visible} of ${total} Japanese ${total === 1 ? "note" : "notes"}`;
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
    elements.notebookType.focus();
  }

  elements.dateFrom.addEventListener("input", readControls);
  elements.dateTo.addEventListener("input", readControls);
  elements.notebookType.addEventListener("change", readControls);
  elements.clear.addEventListener("click", clearFilters);
  const unsubscribe = subscribe(render);

  syncControls();
  render();

  return {
    destroy() {
      elements.dateFrom.removeEventListener("input", readControls);
      elements.dateTo.removeEventListener("input", readControls);
      elements.notebookType.removeEventListener("change", readControls);
      elements.clear.removeEventListener("click", clearFilters);
      unsubscribe();
    },
    render,
  };
}
