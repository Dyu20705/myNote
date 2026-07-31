import assert from "node:assert/strict";
import test from "node:test";
import { createSearchResultPipeline } from "../../core/searchResultPipeline.js";

test("applies registered policies in order without mutating source IDs", async () => {
  const pipeline = createSearchResultPipeline();
  const source = ["a", "b", "c"];
  pipeline.register({
    id: "remove-b",
    apply(ids) {
      ids.shift();
      return ids.filter((id) => id !== "b");
    },
  });
  pipeline.register({
    id: "reverse",
    apply(ids) {
      return ids.reverse();
    },
  });

  assert.deepEqual(await pipeline.apply(source), ["c"]);
  assert.deepEqual(source, ["a", "b", "c"]);
});

test("unregister removes only the registered policy instance", async () => {
  const pipeline = createSearchResultPipeline();
  const unregister = pipeline.register({
    id: "one",
    apply(ids) {
      return ids.slice(0, 1);
    },
  });
  unregister();
  unregister();
  assert.deepEqual(await pipeline.apply(["a", "b"]), ["a", "b"]);
});

test("rejects duplicate IDs and invalid policy output", async () => {
  const pipeline = createSearchResultPipeline();
  pipeline.register({ id: "duplicate", apply: (ids) => ids });
  assert.throws(
    () => pipeline.register({ id: "duplicate", apply: (ids) => ids }),
    (error) => error.code === "DUPLICATE_SEARCH_RESULT_POLICY"
  );

  const invalid = createSearchResultPipeline();
  invalid.register({ id: "invalid", apply: () => [1] });
  await assert.rejects(
    invalid.apply(["a"]),
    (error) => error.code === "INVALID_SEARCH_RESULT_POLICY_OUTPUT"
  );
});
