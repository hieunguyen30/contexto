const express = require('express');
const { VocabItem, QuizAttempt } = require('../models');
const { requireAuth, getUserId } = require('../middleware/auth');
const { computeStreak, dayKey } = require('../utils/stats');

const router = express.Router();
router.use(requireAuth);

const DAILY_GOAL = Number(process.env.DAILY_GOAL || 10);

// Streak, today's progress and due count for the sidebar/dashboard.
router.get('/', async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const now = new Date();
    const since = new Date(now.getTime() - 400 * 24 * 3600 * 1000);

    const [days, due] = await Promise.all([
      QuizAttempt.aggregate([
        { $match: { user_id: userId, created_at: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at', timezone: 'UTC' } },
            count: { $sum: 1 },
          },
        },
      ]),
      VocabItem.countDocuments({ user_id: userId, next_review_date: { $lte: now } }),
    ]);

    const today = dayKey(now);
    const todayRow = days.find((d) => d._id === today);
    return res.json({
      streak_days: computeStreak(days.map((d) => d._id), now),
      reviewed_today: todayRow ? todayRow.count : 0,
      daily_goal: DAILY_GOAL,
      due_count: due,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
