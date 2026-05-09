const { parseRequestBody, sendJSON } = require('./helpers');
const { requireAuth } = require('./auth');
const { generateQuestion, generateFirstQuestion, generateFollowUpQuestion, evaluateAnswer, generateFinalEvaluation } = require('../services/ai');
const {
  getAreaById,
  createInterview,
  finishInterview,
  saveQuestion,
  saveAnswer,
  saveAnswerWithFeedback,
  saveEvaluationFull,
  getInProgressInterview,
  getInterviewQuestions,
  getInterviewAnswers,
  getInterviewTranscript,
  getInterviewById,
  recordPracticeDay,
  getQuizQuestions
} = require('../db/queries');

const MAX_QUESTIONS = 5;

async function tryChatMode(area, difficulty, userId) {
  try {
    var result = await generateFirstQuestion(area.name, difficulty);
    if (result.fromBank) {
      return {
        mode: 'chat', text: result.text,
        fromBank: true, rateLimited: result.rateLimited
      };
    }
    return { mode: 'chat', text: result.text, fromBank: false, rateLimited: false };
  } catch (aiError) {
    const questions = await getQuizQuestions(area.id, difficulty, MAX_QUESTIONS);
    if (questions.length > 0) {
      return {
        mode: 'quiz',
        quizData: {
          area: area.name,
          difficulty: difficulty,
          totalQuestions: questions.length,
          questions: questions.map(function (q) {
            return { id: q.id, text: q.question_text, options: q.options };
          })
        }
      };
    }
    throw aiError;
  }
}

async function tryQuizMode(area, difficulty, userId) {
  const questions = await getQuizQuestions(area.id, difficulty, MAX_QUESTIONS);
  if (questions.length > 0) {
    return {
      mode: 'quiz',
      quizData: {
        area: area.name,
        difficulty: difficulty,
        totalQuestions: questions.length,
        questions: questions.map(function (q) {
          return { id: q.id, text: q.question_text, options: q.options };
        })
      }
    };
  }
  throw new Error('No hay preguntas de quiz para esta area y dificultad');
}

async function authGuard(req, res) {
  const session = await requireAuth(req);
  if (!session) {
    sendJSON(res, 401, { success: false, error: 'No autorizado. Inicia sesion.' });
    return null;
  }
  return session;
}

