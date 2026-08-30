export const XP_MAP = Object.freeze({
  1: 2,  // Again
  2: 5,  // Hard
  3: 10, // Good
  4: 15, // Easy
});

export function getInitialGamificationState() {
  return {
    xp: 0,
    streak: 0,
    lastReviewDate: null,
    achievements: [],
    lastProcessedLogId: null,
  };
}

export function updateGamificationState(currentState, reviewLog) {
  if (!currentState) {
    currentState = getInitialGamificationState();
  }
  
  const nextState = {
    xp: currentState.xp || 0,
    streak: currentState.streak || 0,
    lastReviewDate: currentState.lastReviewDate || null,
    achievements: Array.isArray(currentState.achievements) ? [...currentState.achievements] : [],
    lastProcessedLogId: currentState.lastProcessedLogId || null,
  };

  if (reviewLog.id && nextState.lastProcessedLogId === reviewLog.id) {
    return currentState;
  }
  nextState.lastProcessedLogId = reviewLog.id;
  
  const xp = XP_MAP[reviewLog.grade] || 0;
  const dateObj = new Date(reviewLog.reviewedAt);
  const reviewDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  if (!nextState.lastReviewDate) {
    nextState.streak = 1;
  } else if (nextState.lastReviewDate !== reviewDate) {
    const lastDate = new Date(nextState.lastReviewDate);
    const currDate = new Date(reviewDate);
    // Setting to midnight to avoid DST issues when calculating difference in days
    lastDate.setUTCHours(0, 0, 0, 0);
    currDate.setUTCHours(0, 0, 0, 0);
    const diffDays = Math.round((currDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      nextState.streak += 1;
    } else if (diffDays === 2) {
      // 24h grace window: streak is preserved but not incremented
    } else if (diffDays > 2) {
      // Streak broken
      nextState.streak = 1;
    }
  }
  
  nextState.lastReviewDate = reviewDate;
  nextState.xp += xp;
  
  // Achievements (simple rule-based)
  if (nextState.streak >= 3 && !nextState.achievements.includes("3_day_streak")) {
    nextState.achievements.push("3_day_streak");
  }
  if (nextState.streak >= 7 && !nextState.achievements.includes("7_day_streak")) {
    nextState.achievements.push("7_day_streak");
  }
  if (nextState.streak >= 30 && !nextState.achievements.includes("30_day_streak")) {
    nextState.achievements.push("30_day_streak");
  }
  if (nextState.xp >= 100 && !nextState.achievements.includes("100_xp")) {
    nextState.achievements.push("100_xp");
  }
  if (nextState.xp >= 500 && !nextState.achievements.includes("500_xp")) {
    nextState.achievements.push("500_xp");
  }
  if (nextState.xp >= 1000 && !nextState.achievements.includes("1000_xp")) {
    nextState.achievements.push("1000_xp");
  }

  return nextState;
}
