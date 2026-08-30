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

export function updateDailyGoalsState(currentState, reviewLog, isNewItem) {
  if (!currentState) {
    currentState = getInitialDailyGoalsState();
  }

  const nextState = {
    targetReviewsPerDay: currentState.targetReviewsPerDay ?? 50,
    targetNewItemsPerDay: currentState.targetNewItemsPerDay ?? 10,
    currentDate: currentState.currentDate || null,
    reviewsToday: currentState.reviewsToday || 0,
    newItemsToday: currentState.newItemsToday || 0,
    lastProcessedLogId: currentState.lastProcessedLogId || null,
  };

  if (reviewLog.id && nextState.lastProcessedLogId === reviewLog.id) {
    return currentState;
  }
  nextState.lastProcessedLogId = reviewLog.id;

  const dateObj = new Date(reviewLog.reviewedAt);
  const reviewDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  
  if (nextState.currentDate !== reviewDate) {
    nextState.currentDate = reviewDate;
    nextState.reviewsToday = 0;
    nextState.newItemsToday = 0;
  }

  nextState.reviewsToday += 1;
  if (isNewItem) {
    nextState.newItemsToday += 1;
  }

  return nextState;
}
