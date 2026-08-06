import { commandRuntime } from "../app.js";
import { kanjiInkApplication } from "../core/kanjiInkApplication.js";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

const input = document.createElement("input");
input.id = "kanjiImportInput";
input.type = "file";
input.accept = "application/json,.json";
input.hidden = true;

const status = document.createElement("p");
status.id = "kanjiImportStatus";
status.className = "kanji-import-status";
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");
status.hidden = true;

document.body.append(input, status);

function announce(message, isError = false) {
  status.textContent = message;
  status.dataset.state = isError ? "error" : "success";
  status.hidden = false;
}

async function restoreFile(file) {
  if (!file || file.size < 1 || file.size > MAX_IMPORT_BYTES) {
    const error = new Error("KANJI_IMPORT_FILE_INVALID");
    error.code = "KANJI_IMPORT_FILE_INVALID";
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    const error = new Error("KANJI_IMPORT_INVALID_JSON");
    error.code = "KANJI_IMPORT_INVALID_JSON";
    throw error;
  }

  return kanjiInkApplication.restoreBundle(parsed);
}

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;

  announce("Validating Kanji import…");
  try {
    const result = await restoreFile(file);
    announce(
      `Imported ${result.importedNotes} notes and ${result.importedKanjiInkEntries} handwriting entries. Reloading…`,
    );
    window.location.reload();
  } catch {
    announce("Kanji import failed. No data changed.", true);
  }
});

const unregister = commandRuntime.registry.register({
  id: "import.kanji-json",
  title: "Import Kanji data from JSON",
  description: "Validate and atomically restore a myNote Kanji export bundle",
  shortcuts: [],
  scope: "shell",
  isAvailable: () => true,
  unavailableReason: () => "Kanji import is unavailable",
  run: () => {
    status.hidden = true;
    input.click();
    return true;
  },
});

export const kanjiInkImportCommand = Object.freeze({
  destroy() {
    unregister();
    input.remove();
    status.remove();
  },
});
