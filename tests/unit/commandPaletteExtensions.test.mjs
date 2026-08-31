import assert from "node:assert/strict";
import test from "node:test";
import { createCommandRegistry } from "../../ui/commandRegistry.js";
import { registerApplicationCommands } from "../../ui/applicationCommands.js";

function setupRegistryWithAllCommands(overrides = {}) {
  const registry = createCommandRegistry();
  const registered = [];

  const unregisterList = registerApplicationCommands({
    registerCommand: (cmd) => {
      const unreg = registry.register({
        shortcuts: [],
        scope: "shell",
        isAvailable: () => true,
        unavailableReason: () => "",
        ...cmd,
      });
      registered.push(cmd);
      return unreg;
    },
    activeNote: () => ({ id: "note-1", title: "Test Note", content: "Content" }),
    handleToolbarAction: () => {},
    palette: { open: () => {}, close: () => {} },
    themeSwitcher: { open: () => {} },
    createNote: () => {},
    openDailyNote: () => {},
    focusSearch: () => {},
    autosave: { flush: () => {} },
    insertCodeBlock: () => {},
    mutateActiveNote: () => {},
    deleteActiveNote: () => {},
    store: { getState: () => ({ notes: [], filteredIds: ["note-1"], recentIds: ["note-1"] }) },
    switchRecentNote: () => {},
    commandStack: { canUndo: () => true, canRedo: () => true },
    undoLastCommand: () => {},
    redoLastCommand: () => {},
    moveSelection: () => {},
    jumpBoundary: () => {},
    toggleViewMode: () => {},
    focusEditor: () => {},
    exportMarkdown: () => {},
    exportJson: () => {},
    openResetConfirmation: () => {},
    settingsPanel: { open: () => {} },
    importThemeFromFile: () => {},
    toggleDarkLightTheme: () => {},
    startJapaneseReview: () => {},
    startQuickStudy: () => {},
    openKanjiDraw: () => {},
    openDailyGoalSettings: () => {},
    toggleEditorToolbar: () => {},
    ...overrides,
  });

  return { registry, registered, unregisterList };
}

test("application commands include all required extensions for #140 and #142", () => {
  const { registry, registered } = setupRegistryWithAllCommands();

  const requiredCommandIds = [
    "theme.switch",
    "theme.import",
    "theme.toggleDarkLight",
    "settings.open",
    "japanese.startReview",
    "japanese.quickStudy",
    "japanese.openKanjiDraw",
    "japanese.setDailyGoal",
    "editor.toggleToolbar",
    "notes.create",
    "notes.toggle-view-mode",
  ];

  const snapshot = registry.snapshot();
  for (const id of requiredCommandIds) {
    const cmd = registered.find((c) => c.id === id);
    assert.ok(cmd, `Command '${id}' should be registered in the command registry`);
    assert.ok(cmd.title, `Command '${id}' should have a title`);
    assert.ok(cmd.description, `Command '${id}' should have a description`);
    assert.ok(snapshot.some((s) => s.id === id), `Command '${id}' should appear in snapshot`);
  }
});

test("japanese commands availability depends on context workspace", () => {
  const { registered } = setupRegistryWithAllCommands();

  const reviewCmd = registered.find((c) => c.id === "japanese.startReview");
  assert.ok(reviewCmd);

  // In notes workspace: should be unavailable
  const notesContext = { workspace: "notes" };
  assert.equal(reviewCmd.isAvailable(notesContext), false);
  assert.ok(reviewCmd.unavailableReason(notesContext).includes("Japanese"));

  // In japanese workspace: should be available
  const japaneseContext = { workspace: "japanese" };
  assert.equal(reviewCmd.isAvailable(japaneseContext), true);
});

test("settings.open command invokes settingsPanel.open", () => {
  let settingsOpened = false;
  const { registered } = setupRegistryWithAllCommands({
    settingsPanel: {
      open: () => { settingsOpened = true; },
    },
  });

  const cmd = registered.find((c) => c.id === "settings.open");
  assert.ok(cmd);
  cmd.run({ opener: null });
  assert.equal(settingsOpened, true);
});

test("theme.toggleDarkLight invokes toggle function", () => {
  let toggled = false;
  const { registered } = setupRegistryWithAllCommands({
    toggleDarkLightTheme: () => { toggled = true; },
  });

  const cmd = registered.find((c) => c.id === "theme.toggleDarkLight");
  assert.ok(cmd);
  cmd.run();
  assert.equal(toggled, true);
});
