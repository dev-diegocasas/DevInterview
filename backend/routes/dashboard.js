const { requireAuth } = require('./auth');
const { sendJSON } = require('./helpers');

async function dashboardStatsRoute(req, res) {
  const { getDashboardStats, getDashboardByArea, getUserGoals, createDefaultGoals, getCurrentStreak, getLongestStreak, getLastPracticeDate } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) {
      return sendJSON(res, 401, { success: false, error: 'No autorizado. Inicia sesion.' });
    }

    const [stats, byArea, goals, streak, longest, lastPractice] = await Promise.all([
      getDashboardStats(session.user_id),
      getDashboardByArea(session.user_id),
      getUserGoals(session.user_id).catch(() => null),
      getCurrentStreak(session.user_id),
      getLongestStreak(session.user_id),
      getLastPracticeDate(session.user_id)
    ]);

    if (!goals) {
      await createDefaultGoals(session.user_id);
    }

    const currentStreak = streak ? parseInt(streak.current_streak, 10) : 0;
    const longestStreakVal = longest ? parseInt(longest.streak_days, 10) : 0;

    let needsPractice = true;
    if (lastPractice) {
      const lastDate = new Date(lastPractice.practice_date);
      const today = new Date();
      const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
      needsPractice = diffDays > 0;
      if (diffDays > 1 && currentStreak > 0) {
        needsPractice = true;
      }
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        totalInterviews: parseInt(stats.total_interviews, 10) || 0,
        completedInterviews: parseInt(stats.completed_interviews, 10) || 0,
        completedQuizzes: parseInt(stats.completed_quizzes, 10) || 0,
        completedChats: parseInt(stats.completed_chats, 10) || 0,
        avgScore: stats.avg_score ? parseFloat(stats.avg_score) : 0,
        bestScore: stats.best_score || 0,
        worstScore: stats.worst_score || 0,
        currentStreak,
        longestStreak: Math.max(currentStreak, longestStreakVal),
        lastPracticeDate: lastPractice ? lastPractice.practice_date : null,
        weeklyTarget: goals ? goals.weekly_target : 5,
        weeklyProgress: goals ? parseInt(goals.weekly_progress, 10) : 0,
        byArea
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { dashboardStatsRoute };
