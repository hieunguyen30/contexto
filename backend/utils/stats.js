// Streak math, kept pure so it is easy to test. Days are UTC "YYYY-MM-DD" strings.
const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

function shiftDay(key, delta) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return dayKey(d);
}

/**
 * Current streak = consecutive days with at least one review, ending today.
 * If nothing was reviewed yet today, the streak is still alive when yesterday was reviewed
 * (the learner has until the end of today to keep it).
 */
function computeStreak(activeDays, today = new Date()) {
  const set = new Set(activeDays);
  let cursor = dayKey(today);
  if (!set.has(cursor)) cursor = shiftDay(cursor, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }
  return streak;
}

module.exports = { computeStreak, dayKey, shiftDay };
