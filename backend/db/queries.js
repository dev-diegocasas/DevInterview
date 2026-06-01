const { pool } = require('./connection');

// ====================================================================
// ÁREAS TÉCNICAS
// ====================================================================

async function getAreas() {
  const result = await pool.query(
    'SELECT id, name, description, slug, icon, popular FROM technical_areas WHERE is_active = true ORDER BY popular DESC, id'
  );
  return result.rows;
}

async function getAreaById(id) {
  const result = await pool.query(
    'SELECT id, name, description, slug, icon, popular FROM technical_areas WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// ====================================================================
// USUARIOS
// ====================================================================

async function createUser(fullName, email, passwordHash) {
  const result = await pool.query(
    'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, full_name, email, photo_url, bio, tech_level, created_at',
    [fullName, email, passwordHash]
  );
  return result.rows[0];
}

async function getUserByEmail(email) {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getUserById(id) {
  const result = await pool.query(
    'SELECT id, full_name, email, photo_url, bio, tech_level, account_status, created_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function getUserProfile(id) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.photo_url, u.bio, u.tech_level,
            COALESCE(ug.weekly_target, 5) AS weekly_target
     FROM users u
     LEFT JOIN user_goals ug ON ug.user_id = u.id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateUserProfile(userId, fields) {
  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  if (fields.fullName !== undefined) {
    setClauses.push(`full_name = $${paramIndex++}`);
    values.push(fields.fullName);
  }
  if (fields.bio !== undefined) {
    setClauses.push(`bio = $${paramIndex++}`);
    values.push(fields.bio);
  }
  if (fields.photoUrl !== undefined) {
    setClauses.push(`photo_url = $${paramIndex++}`);
    values.push(fields.photoUrl);
  }
  if (fields.techLevel !== undefined) {
    setClauses.push(`tech_level = $${paramIndex++}`);
    values.push(fields.techLevel);
  }

  if (setClauses.length === 0) return null;

  values.push(userId);
  const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING id, full_name, email, photo_url, bio, tech_level`;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function updateUserPassword(userId, newHash) {
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
    [newHash, userId]
  );
  return result.rows[0] || null;
}

async function updateLastLogin(userId) {
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

// ====================================================================
// SESIONES / AUTENTICACIÓN
// ====================================================================

async function createSession(userId, token, expiresAt) {
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

async function getSessionByToken(token) {
  const result = await pool.query(
    `SELECT s.*, u.id AS user_id, u.full_name, u.email, u.tech_level
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW() AND u.account_status = $2`,
    [token, 'active']
  );
  return result.rows[0] || null;
}

async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

// ====================================================================
// ENTREVISTAS
// ====================================================================

async function createInterview(areaId, userId, difficultyLevel, type) {
  const result = await pool.query(
    `INSERT INTO interviews (area_id, user_id, difficulty_level, type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, area_id, user_id, difficulty_level, type, questions_total, started_at, finished_at, score`,
    [areaId, userId, difficultyLevel || 'mid', type || 'chat']
  );
  return result.rows[0];
}

async function finishInterview(interviewId, score, durationSeconds, totalQuestions) {
  const result = await pool.query(
    `UPDATE interviews
     SET finished_at = NOW(),
         score = $2,
         duration_seconds = $3,
         status = 'completed',
         questions_answered = COALESCE($4, (SELECT COUNT(*) FROM questions WHERE interview_id = $1))
     WHERE id = $1
     RETURNING *`,
    [interviewId, score, durationSeconds, totalQuestions || null]
  );
  return result.rows[0];
}

async function getInProgressInterview(userId, areaId) {
  const result = await pool.query(
    `SELECT id, area_id, user_id, difficulty_level, questions_total, started_at
     FROM interviews
     WHERE user_id = $1 AND area_id = $2 AND status = 'in_progress'
     ORDER BY started_at DESC LIMIT 1`,
    [userId, areaId]
  );
  return result.rows[0] || null;
}

async function getInterviewById(interviewId) {
  const result = await pool.query(
    `SELECT i.*, ta.name AS area_name, ta.slug AS area_slug
     FROM interviews i
     JOIN technical_areas ta ON ta.id = i.area_id
     WHERE i.id = $1`,
    [interviewId]
  );
  return result.rows[0] || null;
}

// ====================================================================
// PREGUNTAS Y RESPUESTAS
// ====================================================================

async function saveQuestion(interviewId, questionText, questionOrder) {
  const result = await pool.query(
    'INSERT INTO questions (interview_id, question_text, question_order) VALUES ($1, $2, $3) RETURNING *',
    [interviewId, questionText, questionOrder]
  );
  return result.rows[0];
}

async function saveAnswer(questionId, answerText) {
  const result = await pool.query(
    'INSERT INTO answers (question_id, answer_text) VALUES ($1, $2) RETURNING *',
    [questionId, answerText]
  );
  return result.rows[0];
}

async function saveAnswerWithFeedback(questionId, answerText, aiFeedback, aiScore) {
  const result = await pool.query(
    'INSERT INTO answers (question_id, answer_text, ai_feedback, ai_score) VALUES ($1, $2, $3, $4) RETURNING *',
    [questionId, answerText, aiFeedback, aiScore]
  );
  return result.rows[0];
}

async function getInterviewQuestions(interviewId) {
  const result = await pool.query(
    `SELECT q.id AS question_id, q.question_text, q.question_order,
            a.id AS answer_id, a.answer_text, a.ai_feedback, a.ai_score
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.interview_id = $1
     ORDER BY q.question_order`,
    [interviewId]
  );
  return result.rows;
}

async function getInterviewAnswers(interviewId) {
  const result = await pool.query(
    `SELECT q.question_text, a.answer_text, a.ai_feedback, a.ai_score, q.question_order
     FROM questions q
     JOIN answers a ON a.question_id = q.id
     WHERE q.interview_id = $1
     ORDER BY q.question_order`,
    [interviewId]
  );
  return result.rows;
}

async function getInterviewTranscript(interviewId) {
  const result = await pool.query(
    `SELECT q.id AS question_id, q.question_text, q.question_order,
            a.id AS answer_id, a.answer_text, a.ai_feedback, a.ai_score,
            a.created_at AS answered_at
     FROM questions q
     LEFT JOIN answers a ON a.question_id = q.id
     WHERE q.interview_id = $1
     ORDER BY q.question_order`,
    [interviewId]
  );
  return result.rows;
}

// ====================================================================
// EVALUACIONES
// ====================================================================

async function saveEvaluation(interviewId, feedback, score, strengths, improvements) {
  const result = await pool.query(
    `INSERT INTO evaluations (interview_id, feedback, score, strengths, improvements)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [interviewId, feedback, score, strengths, improvements]
  );
  return result.rows[0];
}

async function saveEvaluationFull(interviewId, score, feedback, strengths, improvements, criteriaScores, tags) {
  const result = await pool.query(
    `INSERT INTO evaluations (interview_id, score, feedback, strengths, improvements, criteria_scores, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [interviewId, score, feedback, strengths, improvements,
     criteriaScores ? JSON.stringify(criteriaScores) : null,
     tags || null]
  );
  return result.rows[0];
}

async function getEvaluationByInterviewId(interviewId) {
  const result = await pool.query(
    'SELECT * FROM evaluations WHERE interview_id = $1',
    [interviewId]
  );
  return result.rows[0] || null;
}

// ====================================================================
// HISTORIAL
// ====================================================================

async function getInterviewHistory(userId) {
  const result = await pool.query(
    `SELECT i.id, i.area_id, i.difficulty_level, i.started_at, i.finished_at,
            i.score, i.status, i.questions_answered, i.questions_total,
            ta.name AS area_name, ta.icon AS area_icon
     FROM interviews i
     JOIN technical_areas ta ON i.area_id = ta.id
     WHERE i.user_id = $1
     ORDER BY i.started_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows;
}

async function getHistoryPaginated(userId, filters) {
  const conditions = ['i.user_id = $1'];
  const values = [userId];
  let paramIndex = 2;

  if (filters.search) {
    conditions.push(`ta.name ILIKE $${paramIndex++}`);
    values.push(`%${filters.search}%`);
  }

  if (filters.areaId) {
    conditions.push(`i.area_id = $${paramIndex++}`);
    values.push(Number(filters.areaId));
  }

  if (filters.difficulty) {
    conditions.push(`i.difficulty_level = $${paramIndex++}`);
    values.push(filters.difficulty);
  }

  if (filters.type) {
    conditions.push(`i.type = $${paramIndex++}`);
    values.push(filters.type);
  }

  if (filters.status) {
    conditions.push(`i.status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.scoreMin !== undefined) {
    conditions.push(`i.score >= $${paramIndex++}`);
    values.push(Number(filters.scoreMin));
  }

  if (filters.scoreMax !== undefined) {
    conditions.push(`i.score <= $${paramIndex++}`);
    values.push(Number(filters.scoreMax));
  }

  const whereClause = conditions.join(' AND ');

  const sortColumns = {
    started_at: 'i.started_at',
    score: 'i.score',
    area: 'ta.name'
  };
  const sortCol = sortColumns[filters.sort] || 'i.started_at';
  const sortOrder = filters.order === 'asc' ? 'ASC' : 'DESC';

  const page = Math.max(1, Number(filters.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(filters.limit) || 10));
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM interviews i
     JOIN technical_areas ta ON i.area_id = ta.id
     WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(
      `SELECT i.id, i.area_id, i.difficulty_level, i.type, i.started_at, i.finished_at,
             i.score, i.status, i.questions_answered, i.questions_total,
             ta.name AS area_name, ta.icon AS area_icon
      FROM interviews i
      JOIN technical_areas ta ON i.area_id = ta.id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...values, limit, offset]
  );

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

async function getHistoryStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(i.id) AS total_interviews,
       COUNT(i.id) FILTER (WHERE i.status = 'completed') AS completed_interviews,
       ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed'), 1) AS avg_score,
       MAX(i.score) FILTER (WHERE i.status = 'completed') AS best_score,
       MIN(i.score) FILTER (WHERE i.status = 'completed') AS worst_score
     FROM interviews i
     WHERE i.user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

async function getSessionDetail(interviewId, userId) {
  const result = await pool.query(
    `SELECT i.id, i.area_id, i.difficulty_level, i.type, i.status, i.questions_answered,
            i.questions_total, i.score, i.duration_seconds,
            i.started_at, i.finished_at,
            ta.name AS area_name, ta.slug AS area_slug, ta.icon AS area_icon,
            e.id AS evaluation_id, e.feedback, e.strengths, e.improvements,
            e.criteria_scores, e.tags, e.score AS evaluation_score
     FROM interviews i
     JOIN technical_areas ta ON ta.id = i.area_id
     LEFT JOIN evaluations e ON e.interview_id = i.id
     WHERE i.id = $1 AND i.user_id = $2`,
    [interviewId, userId]
  );
  return result.rows[0] || null;
}

async function deleteInterview(interviewId, userId) {
  const result = await pool.query(
    'DELETE FROM interviews WHERE id = $1 AND user_id = $2 RETURNING id',
    [interviewId, userId]
  );
  return result.rows[0] || null;
}

// ====================================================================
// DASHBOARD
// ====================================================================

async function getDashboardStats(userId) {
  const result = await pool.query(
    `SELECT
        COUNT(i.id) AS total_interviews,
        COUNT(i.id) FILTER (WHERE i.status = 'completed') AS completed_interviews,
        COUNT(i.id) FILTER (WHERE i.status = 'completed' AND i.type = 'quiz') AS completed_quizzes,
        COUNT(i.id) FILTER (WHERE i.status = 'completed' AND i.type = 'chat') AS completed_chats,
        ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed'), 1) AS avg_score,
        MAX(i.score) FILTER (WHERE i.status = 'completed') AS best_score,
        MIN(i.score) FILTER (WHERE i.status = 'completed') AS worst_score
     FROM interviews i
     WHERE i.user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

async function getDashboardByArea(userId) {
  const result = await pool.query(
    `SELECT ta.name AS area_name, ta.icon AS area_icon,
            COUNT(i.id) AS total,
            ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed'), 1) AS avg_score,
            ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed' AND i.type = 'chat'), 1) AS chat_avg_score,
            ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed' AND i.type = 'quiz'), 1) AS quiz_avg_score,
            COUNT(i.id) FILTER (WHERE i.type = 'chat') AS chat_total,
            COUNT(i.id) FILTER (WHERE i.type = 'quiz') AS quiz_total
     FROM technical_areas ta
     LEFT JOIN interviews i ON i.area_id = ta.id AND i.user_id = $1
     GROUP BY ta.id, ta.name, ta.icon
     HAVING COUNT(i.id) > 0
     ORDER BY total DESC`,
    [userId]
  );
  return result.rows;
}

async function getScoreHistory(userId, limit) {
  const result = await pool.query(
    `SELECT i.score, i.started_at, i.finished_at, i.type, ta.name AS area_name
     FROM interviews i
     JOIN technical_areas ta ON ta.id = i.area_id
     WHERE i.user_id = $1 AND i.status = 'completed' AND i.score IS NOT NULL
     ORDER BY i.finished_at DESC
     LIMIT $2`,
    [userId, limit || 10]
  );
  return result.rows;
}

async function getInProgressInterviews(userId) {
  const result = await pool.query(
    `SELECT i.id, i.type, i.difficulty_level, i.started_at, i.questions_total,
            ta.name AS area_name, ta.id AS area_id,
            (SELECT COUNT(*) FROM questions q WHERE q.interview_id = i.id) AS questions_asked,
            (SELECT COUNT(*) FROM questions q JOIN answers a ON a.question_id = q.id WHERE q.interview_id = i.id) AS questions_answered
     FROM interviews i
     JOIN technical_areas ta ON ta.id = i.area_id
     WHERE i.user_id = $1 AND i.status = 'in_progress'
     ORDER BY i.started_at DESC`,
    [userId]
  );
  return result.rows;
}

// ====================================================================
// METAS Y RACHAS
// ====================================================================

async function getUserGoals(userId) {
  const result = await pool.query(
    `SELECT ug.weekly_target,
            COALESCE(wp.weekly_count, 0) AS weekly_progress
     FROM user_goals ug
     LEFT JOIN user_weekly_progress wp ON wp.user_id = ug.user_id
     WHERE ug.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function createDefaultGoals(userId) {
  const result = await pool.query(
    'INSERT INTO user_goals (user_id, weekly_target) VALUES ($1, 5) ON CONFLICT (user_id) DO NOTHING RETURNING *',
    [userId]
  );
  return result.rows[0] || null;
}

async function updateUserGoals(userId, weeklyTarget) {
  const result = await pool.query(
    `UPDATE user_goals
     SET weekly_target = $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING *`,
    [weeklyTarget, userId]
  );
  return result.rows[0] || null;
}

async function getCurrentStreak(userId) {
  const result = await pool.query(
    `WITH ranked AS (
       SELECT practice_date,
              practice_date - ROW_NUMBER() OVER (ORDER BY practice_date DESC)::INTEGER AS grp
       FROM practice_days
       WHERE user_id = $1
     ),
     latest_group AS (
       SELECT grp FROM ranked LIMIT 1
     )
     SELECT COUNT(*) AS current_streak
     FROM ranked
     WHERE grp = (SELECT grp FROM latest_group)`,
    [userId]
  );
  return result.rows[0] || { current_streak: 0 };
}

async function getLongestStreak(userId) {
  const result = await pool.query(
    `WITH ranked AS (
       SELECT practice_date,
              practice_date - ROW_NUMBER() OVER (ORDER BY practice_date)::INTEGER AS grp
       FROM practice_days
       WHERE user_id = $1
     )
     SELECT COUNT(*) AS streak_days
     FROM ranked
     GROUP BY grp
     ORDER BY streak_days DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || { streak_days: 0 };
}

async function getLastPracticeDate(userId) {
  const result = await pool.query(
    `SELECT practice_date FROM practice_days
     WHERE user_id = $1
     ORDER BY practice_date DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function recordPracticeDay(userId, practiceDate) {
  const result = await pool.query(
    'INSERT INTO practice_days (user_id, practice_date) VALUES ($1, $2) ON CONFLICT (user_id, practice_date) DO NOTHING RETURNING *',
    [userId, practiceDate || new Date().toISOString().slice(0, 10)]
  );
  return result.rows[0] || null;
}

// ====================================================================
// RESTABLECER CONTRASEÑA
// ====================================================================

async function getRecentPasswordReset(userId, minutes) {
  const result = await pool.query(
    'SELECT id FROM password_resets WHERE user_id = $1 AND created_at > NOW() - make_interval(mins => $2) LIMIT 1',
    [userId, minutes || 5]
  );
  return result.rows[0] || null;
}

async function createPasswordReset(userId, token, expiresAt) {
  const result = await pool.query(
    'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, token, expiresAt]
  );
  return result.rows[0];
}

async function getPasswordResetByToken(token) {
  const result = await pool.query(
    'SELECT * FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
    [token]
  );
  return result.rows[0] || null;
}

async function markPasswordResetUsed(token) {
  await pool.query('UPDATE password_resets SET used = true WHERE token = $1', [token]);
}

// ====================================================================
// VERIFICACION DE EMAIL
// ====================================================================

async function createEmailVerification(userId, token, expiresAt) {
  const result = await pool.query(
    'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, token, expiresAt]
  );
  return result.rows[0];
}

async function getEmailVerificationByToken(token) {
  const result = await pool.query(
    'SELECT * FROM email_verifications WHERE token = $1 AND used = false AND expires_at > NOW()',
    [token]
  );
  return result.rows[0] || null;
}

async function markEmailVerificationUsed(token) {
  await pool.query('UPDATE email_verifications SET used = true WHERE token = $1', [token]);
}

async function verifyUserEmail(userId) {
  const result = await pool.query(
    'UPDATE users SET email_verified = true, account_status = \'active\' WHERE id = $1 RETURNING id, full_name, email',
    [userId]
  );
  return result.rows[0] || null;
}

async function getEmailVerificationByUserId(userId) {
  const result = await pool.query(
    'SELECT * FROM email_verifications WHERE user_id = $1 AND used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}

async function markOldEmailVerificationsUsed(userId) {
  await pool.query(
    'UPDATE email_verifications SET used = true WHERE user_id = $1 AND used = false',
    [userId]
  );
}

// ====================================================================
// NOTIFICACIONES
// ====================================================================

async function createNotification(userId, type, title, message, link) {
  const result = await pool.query(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, type || 'system', title, message || '', link || null]
  );
  return result.rows[0];
}

async function getNotifications(userId, limit, offset) {
  const result = await pool.query(
    `SELECT id, type, title, message, link, read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit || 20, offset || 0]
  );
  return result.rows;
}

async function countNotifications(userId) {
  const result = await pool.query(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = $1',
    [userId]
  );
  return parseInt(result.rows[0].total, 10);
}

async function getUnreadNotificationCount(userId) {
  const result = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = false',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

async function markNotificationRead(notificationId, userId) {
  const result = await pool.query(
    'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [notificationId, userId]
  );
  return result.rows[0] || null;
}

async function markAllNotificationsRead(userId) {
  await pool.query(
    'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false',
    [userId]
  );
}

// ====================================================================
// QUIZ (multiple choice, respaldo para IA agotada)
// ====================================================================

async function getQuizQuestions(areaId, difficulty, limit) {
  const result = await pool.query(
    `SELECT id, question_text, options, difficulty
     FROM quiz_questions
     WHERE area_id = $1 AND difficulty = $2
     ORDER BY RANDOM()
     LIMIT $3`,
    [areaId, difficulty, limit || 5]
  );
  return result.rows;
}

// Cross-difficulty fallback: intenta la dificultad preferida primero,
// completa con otras dificultades del mismo area si no hay suficientes
async function getQuizQuestionsWithFallback(areaId, difficulty, limit) {
  const all = await pool.query(
    `SELECT id, question_text, options, difficulty
     FROM quiz_questions
     WHERE area_id = $1
     ORDER BY RANDOM()`,
    [areaId]
  );

  var preferred = all.rows.filter(function (q) { return q.difficulty === difficulty; });
  var other = all.rows.filter(function (q) { return q.difficulty !== difficulty; });

  // Tomar maximas posibles de la dificultad preferida, completar con otras
  var selected = preferred.slice(0, limit);
  if (selected.length < limit) {
    selected = selected.concat(other.slice(0, limit - selected.length));
  }

  // Shuffle final con Fisher-Yates
  for (var i = selected.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = selected[i];
    selected[i] = selected[j];
    selected[j] = temp;
  }

  return selected;
}

async function getQuizQuestionById(id) {
  const result = await pool.query(
    'SELECT id, area_id, question_text, options, correct_answer, explanation, difficulty FROM quiz_questions WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

async function saveQuizEvaluation(interviewId, score, resultsJson, correctCount, totalQuestions) {
  var criteriaScores = {
    precision: score, claridad: score, profundidad: score, comunicacion: score,
    quizResults: resultsJson || []
  };
  const result = await pool.query(
    `INSERT INTO evaluations (interview_id, score, feedback, strengths, improvements, criteria_scores, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [interviewId, score,
      'Cuestionario completado. ' + correctCount + ' de ' + totalQuestions + ' correctas.',
      correctCount >= Math.ceil(totalQuestions / 2) ? 'Buen desempeno en el cuestionario.' : '',
      correctCount < Math.ceil(totalQuestions / 2) ? 'Repasar los conceptos fallidos.' : '',
      JSON.stringify(criteriaScores),
      ['Cuestionario', score >= 70 ? 'Aprobado' : 'Repaso necesario']
    ]
  );
  return result.rows[0];
}

async function updateInterviewFromQuiz(interviewId, score, correctCount, totalQuestions, durationSeconds) {
  const result = await pool.query(
    `UPDATE interviews
     SET finished_at = NOW(), score = $2, duration_seconds = $3,
         status = 'completed', questions_answered = $4, questions_total = $5
     WHERE id = $1
     RETURNING *`,
    [interviewId, score, durationSeconds, correctCount, totalQuestions]
  );
  return result.rows[0];
}

module.exports = {
  // Áreas
  getAreas,
  getAreaById,

  // Usuarios
  createUser,
  getUserByEmail,
  getUserById,
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  updateLastLogin,

  // Sesiones
  createSession,
  getSessionByToken,
  deleteSession,

  // Entrevistas
  createInterview,
  finishInterview,
  getInProgressInterview,
  getInterviewById,

  // Preguntas y respuestas
  saveQuestion,
  saveAnswer,
  saveAnswerWithFeedback,
  getInterviewQuestions,
  getInterviewAnswers,
  getInterviewTranscript,

  // Evaluaciones
  saveEvaluation,
  saveEvaluationFull,
  saveQuizEvaluation,
  getEvaluationByInterviewId,

  // Historial
  getInterviewHistory,
  getHistoryPaginated,
  getHistoryStats,
  getSessionDetail,
  deleteInterview,

  // Verificacion de email
  createEmailVerification,
  getEmailVerificationByToken,
  markEmailVerificationUsed,
  verifyUserEmail,
  getEmailVerificationByUserId,
  markOldEmailVerificationsUsed,

  // Dashboard
  getDashboardStats,
  getDashboardByArea,
  getScoreHistory,
  getInProgressInterviews,

  // Metas y rachas
  getUserGoals,
  createDefaultGoals,
  updateUserGoals,
  getCurrentStreak,
  getLongestStreak,
  getLastPracticeDate,
  recordPracticeDay,

  // Restablecer contraseña
  getRecentPasswordReset,
  createPasswordReset,
  getPasswordResetByToken,
  markPasswordResetUsed,

  // Notificaciones
  createNotification,
  getNotifications,
  countNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,

  // Quiz
  getQuizQuestions,
  getQuizQuestionsWithFallback,
  getQuizQuestionById,
  saveQuizEvaluation,
  updateInterviewFromQuiz
};
