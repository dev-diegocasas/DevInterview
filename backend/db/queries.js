const { pool } = require('./connection');

async function getAreas() {
  const result = await pool.query('SELECT id, name, description, slug FROM technical_areas WHERE is_active = true ORDER BY id');
  return result.rows;
}

async function getAreaById(id) {
  const result = await pool.query('SELECT id, name, description, slug FROM technical_areas WHERE id = $1', [id]);
  return result.rows[0] || null;
}

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
  const result = await pool.query('SELECT id, full_name, email, photo_url, bio, tech_level, account_status, created_at FROM users WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function updateLastLogin(userId) {
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}

async function createSession(userId, token, expiresAt) {
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

async function getSessionByToken(token) {
  const result = await pool.query(
    'SELECT s.*, u.id AS user_id, u.full_name, u.email, u.tech_level FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = $1 AND s.expires_at > NOW() AND u.account_status = $2',
    [token, 'active']
  );
  return result.rows[0] || null;
}

async function deleteSession(token) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

async function createInterview(areaId, userId) {
  const result = await pool.query(
    'INSERT INTO interviews (area_id, user_id) VALUES ($1, $2) RETURNING id, area_id, user_id, started_at, finished_at, score',
    [areaId, userId]
  );
  return result.rows[0];
}

async function finishInterview(interviewId, score) {
  const result = await pool.query(
    "UPDATE interviews SET finished_at = NOW(), score = $2, status = 'completed', questions_answered = (SELECT COUNT(*) FROM questions WHERE interview_id = $1) WHERE id = $1 RETURNING *",
    [interviewId, score]
  );
  return result.rows[0];
}

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

async function saveEvaluation(interviewId, feedback, score, strengths, improvements) {
  const result = await pool.query(
    'INSERT INTO evaluations (interview_id, feedback, score, strengths, improvements) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [interviewId, feedback, score, strengths, improvements]
  );
  return result.rows[0];
}

async function getInterviewHistory(userId) {
  const result = await pool.query(`
    SELECT i.id, i.area_id, i.started_at, i.finished_at, i.score, i.status, ta.name AS area_name
    FROM interviews i
    JOIN technical_areas ta ON i.area_id = ta.id
    WHERE i.user_id = $1
    ORDER BY i.started_at DESC
    LIMIT 50
  `, [userId]);
  return result.rows;
}

async function getInProgressInterview(userId, areaId) {
  const result = await pool.query(
    "SELECT id, area_id, user_id, started_at FROM interviews WHERE user_id = $1 AND area_id = $2 AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1",
    [userId, areaId]
  );
  return result.rows[0] || null;
}

async function getInterviewQuestions(interviewId) {
  const result = await pool.query(`
    SELECT q.id AS question_id, q.question_text, q.question_order, a.id AS answer_id, a.answer_text
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    WHERE q.interview_id = $1
    ORDER BY q.question_order
  `, [interviewId]);
  return result.rows;
}

async function deleteInterview(interviewId, userId) {
  const result = await pool.query(
    'DELETE FROM interviews WHERE id = $1 AND user_id = $2 RETURNING id',
    [interviewId, userId]
  );
  return result.rows[0] || null;
}

async function getInterviewAnswers(interviewId) {
  const result = await pool.query(`
    SELECT q.question_text, a.answer_text, q.question_order
    FROM questions q
    JOIN answers a ON a.question_id = q.id
    WHERE q.interview_id = $1
    ORDER BY q.question_order
  `, [interviewId]);
  return result.rows;
}

module.exports = {
  getAreas,
  getAreaById,
  createUser,
  getUserByEmail,
  getUserById,
  updateLastLogin,
  createSession,
  getSessionByToken,
  deleteSession,
  createInterview,
  finishInterview,
  saveQuestion,
  saveAnswer,
  saveEvaluation,
  getInterviewHistory,
  getInterviewAnswers,
  getInProgressInterview,
  getInterviewQuestions,
  deleteInterview
};