async function startInterview(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const body = await parseRequestBody(req);
    const { areaId, difficultyLevel, mode } = body;

    if (!areaId) {
      return sendJSON(res, 400, { success: false, error: 'areaId es requerido' });
    }

    const chatMode = mode === 'quiz' ? 'quiz' : 'chat';
    const difficulty = difficultyLevel || session.tech_level || 'mid';
    if (!['junior', 'mid', 'senior'].includes(difficulty)) {
      return sendJSON(res, 400, { success: false, error: 'Nivel de dificultad invalido. Usa: junior, mid, senior' });
    }

    const area = await getAreaById(areaId);
    if (!area) {
      return sendJSON(res, 404, { success: false, error: 'Area no encontrada' });
    }

    // ── QUIZ MODE: directo sin IA ────────────────────
    if (chatMode === 'quiz') {
      const quizResult = await tryQuizMode(area, difficulty, session.user_id);
      return sendJSON(res, 200, {
        success: true, data: { quizMode: true, quiz: quizResult.quizData }
      });
    }

    // ── CHAT MODE: intenta IA, fallback a banco ─────
    const existing = await getInProgressInterview(session.user_id, areaId);
    if (existing) {
      const questions = await getInterviewQuestions(existing.id);
      const answered = questions.filter(q => q.answer_text);
      const unanswered = questions.filter(q => !q.answer_text);
      const qaPairs = answered.map(q => ({ question: q.question_text, answer: q.answer_text }));

      if (questions.length === 0) {
        const interview = await createInterview(areaId, session.user_id, difficulty);
        var aiResult = await tryChatMode(area, difficulty, session.user_id);
        if (aiResult.mode === 'quiz') {
          return sendJSON(res, 200, { success: true, data: { quizMode: true, quiz: aiResult.quizData } });
        }
        const question = await saveQuestion(interview.id, aiResult.text, 1);
        return sendJSON(res, 200, {
          success: true, data: {
            interviewId: interview.id, area: area.name, difficulty: difficulty,
            resumed: false, question: { id: question.id, text: aiResult.text, order: 1 },
            fromBank: aiResult.fromBank || false, rateLimited: aiResult.rateLimited || false
          }
        });
      }

      if (unanswered.length > 0) {
        const currentQ = unanswered[0];
        return sendJSON(res, 200, {
          success: true, data: {
            interviewId: existing.id, area: area.name,
            difficulty: existing.difficulty_level || difficulty,
            totalQuestions: existing.questions_total, resumed: true,
            questionsAndAnswers: qaPairs, questionNumber: answered.length + 1,
            currentQuestion: { id: currentQ.question_id, text: currentQ.question_text, order: currentQ.question_order }
          }
        });
      }

      const interview = await createInterview(areaId, session.user_id, difficulty);
      var aiResult = await tryChatMode(area, difficulty, session.user_id);
      if (aiResult.mode === 'quiz') {
        return sendJSON(res, 200, { success: true, data: { quizMode: true, quiz: aiResult.quizData } });
      }
      const question = await saveQuestion(interview.id, aiResult.text, 1);
      return sendJSON(res, 200, {
        success: true, data: {
          interviewId: interview.id, area: area.name, difficulty: difficulty,
          resumed: false, question: { id: question.id, text: aiResult.text, order: 1 },
          fromBank: aiResult.fromBank || false, rateLimited: aiResult.rateLimited || false
        }
      });
    }

    const interview = await createInterview(areaId, session.user_id, difficulty);
    var aiResult = await tryChatMode(area, difficulty, session.user_id);
    if (aiResult.mode === 'quiz') {
      return sendJSON(res, 200, { success: true, data: { quizMode: true, quiz: aiResult.quizData } });
    }
    const question = await saveQuestion(interview.id, aiResult.text, 1);
    sendJSON(res, 200, {
      success: true, data: {
        interviewId: interview.id, area: area.name, difficulty: difficulty,
        resumed: false, question: { id: question.id, text: aiResult.text, order: 1 },
        fromBank: aiResult.fromBank || false, rateLimited: aiResult.rateLimited || false
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function submitAnswer(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const body = await parseRequestBody(req);
    const { interviewId, questionId, answer, questionNumber, areaName, difficulty, previousAnswer } = body;

    if (!interviewId || !questionId || !answer) {
      return sendJSON(res, 400, { success: false, error: 'interviewId, questionId y answer son requeridos' });
    }

    const questions = await getInterviewQuestions(interviewId);
    const currentQuestion = questions.find(q => q.question_id === questionId);
    const questionText = currentQuestion ? currentQuestion.question_text : 'Pregunta';

    let aiEval = null;
    try {
      aiEval = await evaluateAnswer(questionText, answer, areaName || 'tecnologia');
    } catch (e) {
      aiEval = { score: null, feedback: null };
    }

    await saveAnswerWithFeedback(
      questionId,
      answer,
      aiEval.feedback || null,
      aiEval.score != null ? Math.round(aiEval.score) : null
    );

    const currentQ = questionNumber || 0;

    if (currentQ >= MAX_QUESTIONS) {
      sendJSON(res, 200, {
        success: true,
        data: { finished: true, interviewId }
      });
      return;
    }

    const lastAnswer = previousAnswer || answer;
    const diffLevel = difficulty || 'mid';
    const newQuestionText = await generateFollowUpQuestion(areaName || 'tecnologia', diffLevel, lastAnswer);
    const newQuestion = await saveQuestion(interviewId, newQuestionText, currentQ + 1);

    sendJSON(res, 200, {
      success: true,
      data: {
        finished: false,
        question: { id: newQuestion.id, text: newQuestionText, order: currentQ + 1 },
        lastFeedback: aiEval.score != null ? { score: Math.round(aiEval.score), feedback: aiEval.feedback } : null
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function finishInterviewRoute(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const body = await parseRequestBody(req);
    const { interviewId, areaId } = body;

    if (!interviewId) {
      return sendJSON(res, 400, { success: false, error: 'interviewId es requerido' });
    }

    const area = await getAreaById(areaId);
    const answers = await getInterviewAnswers(interviewId);

    if (answers.length === 0) {
      sendJSON(res, 200, {
        success: true,
        data: { score: 0, feedback: 'No se encontraron respuestas para evaluar.' }
      });
      return;
    }

    const qaPairs = answers.map(a => ({
      question: a.question_text,
      answer: a.answer_text
    }));

    const evaluation = await generateFinalEvaluation(qaPairs, area ? area.name : 'tecnologia');
    const finalScore = evaluation.score || 50;

    const interview = await getInterviewById(interviewId);
    let durationSeconds = null;
    if (interview && interview.started_at) {
      const started = new Date(interview.started_at).getTime();
      const now = Date.now();
      durationSeconds = Math.round((now - started) / 1000);
    }

    await finishInterview(interviewId, finalScore, durationSeconds);
    await saveEvaluationFull(
      interviewId,
      finalScore,
      evaluation.feedback || 'Evaluacion completada',
      evaluation.strengths || '',
      evaluation.improvements || '',
      evaluation.criteriaScores || null,
      evaluation.tags || null
    );
    await recordPracticeDay(session.user_id);

    sendJSON(res, 200, {
      success: true,
      data: {
        score: finalScore,
        feedback: evaluation.feedback || 'Evaluacion completada',
        strengths: evaluation.strengths || '',
        improvements: evaluation.improvements || '',
        criteriaScores: evaluation.criteriaScores || null,
        tags: evaluation.tags || null,
        durationSeconds
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function getInterviewDetailRoute(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const urlParts = require('url').parse(req.url, true).pathname.split('/');
    const interviewId = Number(urlParts[urlParts.length - 1]);

    if (!interviewId || isNaN(interviewId)) {
      return sendJSON(res, 400, { success: false, error: 'ID de entrevista invalido' });
    }

    const interview = await getInterviewById(interviewId);
    if (!interview || interview.user_id !== session.user_id) {
      return sendJSON(res, 404, { success: false, error: 'Entrevista no encontrada' });
    }

    const questions = await getInterviewQuestions(interviewId);

    sendJSON(res, 200, {
      success: true,
      data: { interview, questions }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function getInterviewTranscriptRoute(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const urlParts = require('url').parse(req.url, true).pathname.split('/');
    const interviewId = Number(urlParts[urlParts.length - 1]);

    if (!interviewId || isNaN(interviewId)) {
      return sendJSON(res, 400, { success: false, error: 'ID de entrevista invalido' });
    }

    const interview = await getInterviewById(interviewId);
    if (!interview || interview.user_id !== session.user_id) {
      return sendJSON(res, 404, { success: false, error: 'Entrevista no encontrada' });
    }

    const transcript = await getInterviewTranscript(interviewId);

    sendJSON(res, 200, {
      success: true,
      data: {
        interview: {
          id: interview.id,
          areaName: interview.area_name,
          difficulty: interview.difficulty_level,
          status: interview.status,
          score: interview.score,
          durationSeconds: interview.duration_seconds,
          startedAt: interview.started_at,
          finishedAt: interview.finished_at
        },
        transcript
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { startInterview, submitAnswer, finishInterviewRoute, getInterviewDetailRoute, getInterviewTranscriptRoute };
