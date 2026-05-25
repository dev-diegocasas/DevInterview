const { parseRequestBody, sendJSON, extractToken } = require('./helpers');
const { hashPassword, verifyPassword, generateToken } = require('../services/auth');
const { sendPasswordResetEmail } = require('../services/email');
const {
  createUser,
  getUserByEmail,
  updateLastLogin,
  createSession,
  getSessionByToken,
  deleteSession,
  getRecentPasswordReset,
  createPasswordReset,
  getPasswordResetByToken,
  markPasswordResetUsed
} = require('../db/queries');

const SESSION_DAYS = 7;

async function register(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { fullName, email, password } = body;

    if (!fullName || !email || !password) {
      return sendJSON(res, 400, { success: false, error: 'fullName, email y password son requeridos' });
    }

    if (password.length < 6) {
      return sendJSON(res, 400, { success: false, error: 'La password debe tener al menos 6 caracteres' });
    }

    if (!email.includes('@')) {
      return sendJSON(res, 400, { success: false, error: 'Email no valido' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return sendJSON(res, 409, { success: false, error: 'El email ya esta registrado' });
    }

    const passwordHash = hashPassword(password);
    const user = await createUser(fullName, email, passwordHash);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await createSession(user.id, token, expiresAt);
    await updateLastLogin(user.id);

    sendJSON(res, 201, {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          techLevel: user.tech_level
        }
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function login(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email, password } = body;

    if (!email || !password) {
      return sendJSON(res, 400, { success: false, error: 'Email y password son requeridos' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return sendJSON(res, 401, { success: false, error: 'Credenciales invalidas' });
    }

    if (user.account_status !== 'active') {
      return sendJSON(res, 403, { success: false, error: 'Cuenta inactiva' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return sendJSON(res, 401, { success: false, error: 'Credenciales invalidas' });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await createSession(user.id, token, expiresAt);
    await updateLastLogin(user.id);

    sendJSON(res, 200, {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          techLevel: user.tech_level
        }
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function logout(req, res) {
  try {
    const token = extractToken(req);
    if (token) {
      await deleteSession(token);
    }
    sendJSON(res, 200, { success: true, data: null });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function me(req, res) {
  try {
    const token = extractToken(req);
    if (!token) {
      return sendJSON(res, 401, { success: false, error: 'No autorizado' });
    }

    const session = await getSessionByToken(token);
    if (!session) {
      return sendJSON(res, 401, { success: false, error: 'Sesion expirada o invalida' });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        user: {
          id: session.user_id,
          fullName: session.full_name,
          email: session.email,
          techLevel: session.tech_level
        }
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function requireAuth(req) {
  const token = extractToken(req);
  if (!token) return null;
  const session = await getSessionByToken(token);
  return session || null;
}

const RESET_TOKEN_EXPIRY_HOURS = 1;

async function forgotPassword(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email } = body;

    if (!email) {
      return sendJSON(res, 400, { success: false, error: 'Email es requerido' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return sendJSON(res, 200, { success: true, data: { message: 'Si el email existe, recibiras un enlace de recuperacion.' } });
    }

    // Rate limiting: 5 min entre solicitudes
    const recent = await getRecentPasswordReset(user.id, 5);
    if (recent) {
      return sendJSON(res, 429, { success: false, error: 'Ya enviamos un enlace recientemente. Revisa tu correo o espera 5 minutos.' });
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    await createPasswordReset(user.id, resetToken, expiresAt);

    const emailResult = await sendPasswordResetEmail(user.email, user.full_name, resetToken);

    if (emailResult.sent) {
      sendJSON(res, 200, {
        success: true,
        data: {
          message: 'Te hemos enviado un enlace de recuperacion a ' + user.email
        }
      });
    } else {
      var smtpReason = emailResult.reason || 'Error desconocido';
      console.error('[ForgotPassword] SMTP fallo para ' + user.email + ': ' + smtpReason);
      sendJSON(res, 500, { success: false, error: 'No se pudo enviar el correo. ' + smtpReason });
    }
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function resetPassword(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return sendJSON(res, 400, { success: false, error: 'Token y nueva password son requeridos' });
    }

    if (newPassword.length < 6) {
      return sendJSON(res, 400, { success: false, error: 'La password debe tener al menos 6 caracteres' });
    }

    const reset = await getPasswordResetByToken(token);
    if (!reset) {
      return sendJSON(res, 400, { success: false, error: 'Token invalido o expirado' });
    }

    const { updateUserPassword } = require('../db/queries');
    const newHash = hashPassword(newPassword);
    await updateUserPassword(reset.user_id, newHash);
    await markPasswordResetUsed(token);

    sendJSON(res, 200, { success: true, data: { message: 'Password restablecida correctamente. Puedes iniciar sesion.' } });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

module.exports = { register, login, logout, me, requireAuth, forgotPassword, resetPassword };
