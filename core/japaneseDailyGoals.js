export function getInitialDailyGoalsState() {
  return {
    targetReviewsPerDay: 50,
    targetNewItemsPerDay: 10,
    currentDate: null,
    reviewsToday: 0,
    newItemsToday: 0,
    lastProcessedLogId: null,
  };
}

export function normalizeDailyGoalsState(state, todayDate) {
  if (!state) {
    state = getInitialDailyGoalsState();
  }
  const targetReviewsPerDay = state.targetReviewsPerDay ?? 50;
  const targetNewItemsPerDay = state.targetNewItemsPerDay ?? 10;
  const lastProcessedLogId = state.lastProcessedLogId || null;

  if (!todayDate || state.currentDate === todayDate) {
    return {
      targetReviewsPerDay,
      targetNewItemsPerDay,
      currentDate: state.currentDate || todayDate || null,
      reviewsToday: state.reviewsToday || 0,
      newItemsToday: state.newItemsToday || 0,
      lastProcessedLogId,
    };
  }

  return {
    targetReviewsPerDay,
    targetNewItemsPerDay,
    currentDate: todayDate,
    reviewsToday: 0,
    newItemsToday: 0,
    lastProcessedLogId,
  };
}

export function updateDailyGoalsState(currentState, reviewLog, isNewItem) {
  const reviewDate = typeof reviewLog?.localDate === "string" && reviewLog.localDate.length > 0
    ? reviewLog.localDate
    : (() => {
        const dateObj = new Date(reviewLog?.reviewedAt);
        return Number.isFinite(dateObj.getTime())
          ? `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`
          : null;
      })();

  const baseState = normalizeDailyGoalsState(currentState, reviewDate);

  if (reviewLog?.id && baseState.lastProcessedLogId === reviewLog.id) {
    return currentState;
  }

  const nextState = {
    ...baseState,
    lastProcessedLogId: reviewLog?.id || baseState.lastProcessedLogId,
    reviewsToday: baseState.reviewsToday + 1,
    newItemsToday: isNewItem ? baseState.newItemsToday + 1 : baseState.newItemsToday,
  };

  return nextState;
}
