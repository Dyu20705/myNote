/**
 * A basic scheduler adapter conforming to the Japanese V2 ReviewState schema.
 * Note: This is a deterministic placeholder scheduler, not a strict SM-2 implementation.
 * It uses simple heuristic multipliers to demonstrate the scheduler boundary.
 */

const SCHEDULER_NAME = "legacy-sm2";
const SCHEDULER_VERSION = "1.0";

const VALID_GRADES = new Set(["again", "hard", "good", "easy"]);

export function schedule(state, input, now) {
  if (!VALID_GRADES.has(input.grade)) {
    throw new TypeError(`INVALID_REVIEW_GRADE: ${input.grade}`);
  }
  if (!input.reviewedAt) throw new TypeError("Missing reviewedAt in input");
  if (!state.cardId) throw new TypeError("Missing cardId in state");
  if (!state.state) throw new TypeError("Missing state label in state");

  const isNew = state.state === "new";
  const nowMs = new Date(now).getTime();
  const lastReviewMs = state.lastReviewAt ? new Date(state.lastReviewAt).getTime() : nowMs;
  
  // Calculate elapsed days
  const elapsedDays = isNew ? 0 : Math.max(0, (nowMs - lastReviewMs) / (1000 * 60 * 60 * 24));

  // Heuristic transition
  let nextStateLabel = state.state;
  let scheduledDays = state.scheduledDays || 0;
  let reps = state.reps || 0;
  let lapses = state.lapses || 0;
  
  if (input.grade === "again") {
    nextStateLabel = "relearning";
    scheduledDays = 0; // Due immediately
    lapses += 1;
    reps = 0;
  } else if (input.grade === "hard") {
    nextStateLabel = "review";
    scheduledDays = scheduledDays === 0 ? 1 : scheduledDays * 1.2;
    reps += 1;
  } else if (input.grade === "good") {
    nextStateLabel = "review";
    scheduledDays = scheduledDays === 0 ? 1 : scheduledDays * 2.5;
    reps += 1;
  } else if (input.grade === "easy") {
    nextStateLabel = "review";
    scheduledDays = scheduledDays === 0 ? 4 : scheduledDays * 3.5;
    reps += 1;
  }

  // Calculate new due date
  const dueMs = nowMs + scheduledDays * 24 * 60 * 60 * 1000;
  const due = new Date(dueMs).toISOString();

  const previousSnapshot = {
    difficulty: state.difficulty,
    stability: state.stability,
    due: state.due,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    lastReviewAt: state.lastReviewAt
  };

  const nextState = {
    cardId: state.cardId,
    state: nextStateLabel,
    due,
    reps,
    lapses,
    elapsedDays,
    scheduledDays,
    difficulty: state.difficulty, // Unchanged in this heuristic
    stability: state.stability, // Unchanged in this heuristic
    lastReviewAt: now,
    scheduler: SCHEDULER_NAME,
    schedulerVersion: SCHEDULER_VERSION,
    updatedAt: now
  };

  const nextSnapshot = {
    difficulty: nextState.difficulty,
    stability: nextState.stability,
    due: nextState.due,
    reps: nextState.reps,
    lapses: nextState.lapses,
    state: nextState.state,
    lastReviewAt: nextState.lastReviewAt
  };

  const log = {
    id: crypto.randomUUID(),
    cardId: state.cardId,
    grade: input.grade,
    reviewedAt: input.reviewedAt,
    durationMs: input.durationMs,
    stateBefore: state.state,
    stateAfter: nextStateLabel,
    elapsedDays,
    scheduledDays,
    scheduler: SCHEDULER_NAME,
    schedulerVersion: SCHEDULER_VERSION,
    previousStateSnapshot: previousSnapshot,
    nextStateSnapshot: nextSnapshot,
    source: "user"
  };

  return { nextState, log };
}
