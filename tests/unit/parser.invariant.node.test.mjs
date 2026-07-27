import assert from "node:assert/strict";
import test from "node:test";
import { runParserInvariantTests } from "../parser.invariant.test.js";

test("existing parser invariants run unchanged under Node", () => {
  assert.equal(runParserInvariantTests(), "Parser invariant tests passed");
});
