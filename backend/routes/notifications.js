const { requireAuth } = require('./auth');
const { sendJSON, parseQueryParams } = require('./helpers');
const url = require('url');

async function getNotificationsRoute(req, res) {
  const { getNotifications, countNotifications, getUnreadNotificationCount } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    var parsedUrl = url.parse(req.url, true);
    var params = parsedUrl.query;
    var limit = parseInt(params.limit, 10) || 20;
    var offset = parseInt(params.offset, 10) || 0;

    var [notifications, total, unread] = await Promise.all([
      getNotifications(session.user_id, limit, offset),
      countNotifications(session.user_id),
      getUnreadNotificationCount(session.user_id)
    ]);

    sendJSON(res, 200, {
      success: true,
      data: {
        notifications: notifications,
        total: total,
        unread: unread,
        limit: limit,
        offset: offset
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function getUnreadCountRoute(req, res) {
  const { getUnreadNotificationCount } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    var count = await getUnreadNotificationCount(session.user_id);

    sendJSON(res, 200, {
      success: true,
      data: { unread: count }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function markNotificationRead(req, res) {
  const { markNotificationRead } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    var urlParts = req.url.split('/');
    var notificationId = parseInt(urlParts[urlParts.length - 2], 10);

    if (!notificationId || isNaN(notificationId)) {
      return sendJSON(res, 400, { success: false, error: 'ID de notificacion invalido' });
    }

    var result = await markNotificationRead(notificationId, session.user_id);
    if (!result) {
      return sendJSON(res, 404, { success: false, error: 'Notificacion no encontrada' });
    }

    sendJSON(res, 200, { success: true, data: { message: 'Notificacion marcada como leida' } });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function markAllNotificationsRead(req, res) {
  const { markAllNotificationsRead } = require('../db/queries');

  try {
    const session = await requireAuth(req);
    if (!session) return sendJSON(res, 401, { success: false, error: 'No autorizado' });

    await markAllNotificationsRead(session.user_id);

    sendJSON(res, 200, { success: true, data: { message: 'Todas las notificaciones marcadas como leidas' } });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { getNotificationsRoute, getUnreadCountRoute, markNotificationRead, markAllNotificationsRead };
