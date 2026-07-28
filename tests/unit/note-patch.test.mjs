import assert from "node:assert/strict";
import test from "node:test";
import { applyNotePatch, createNotePatch, invertNotePatch } from "../../core/notePatch.js";

function notes() {
  const previous = {
    id: "synthetic-note",
    title: "Before",
    content: "Before body",
    tags: ["before"],
    blocks: [{ id: "block-1", meta: { tone: "before" } }],
    version: 1,
    localOnly: { preserved: true },
  };
  const next = {
    ...previous,
    title: "After",
    content: "After body",
    tags: ["after"],
    blocks: [{ id: "block-1", meta: { tone: "after" } }],
    version: 2,
  };
  return { previous, next };
}

test("note patch round trip applies approved fields and inverse restores them", () => {
  const { previous, next } = notes();
  const patch = createNotePatch(previous, next);
  const applied = applyNotePatch(previous, patch);
  const restored = applyNotePatch(applied, invertNotePatch(patch));

  assert.equal(applied.title, "After");
  assert.equal(applied.content, "After body");
  assert.deepEqual(applied.tags, ["after"]);
  assert.deepEqual(applied.blocks, [{ id: "block-1", meta: { tone: "after" } }]);
  assert.equal(applied.version, 2);
  assert.equal(restored.title, "Before");
  assert.equal(restored.content, "Before body");
  assert.deepEqual(restored.tags, ["before"]);
  assert.deepEqual(restored.blocks, [{ id: "block-1", meta: { tone: "before" } }]);
  assert.equal(restored.version, 1);
});

test("note patch preserves source fields outside the approved patch keys", () => {
  const { previous, next } = notes();

  const applied = applyNotePatch(previous, createNotePatch(previous, next));

  assert.deepEqual(applied.localOnly, { preserved: true });
  assert.equal(applied.id, "synthetic-note");
});

test("applying a crafted patch ignores operations outside approved patch keys", () => {
  const { previous } = notes();
  const applied = applyNotePatch(previous, [
    { key: "title", before: "Before", after: "Approved title" },
    { key: "id", before: "synthetic-note", after: "forged-id" },
    { key: "localOnly", before: { preserved: true }, after: { preserved: false } },
  ]);

  assert.equal(applied.title, "Approved title");
  assert.equal(applied.id, "synthetic-note");
  assert.deepEqual(applied.localOnly, { preserved: true });
});

test("inverting a crafted patch omits operations outside approved patch keys", () => {
  const inverse = invertNotePatch([
    { key: "title", before: "Before", after: "After" },
    { key: "localOnly", before: { preserved: true }, after: { preserved: false } },
  ]);

  assert.deepEqual(inverse, [{ key: "title", before: "After", after: "Before" }]);
});

test("empty note changes produce an empty patch", () => {
  const { previous } = notes();

  assert.deepEqual(createNotePatch(previous, previous), []);
});

test("note patch creation isolates nested values from both input notes", () => {
  const { previous, next } = notes();
  const patch = createNotePatch(previous, next);

  previous.tags[0] = "mutated-before";
  next.blocks[0].meta.tone = "mutated-after";

  assert.deepEqual(patch.find((op) => op.key === "tags").before, ["before"]);
  assert.deepEqual(patch.find((op) => op.key === "blocks").after, [
    { id: "block-1", meta: { tone: "after" } },
  ]);
});

test("applying and inverting patches do not expose retained nested patch values", () => {
  const { previous, next } = notes();
  const patch = createNotePatch(previous, next);
  const firstApplied = applyNotePatch(previous, patch);
  const firstInverse = invertNotePatch(patch);

  firstApplied.tags[0] = "mutated-result";
  firstApplied.blocks[0].meta.tone = "mutated-result";
  firstInverse.find((op) => op.key === "tags").after[0] = "mutated-inverse";

  const reapplied = applyNotePatch(previous, patch);
  const reinverted = invertNotePatch(patch);
  assert.deepEqual(reapplied.tags, ["after"]);
  assert.deepEqual(reapplied.blocks, [{ id: "block-1", meta: { tone: "after" } }]);
  assert.deepEqual(reinverted.find((op) => op.key === "tags").after, ["before"]);
});

test("reapplying the same note patch is deterministic", () => {
  const { previous, next } = notes();
  const patch = createNotePatch(previous, next);

  assert.deepEqual(applyNotePatch(previous, patch), applyNotePatch(previous, patch));
});
