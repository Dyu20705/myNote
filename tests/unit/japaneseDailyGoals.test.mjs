import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getInitialDailyGoalsState, updateDailyGoalsState } from "../../core/japaneseDailyGoals.js";

describe("Daily Goals", () => {
  it("uses default configuration for targets", () => {
    const state = getInitialDailyGoalsState();
    assert.equal(state.targetReviewsPerDay, 50);
    assert.equal(state.targetNewItemsPerDay, 10);
  });

  it("preserves custom target", () => {
    let state = { targetReviewsPerDay: 20, targetNewItemsPerDay: 5, currentDate: null, reviewsToday: 0, newItemsToday: 0 };
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, false);
    assert.equal(state.targetReviewsPerDay, 20);
    assert.equal(state.targetNewItemsPerDay, 5);
  });

  it("increments review progress and new-item progress accurately", () => {
    let state = getInitialDailyGoalsState();
    // Existing item review
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, false);
    assert.equal(state.reviewsToday, 1);
    assert.equal(state.newItemsToday, 0);

    // New item review
    state = updateDailyGoalsState(state, { id: "2", reviewedAt: "2023-10-01T10:05:00Z" }, true);
    assert.equal(state.reviewsToday, 2);
    assert.equal(state.newItemsToday, 1);

    // Another existing item review
    state = updateDailyGoalsState(state, { id: "3", reviewedAt: "2023-10-01T10:10:00Z" }, false);
    assert.equal(state.reviewsToday, 3);
    assert.equal(state.newItemsToday, 1);
  });

  it("resets progress on day rollover and midnight boundary", () => {
    let state = getInitialDailyGoalsState();
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T23:59:59.000Z" }, true);
    assert.equal(state.reviewsToday, 1);
    assert.equal(state.newItemsToday, 1);
    assert.equal(state.currentDate, "2023-10-01");

    state = updateDailyGoalsState(state, { id: "2", reviewedAt: "2023-10-02T00:00:01.000Z" }, true);
    assert.equal(state.reviewsToday, 1);
    assert.equal(state.newItemsToday, 1);
    assert.equal(state.currentDate, "2023-10-02");
  });

  it("avoids double-counting repeated events", () => {
    let state = getInitialDailyGoalsState();
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, true);
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T10:00:00Z" }, true);
    assert.equal(state.reviewsToday, 1);
    assert.equal(state.newItemsToday, 1);
  });

  it("respects localDate when provided on review log", () => {
    let state = getInitialDailyGoalsState();
    state = updateDailyGoalsState(state, { id: "1", reviewedAt: "2023-10-01T23:30:00Z", localDate: "2023-10-02" }, true);
    assert.equal(state.currentDate, "2023-10-02");
    assert.equal(state.reviewsToday, 1);
  });
});
