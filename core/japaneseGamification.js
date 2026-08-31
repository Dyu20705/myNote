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

  if (reviewLog?.id && nextState.lastProcessedLogId === reviewLog.id) {
    return currentState;
  }
  if (reviewLog?.id) {
    nextState.lastProcessedLogId = reviewLog.id;
  }

  const xp = XP_MAP[reviewLog?.grade] || 0;
  const reviewDate = typeof reviewLog?.localDate === "string" && reviewLog.localDate.length > 0
    ? reviewLog.localDate
    : (() => {
        const dateObj = new Date(reviewLog?.reviewedAt);
        return Number.isFinite(dateObj.getTime())
          ? `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, "0")}-${String(dateObj.getUTCDate()).padStart(2, "0")}`
          : null;
      })();

  if (reviewDate) {
    if (!nextState.lastReviewDate) {
      nextState.streak = 1;
    } else if (nextState.lastReviewDate !== reviewDate) {
      const lastTime = Date.parse(`${nextState.lastReviewDate}T00:00:00.000Z`);
      const currTime = Date.parse(`${reviewDate}T00:00:00.000Z`);
      const diffDays = Math.round((currTime - lastTime) / 86400000);

      if (diffDays === 1) {
        nextState.streak += 1;
      } else if (diffDays > 1) {
        nextState.streak = 1;
      }
    }
    nextState.lastReviewDate = reviewDate;
  }

  nextState.xp += xp;

  // Achievements unlocking
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
