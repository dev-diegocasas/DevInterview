const { requireAuth } = require('./auth');
const { sendJSON } = require('./helpers');

async function historyRoute(req, res) {
  const { getInterviewHistory } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) {
      return sendJSON(res, 401, { success: false, error: 'No autorizado. Inicia sesion.' });
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
    const session = await requireAuth(req);
    if (!session) {
      return sendJSON(res, 401, { success: false, error: 'No autorizado. Inicia sesion.' });
    }

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

module.exports = { historyRoute, deleteInterviewRoute };
