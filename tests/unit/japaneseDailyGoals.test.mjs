import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getInitialDailyGoalsState,
  normalizeDailyGoalsState,
  updateDailyGoalsState,
} from "../../core/japaneseDailyGoals.js";

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

  describe("normalizeDailyGoalsState", () => {
    it("returns initial state when passed null/undefined", () => {
      const normalized = normalizeDailyGoalsState(null, "2026-09-01");
      assert.equal(normalized.currentDate, "2026-09-01");
      assert.equal(normalized.reviewsToday, 0);
      assert.equal(normalized.newItemsToday, 0);
      assert.equal(normalized.targetReviewsPerDay, 50);
      assert.equal(normalized.targetNewItemsPerDay, 10);
    });

    it("preserves counters when currentDate matches todayDate", () => {
      const state = {
        currentDate: "2026-08-31",
        reviewsToday: 4,
        newItemsToday: 2,
        targetReviewsPerDay: 4,
        targetNewItemsPerDay: 2,
        lastProcessedLogId: "log-1",
      };
      const normalized = normalizeDailyGoalsState(state, "2026-08-31");
      assert.equal(normalized.currentDate, "2026-08-31");
      assert.equal(normalized.reviewsToday, 4);
      assert.equal(normalized.newItemsToday, 2);
      assert.equal(normalized.lastProcessedLogId, "log-1");
    });

    it("resets counters to 0 on new day without any reviews yet", () => {
      const state = {
        currentDate: "2026-08-31",
        reviewsToday: 4,
        newItemsToday: 4,
        targetReviewsPerDay: 4,
        targetNewItemsPerDay: 2,
        lastProcessedLogId: "log-1",
      };
      // User opens app on September 1st with 0 reviews
      const normalized = normalizeDailyGoalsState(state, "2026-09-01");
      assert.equal(normalized.currentDate, "2026-09-01");
      assert.equal(normalized.reviewsToday, 0);
      assert.equal(normalized.newItemsToday, 0);
      assert.equal(normalized.targetReviewsPerDay, 4);
      assert.equal(normalized.targetNewItemsPerDay, 2);
      assert.equal(normalized.lastProcessedLogId, "log-1");
    });
  });
});
