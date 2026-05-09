const { parseRequestBody, sendJSON } = require('./helpers');
const { requireAuth } = require('./auth');
const { generateQuestion, evaluateAnswer, generateFinalEvaluation } = require('../services/ai');
const {
  getAreaById,
  createInterview,
  finishInterview,
  saveQuestion,
  saveAnswer,
  saveEvaluation,
  getInProgressInterview,
  getInterviewQuestions
} = require('../db/queries');

const MAX_QUESTIONS = 5;

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
    const { areaId } = body;

    if (!areaId) {
      return sendJSON(res, 400, { success: false, error: 'areaId es requerido' });
    }

    const area = await getAreaById(areaId);
    if (!area) {
      return sendJSON(res, 404, { success: false, error: 'Area no encontrada' });
    }

    const existing = await getInProgressInterview(session.user_id, areaId);
    if (existing) {
      const questions = await getInterviewQuestions(existing.id);
      const answered = questions.filter(q => q.answer_text);
      const unanswered = questions.filter(q => !q.answer_text);
      const qaPairs = answered.map(q => ({ question: q.question_text, answer: q.answer_text }));

      if (questions.length === 0) {
        const interview = await createInterview(areaId, session.user_id);
        const questionText = await generateQuestion(area.name);
        const question = await saveQuestion(interview.id, questionText, 1);

        return sendJSON(res, 200, {
          success: true,
          data: {
            interviewId: interview.id,
            area: area.name,
            resumed: false,
            question: { id: question.id, text: questionText, order: 1 }
          }
        });
      }

      if (unanswered.length > 0) {
        const currentQ = unanswered[0];
        return sendJSON(res, 200, {
          success: true,
          data: {
            interviewId: existing.id,
            area: area.name,
            resumed: true,
            questionsAndAnswers: qaPairs,
            questionNumber: answered.length + 1,
            currentQuestion: { id: currentQ.question_id, text: currentQ.question_text, order: currentQ.question_order }
          }
        });
      }

      const interview = await createInterview(areaId, session.user_id);
      const questionText = await generateQuestion(area.name);
      const question = await saveQuestion(interview.id, questionText, 1);

      return sendJSON(res, 200, {
        success: true,
        data: {
          interviewId: interview.id,
          area: area.name,
          resumed: false,
          question: { id: question.id, text: questionText, order: 1 }
        }
      });
    }

    const interview = await createInterview(areaId, session.user_id);
    const questionText = await generateQuestion(area.name);
    const question = await saveQuestion(interview.id, questionText, 1);

    sendJSON(res, 200, {
      success: true,
      data: {
        interviewId: interview.id,
        area: area.name,
        resumed: false,
        question: { id: question.id, text: questionText, order: 1 }
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
    const { interviewId, questionId, answer, questionNumber, areaName } = body;

    if (!interviewId || !questionId || !answer) {
      return sendJSON(res, 400, { success: false, error: 'interviewId, questionId y answer son requeridos' });
    }

    await saveAnswer(questionId, answer);

    const currentQ = questionNumber || 0;

    if (currentQ >= MAX_QUESTIONS) {
      sendJSON(res, 200, {
        success: true,
        data: { finished: true, interviewId }
      });
      return;
    }

    const newQuestionText = await generateQuestion(areaName || 'tecnologia');
    const newQuestion = await saveQuestion(interviewId, newQuestionText, currentQ + 1);

    sendJSON(res, 200, {
      success: true,
      data: {
        finished: false,
        question: { id: newQuestion.id, text: newQuestionText, order: currentQ + 1 }
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

    const { getInterviewAnswers, getAreaById } = require('../db/queries');
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

    await finishInterview(interviewId, finalScore);
    await saveEvaluation(
      interviewId,
      evaluation.feedback || 'Evaluacion completada',
      finalScore,
      evaluation.strengths || '',
      evaluation.improvements || ''
    );

    sendJSON(res, 200, {
      success: true,
      data: {
        score: finalScore,
        feedback: evaluation.feedback || 'Evaluacion completada',
        strengths: evaluation.strengths || '',
        improvements: evaluation.improvements || ''
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { startInterview, submitAnswer, finishInterviewRoute };
