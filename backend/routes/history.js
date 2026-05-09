const { requireAuth } = require('./auth');
const { sendJSON, parseQueryParams } = require('./helpers');
const url = require('url');

async function authGuard(req, res) {
  const session = await requireAuth(req);
  if (!session) {
    sendJSON(res, 401, { success: false, error: 'No autorizado. Inicia sesion.' });
    return null;
  }
  return session;
}

async function historyRoute(req, res) {
  const { getInterviewHistory, getHistoryPaginated } = require('../db/queries');

  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const parsedUrl = url.parse(req.url, true);
    const filters = parseQueryParams(parsedUrl);

    if (filters.page || filters.limit || filters.search || filters.areaId || filters.difficulty || filters.scoreMin || filters.scoreMax) {
      const result = await getHistoryPaginated(session.user_id, filters);
      return sendJSON(res, 200, { success: true, data: result.data, pagination: result.pagination });
    }

    const history = await getInterviewHistory(session.user_id);
    sendJSON(res, 200, { success: true, data: history });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function deleteInterviewRoute(req, res) {
  const { deleteInterview } = require('../db/queries');

  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const urlParts = req.url.split('/');
    const interviewId = urlParts[urlParts.length - 1];

    if (!interviewId || isNaN(Number(interviewId))) {
      return sendJSON(res, 400, { success: false, error: 'ID de entrevista invalido' });
    }

    const deleted = await deleteInterview(Number(interviewId), session.user_id);
    if (!deleted) {
      return sendJSON(res, 404, { success: false, error: 'Entrevista no encontrada' });
    }

    sendJSON(res, 200, { success: true, data: { message: 'Entrevista eliminada' } });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function historyStatsRoute(req, res) {
  const { getHistoryStats } = require('../db/queries');

  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const stats = await getHistoryStats(session.user_id);
    sendJSON(res, 200, { success: true, data: stats });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function sessionDetailRoute(req, res) {
  const { getSessionDetail, getInterviewTranscript } = require('../db/queries');

  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const urlParts = req.url.split('/');
    const interviewId = urlParts[urlParts.length - 1];

    if (!interviewId || isNaN(Number(interviewId))) {
      return sendJSON(res, 400, { success: false, error: 'ID de entrevista invalido' });
    }

    const detail = await getSessionDetail(Number(interviewId), session.user_id);
    if (!detail) {
      return sendJSON(res, 404, { success: false, error: 'Entrevista no encontrada' });
    }

    const transcript = await getInterviewTranscript(Number(interviewId));

    sendJSON(res, 200, {
      success: true,
      data: {
        session: detail,
        transcript
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { historyRoute, deleteInterviewRoute, historyStatsRoute, sessionDetailRoute };
