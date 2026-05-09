const { parseRequestBody, sendJSON } = require('./helpers');
const { requireAuth } = require('./auth');

async function getQuizRoute(req, res) {
  const { getQuizQuestions, getAreaById } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    const parsedUrl = require('url').parse(req.url, true);
    const areaId = parseInt(parsedUrl.query.areaId, 10);
    const difficulty = parsedUrl.query.difficulty || 'mid';
    const limit = parseInt(parsedUrl.query.limit, 10) || 5;

    if (!areaId) return sendJSON(res, 400, { success: false, error: 'areaId requerido' });

    const area = await getAreaById(areaId);
    if (!area) return sendJSON(res, 404, { success: false, error: 'Area no encontrada' });

    const questions = await getQuizQuestions(areaId, difficulty, limit);

    if (questions.length === 0) {
      return sendJSON(res, 404, { success: false, error: 'No hay preguntas de quiz para esta area y dificultad' });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        area: area.name,
        difficulty,
        totalQuestions: questions.length,
        questions: questions.map(function (q) {
          return { id: q.id, text: q.question_text, options: q.options };
        })
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function submitQuizRoute(req, res) {
  const { getQuizQuestionById } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    const body = await parseRequestBody(req);
    const { answers, area, difficulty } = body;

    if (!answers || !Array.isArray(answers)) {
      return sendJSON(res, 400, { success: false, error: 'answers requerido como array' });
    }

    var results = [];
    var correctCount = 0;

    for (var i = 0; i < answers.length; i++) {
      var a = answers[i];
      var question = await getQuizQuestionById(a.questionId);
      if (!question) continue;

      var isCorrect = a.selected === question.correct_answer;
      if (isCorrect) correctCount++;

      results.push({
        questionId: question.id,
        questionText: question.question_text,
        options: question.options,
        selected: a.selected,
        correctAnswer: question.correct_answer,
        isCorrect: isCorrect,
        explanation: question.explanation
      });
    }

    var total = results.length;
    var score = total > 0 ? Math.round((correctCount / total) * 100) : 0;

    const { recordPracticeDay } = require('../db/queries');
    await recordPracticeDay(session.user_id);

    sendJSON(res, 200, {
      success: true,
      data: {
        score: score,
        correctCount: correctCount,
        totalQuestions: total,
        area: area || '',
        difficulty: difficulty || '',
        results: results
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { getQuizRoute, submitQuizRoute };
