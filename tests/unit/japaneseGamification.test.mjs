import { describe, it } from "node:test";
import assert from "node:assert";
import { getInitialGamificationState, updateGamificationState } from "../../core/japaneseGamification.js";

describe("Gamification Engine", () => {
  it("computes XP mapping for all four ratings", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 1, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.xp, 2, "Again = 2");
    state = updateGamificationState(state, { id: "2", grade: 2, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.xp, 2 + 5, "Hard = 5");
    state = updateGamificationState(state, { id: "3", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.xp, 7 + 10, "Good = 10");
    state = updateGamificationState(state, { id: "4", grade: 4, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.xp, 17 + 15, "Easy = 15");
  });

  it("accumulates daily XP and updates first-day streak", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.streak, 1);
    assert.strictEqual(state.lastReviewDate, "2023-10-01");
  });

  it("increments consecutive-day streak", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "2", grade: 3, reviewedAt: "2023-10-02T10:00:00Z" });
    assert.strictEqual(state.streak, 2);
    assert.strictEqual(state.lastReviewDate, "2023-10-02");
  });

  it("resets missed-day streak", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "2", grade: 3, reviewedAt: "2023-10-03T10:00:00Z" });
    assert.strictEqual(state.streak, 1);
    assert.strictEqual(state.lastReviewDate, "2023-10-03");
  });

  it("avoids double-counting repeated events", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "1", grade: 3, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.xp, 10); // should not be 20
  });

  it("handles malformed review event gracefully", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 99, reviewedAt: "2023-10-01T10:00:00Z" });
    assert.strictEqual(state.xp, 0); // Invalid grade -> 0 XP
  });

  it("unlocks achievements deterministically without duplicates", () => {
    let state = getInitialGamificationState();
    state = updateGamificationState(state, { id: "1", grade: 4, reviewedAt: "2023-10-01T10:00:00Z" });
    state = updateGamificationState(state, { id: "2", grade: 4, reviewedAt: "2023-10-02T10:00:00Z" });
    state = updateGamificationState(state, { id: "3", grade: 4, reviewedAt: "2023-10-03T10:00:00Z" });
    assert.strictEqual(state.streak, 3);
    assert.ok(state.achievements.includes("3_day_streak"));
    
    // Duplicate review on 3rd day shouldn't duplicate achievement
    state = updateGamificationState(state, { id: "4", grade: 4, reviewedAt: "2023-10-03T11:00:00Z" });
    const count = state.achievements.filter(a => a === "3_day_streak").length;
    assert.strictEqual(count, 1);
  });
});
