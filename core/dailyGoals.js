export function getInitialDailyGoalsState() {
  return {
    targetReviewsPerDay: 50,
    targetNewItemsPerDay: 10,
    currentDate: null,
    reviewsToday: 0,
    newItemsToday: 0,
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
  };

  const reviewDate = reviewLog.reviewedAt.split('T')[0];
  
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
