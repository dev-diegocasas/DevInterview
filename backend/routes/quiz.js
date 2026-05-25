const { parseRequestBody, sendJSON } = require('./helpers');
const { requireAuth } = require('./auth');

async function startQuizRoute(req, res) {
  const { getQuizQuestionsWithFallback, getAreaById, createInterview } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    const body = await parseRequestBody(req);
    const areaId = parseInt(body.areaId, 10);
    const difficulty = body.difficulty || 'mid';
    const limit = parseInt(body.limit, 10) || 5;

    if (!areaId) return sendJSON(res, 400, { success: false, error: 'areaId requerido' });

    const area = await getAreaById(areaId);
    if (!area) return sendJSON(res, 404, { success: false, error: 'Area no encontrada' });

    const questions = await getQuizQuestionsWithFallback(areaId, difficulty, limit);
    if (!questions || questions.length === 0) {
      return sendJSON(res, 404, { success: false, error: 'No hay preguntas de quiz para esta area y dificultad' });
    }

    const interview = await createInterview(areaId, session.user_id, difficulty, 'quiz');

    sendJSON(res, 200, {
      success: true,
      data: {
        interviewId: interview.id,
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
  const { getQuizQuestionById, saveQuizEvaluation, updateInterviewFromQuiz, recordPracticeDay } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    const body = await parseRequestBody(req);
    const { answers, area, difficulty, interviewId, durationSeconds } = body;

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

    // Guardar en historial si tenemos interviewId
    if (interviewId) {
      await updateInterviewFromQuiz(interviewId, score, correctCount, total, durationSeconds || null);
      await saveQuizEvaluation(interviewId, score, results, correctCount, total);
    }

    await recordPracticeDay(session.user_id);

    sendJSON(res, 200, {
      success: true,
      data: {
        score: score,
        correctCount: correctCount,
        totalQuestions: total,
        area: area || '',
        difficulty: difficulty || '',
        results: results,
        interviewId: interviewId || null
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { startQuizRoute, submitQuizRoute };