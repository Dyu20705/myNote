import { filterJapaneseNoteIds } from "../core/japaneseFilters.js";
import { getActiveSearchClient } from "../core/searchClient.js";
import { getActiveStore } from "../core/state.js";

const store = getActiveStore();
const searchClient = getActiveSearchClient();
const elements = {
  root: document.querySelector("#japaneseFilters"),
  dateFrom: document.querySelector("#japaneseDateFrom"),
  dateTo: document.querySelector("#japaneseDateTo"),
  notebookType: document.querySelector("#japaneseNoteType"),
  clear: document.querySelector("#clearJapaneseFilters"),
  status: document.querySelector("#japaneseFilterStatus"),
  searchInput: document.querySelector("#searchInput"),
};

if (!store || !searchClient || Object.values(elements).some((element) => !element)) {
  throw new Error("Japanese note filters are unavailable");
}

const filters = {
  fromDate: "",
  toDate: "",
  notebookType: "all",
};

const originalQuery = searchClient.query.bind(searchClient);
searchClient.query = async (queryText) => {
  const ids = await originalQuery(queryText);
  const state = store.getState();
  if (state.workspace !== "japanese") {
    return ids;
  }
  return filterJapaneseNoteIds({
    ids,
    notes: state.notes,
    reviews: state.studyReviews,
    filters,
  });
};

function hasActiveFilters() {
  return Boolean(filters.fromDate || filters.toDate || filters.notebookType !== "all");
}

function refreshList() {
  elements.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function readFilters() {
  filters.fromDate = elements.dateFrom.value;
  filters.toDate = elements.dateTo.value;
  filters.notebookType = elements.notebookType.value;
  elements.dateTo.min = filters.fromDate;
  elements.dateFrom.max = filters.toDate;
  elements.clear.disabled = !hasActiveFilters();
}

function render(state = store.getState()) {
  const japanese = state.workspace === "japanese";
  elements.root.hidden = !japanese;
  if (!japanese) {
    return;
  }

  const enrolledIds = new Set(Array.isArray(state.japaneseNoteIds) ? state.japaneseNoteIds : []);
  const visibleCount = (Array.isArray(state.filteredIds) ? state.filteredIds : [])
    .filter((id) => enrolledIds.has(id)).length;
  const totalCount = enrolledIds.size;
  elements.status.textContent = `Showing ${visibleCount} of ${totalCount} Japanese ${totalCount === 1 ? "note" : "notes"}`;
  elements.clear.disabled = !hasActiveFilters();
}

for (const control of [elements.dateFrom, elements.dateTo, elements.notebookType]) {
  control.addEventListener("input", () => {
    readFilters();
    refreshList();
  });
}

elements.clear.addEventListener("click", () => {
  elements.dateFrom.value = "";
  elements.dateTo.value = "";
  elements.notebookType.value = "all";
  readFilters();
  refreshList();
  elements.notebookType.focus();
});

store.subscribe(render);
readFilters();
render();
