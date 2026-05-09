const { parseRequestBody, sendJSON } = require('./helpers');
const { requireAuth } = require('./auth');
const { hashPassword, verifyPassword } = require('../services/auth');
const { getUserByEmail, getUserProfile, updateUserProfile, updateUserPassword, updateUserGoals } = require('../db/queries');

async function authGuard(req, res) {
  const session = await requireAuth(req);
  if (!session) {
    sendJSON(res, 401, { success: false, error: 'No autorizado. Inicia sesion.' });
    return null;
  }
  return session;
}

async function getProfile(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const profile = await getUserProfile(session.user_id);
    if (!profile) {
      return sendJSON(res, 404, { success: false, error: 'Usuario no encontrado' });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        id: profile.id,
        fullName: profile.full_name,
        email: profile.email,
        photoUrl: profile.photo_url,
        bio: profile.bio,
        techLevel: profile.tech_level,
        weeklyTarget: parseInt(profile.weekly_target, 10) || 5
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function updateProfile(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const body = await parseRequestBody(req);
    const { fullName, bio, photoUrl, techLevel, weeklyTarget } = body;

    const updated = await updateUserProfile(session.user_id, {
      fullName,
      bio,
      photoUrl,
      techLevel
    });

    if (weeklyTarget !== undefined) {
      const target = parseInt(weeklyTarget, 10);
      if (target > 0 && target <= 30) {
        await updateUserGoals(session.user_id, target);
      }
    }

    if (!updated) {
      return sendJSON(res, 400, { success: false, error: 'No se realizaron cambios' });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        id: updated.id,
        fullName: updated.full_name,
        email: updated.email,
        photoUrl: updated.photo_url,
        bio: updated.bio,
        techLevel: updated.tech_level,
        weeklyTarget: weeklyTarget || 5
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function changePassword(req, res) {
  try {
    const session = await authGuard(req, res);
    if (!session) return;

    const body = await parseRequestBody(req);
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return sendJSON(res, 400, { success: false, error: 'currentPassword y newPassword son requeridos' });
    }

    if (newPassword.length < 6) {
      return sendJSON(res, 400, { success: false, error: 'La nueva password debe tener al menos 6 caracteres' });
    }

    const user = await getUserByEmail(session.email);
    if (!user) {
      return sendJSON(res, 404, { success: false, error: 'Usuario no encontrado' });
    }

    if (!verifyPassword(currentPassword, user.password_hash)) {
      return sendJSON(res, 400, { success: false, error: 'La password actual es incorrecta' });
    }

    const newHash = hashPassword(newPassword);
    await updateUserPassword(session.user_id, newHash);

    sendJSON(res, 200, { success: true, data: { message: 'Password actualizada correctamente' } });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { getProfile, updateProfile, changePassword };
