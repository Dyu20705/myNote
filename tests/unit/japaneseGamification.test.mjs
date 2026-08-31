import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getInitialGamificationState, updateGamificationState } from "../../core/japaneseGamification.js";

describe("Gamification Engine", () => {
  it("computes XP mapping for all four ratings", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 1, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.xp, 2, "Again = 2");
    state = updateGamificationState(state, { id: "2", grade: 2, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.xp, 2 + 5, "Hard = 5");
    state = updateGamificationState(state, { id: "3", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.xp, 7 + 10, "Good = 10");
    state = updateGamificationState(state, { id: "4", grade: 4, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.xp, 17 + 15, "Easy = 15");
  });

  it("accumulates daily XP and updates first-day streak", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.streak, 1);
    assert.equal(state.lastReviewDate, "2023-10-01");
  });

  it("maintains streak on same-day additional reviews", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T08:00:00Z" });
    state = updateGamificationState(state, { id: "2", grade: 4, reviewedAt: "2023-10-01T20:00:00Z" });
    assert.equal(state.streak, 1);
    assert.equal(state.xp, 25);
    assert.equal(state.lastReviewDate, "2023-10-01");
  });

  it("increments consecutive-day streak and handles midnight UTC boundary", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T23:59:59.000Z" });
    assert.equal(state.streak, 1);
    assert.equal(state.lastReviewDate, "2023-10-01");

    state = updateGamificationState(state, { id: "2", grade: 3, reviewedAt: "2023-10-02T00:00:01.000Z" });
    assert.equal(state.streak, 2);
    assert.equal(state.lastReviewDate, "2023-10-02");
  });

  it("resets streak on single missed day", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "2", grade: 3, reviewedAt: "2023-10-02T10:00:00Z" });
    assert.equal(state.streak, 2);

    // 2023-10-03 was missed
    state = updateGamificationState(state, { id: "3", grade: 3, reviewedAt: "2023-10-04T10:00:00Z" });
    assert.equal(state.streak, 1);
    assert.equal(state.lastReviewDate, "2023-10-04");
  });

  it("resets streak on multiple missed days", () => {
    let state = { xp: 50, streak: 10, lastReviewDate: "2023-10-01", achievements: [], lastProcessedLogId: "0" };
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-10T10:00:00Z" });
    assert.equal(state.streak, 1);
    assert.equal(state.lastReviewDate, "2023-10-10");
  });

  it("avoids double-counting repeated events", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.xp, 10); // should not be 20
  });

  it("handles malformed review event gracefully", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 99, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.equal(state.xp, 0); // Invalid grade -> 0 XP
  });

  it("unlocks achievements deterministically without duplicates", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 4, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "2", grade: 4, reviewedAt: "2023-10-02T10:00:00Z" });
    state = updateGamificationState(state, { id: "3", grade: 4, reviewedAt: "2023-10-03T10:00:00Z" });
    assert.equal(state.streak, 3);
    assert.ok(state.achievements.includes("3_day_streak"));

    // Test higher tier achievements with consecutive dates
    let multiDayState = getInitialGamificationState();
    for (let day = 1; day <= 7; day++) {
      multiDayState = updateGamificationState(multiDayState, {
        id: `streak-${day}`,
        grade: 4,
        reviewedAt: `2023-10-${String(day).padStart(2, "0")}T10:00:00Z`,
      });
    }
    assert.equal(multiDayState.streak, 7);
    assert.ok(multiDayState.achievements.includes("7_day_streak"));

    // 30-day streak simulation
    multiDayState.streak = 29;
    multiDayState.lastReviewDate = "2023-10-29";
    multiDayState = updateGamificationState(multiDayState, {
      id: "streak-30",
      grade: 4,
      reviewedAt: "2023-10-30T10:00:00Z",
    });
    assert.equal(multiDayState.streak, 30);
    assert.ok(multiDayState.achievements.includes("30_day_streak"));

    state.xp = 100;
    state = updateGamificationState(state, { id: "7", grade: 4, reviewedAt: "2023-10-31T10:00:00Z" });
    assert.ok(state.achievements.includes("100_xp"));

    state.xp = 500;
    state = updateGamificationState(state, { id: "8", grade: 4, reviewedAt: "2023-11-01T10:00:00Z" });
    assert.ok(state.achievements.includes("500_xp"));

    state.xp = 1000;
    state = updateGamificationState(state, { id: "9", grade: 4, reviewedAt: "2023-11-02T10:00:00Z" });
    assert.ok(state.achievements.includes("1000_xp"));
  });

  it("respects localDate when provided on review log", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, {
      id: "1",
      grade: 3,
      reviewedAt: "2023-10-01T23:30:00Z",
      localDate: "2023-10-02",
    });
    assert.equal(state.lastReviewDate, "2023-10-02");
    assert.equal(state.streak, 1);
  });
});
