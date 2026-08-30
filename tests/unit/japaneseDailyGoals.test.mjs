import { describe, it } from "node:test";
import assert from "node:assert";
import { getInitialDailyGoalsState, updateDailyGoalsState } from "../../core/japaneseDailyGoals.js";

describe("Daily Goals", () => {
  it("uses default configuration for targets", () => {
    let state = getInitialDailyGoalsState();
    assert.strictEqual(state.targetReviewsPerDay, 50);
  });

  it("preserves custom target", () => {
    let state = { targetReviewsPerDay: 20, targetNewItemsPerDay: 5, currentDate: null, reviewsToday: 0, newItemsToday: 0 };
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, false);
    assert.strictEqual(state.targetReviewsPerDay, 20);
  });

  it("increments review progress and new-item progress", () => {
    let state = getInitialDailyGoalsState();
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, false);
    assert.strictEqual(state.reviewsToday, 1);
    assert.strictEqual(state.newItemsToday, 0);

    state = updateDailyGoalsState(state, { id: "2", reviewedAt: "2023-10-01T10:00:00Z" }, true);
    assert.strictEqual(state.reviewsToday, 2);
    assert.strictEqual(state.newItemsToday, 1);
  });

  it("resets progress on day rollover", () => {
    let state = getInitialDailyGoalsState();
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, true);
    state = updateDailyGoalsState(state, { id: "2", reviewedAt: "2023-10-02T10:00:00Z" }, true);
    assert.strictEqual(state.reviewsToday, 1);
    assert.strictEqual(state.newItemsToday, 1);
    assert.strictEqual(state.currentDate, "2023-10-02");
  });

  it("avoids double-counting repeated events", () => {
    let state = getInitialDailyGoalsState();
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, true);
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, true);
    assert.strictEqual(state.reviewsToday, 1);
  });
});
