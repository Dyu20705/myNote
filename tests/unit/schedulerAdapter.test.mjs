import { describe, it } from "node:test";
import assert from "node:assert";
import { schedule } from "../../core/schedulerAdapter.js";

describe("Scheduler Adapter", () => {
  it("should throw on invalid grade", () => {
    const state = { cardId: "c1", state: "new" };
    const input = { grade: "foo", reviewedAt: new Date().toISOString() };
    assert.throws(() => schedule(state, input, new Date().toISOString()), /INVALID_REVIEW_GRADE/);
  });

  it("should transition state correctly", () => {
    const now = new Date().toISOString();
    const state = { cardId: "c1", state: "new" };
    const input = { grade: "good", reviewedAt: now };
    const { nextState, log } = schedule(state, input, now);
    
    assert.strictEqual(nextState.state, "review");
    assert.strictEqual(log.stateBefore, "new");
    assert.strictEqual(log.stateAfter, "review");
  });
});
