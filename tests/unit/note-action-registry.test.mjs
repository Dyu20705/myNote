import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  return import(new URL("../../ui/noteActionRegistry.js", import.meta.url));
}

function command(id, overrides = {}) {
  return {
    id,
    title: id,
    description: `${id} description`,
    shortcuts: [],
    scope: "shell",
    available: true,
    unavailableReason: "",
    ...overrides,
  };
}

test("note action descriptors reference command IDs without owning execution", async () => {
  const { createNoteActionRegistry } = await loadModule();
  const registry = createNoteActionRegistry();
  registry.register({ commandId: "editor.save", order: 10 });
  registry.register({ commandId: "notes.delete", tone: "danger", order: 90 });

  assert.deepEqual(registry.snapshot([
    command("notes.delete", { title: "Delete note" }),
    command("editor.save", { title: "Save note" }),
  ]), [
    {
      commandId: "editor.save",
      tone: "default",
      order: 10,
      placement: "menu",
      command: command("editor.save", { title: "Save note" }),
    },
    {
      commandId: "notes.delete",
      tone: "danger",
      order: 90,
      placement: "menu",
      command: command("notes.delete", { title: "Delete note" }),
    },
  ]);
});

test("snapshot keeps current unavailable metadata and omits absent commands", async () => {
  const { createNoteActionRegistry } = await loadModule();
  const registry = createNoteActionRegistry();
  registry.register({ commandId: "notes.pin" });
  registry.register({ commandId: "future.kanji-handwriting", placement: "supplementary" });

  assert.deepEqual(registry.snapshot([
    command("notes.pin", {
      available: false,
      unavailableReason: "No active note to pin",
    }),
  ]), [{
    commandId: "notes.pin",
    tone: "default",
    order: 0,
    placement: "menu",
    command: command("notes.pin", {
      available: false,
      unavailableReason: "No active note to pin",
    }),
  }]);
});

test("duplicate, malformed, and excessive descriptors reject deterministically", async () => {
  const { createNoteActionRegistry } = await loadModule();
  const registry = createNoteActionRegistry({ maxActions: 2 });

  assert.throws(() => registry.register({ commandId: "bad" }), {
    code: "NOTE_ACTION_INVALID",
  });
  registry.register({ commandId: "notes.pin" });
  assert.throws(() => registry.register({ commandId: "notes.pin" }), {
    code: "NOTE_ACTION_DUPLICATE",
  });
  registry.register({ commandId: "notes.archive" });
  assert.throws(() => registry.register({ commandId: "notes.delete" }), {
    code: "NOTE_ACTION_LIMIT",
  });
});

test("unregister closures remove only their own descriptor", async () => {
  const { createNoteActionRegistry } = await loadModule();
  const registry = createNoteActionRegistry();
  const unregister = registry.register({ commandId: "notes.pin" });

  assert.equal(unregister(), true);
  assert.equal(unregister(), false);
  assert.deepEqual(registry.snapshot([command("notes.pin")]), []);
});
