const { parseRequestBody, sendJSON, extractToken } = require('./helpers');
const { hashPassword, verifyPassword, generateToken } = require('../services/auth');
const { sendPasswordResetEmail, sendVerificationEmail } = require('../services/email');
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
  markPasswordResetUsed,
  createEmailVerification,
  getEmailVerificationByToken,
  markEmailVerificationUsed,
  verifyUserEmail,
  markOldEmailVerificationsUsed,
  getEmailVerificationByUserId
} = require('../db/queries');

const SESSION_DAYS = 7;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

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
      if (!existing.email_verified) {
        // Reenviar verificacion si ya existe pero no esta verificada
        var existingToken = await getEmailVerificationByUserId(existing.id);
        if (!existingToken) {
          try { await sendVerificationEmail(existing.email, existing.full_name, 'dummy'); } catch (e) {}
          const resendToken = generateToken();
          const resendExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
          await createEmailVerification(existing.id, resendToken, resendExpiresAt);
          await sendVerificationEmail(existing.email, existing.full_name, resendToken);
        }
        return sendJSON(res, 200, {
          success: true,
          data: { message: 'Esta cuenta no esta verificada. Te hemos enviado un nuevo enlace de verificacion a tu correo.' }
        });
      }
      return sendJSON(res, 409, { success: false, error: 'El email ya esta registrado' });
    }

    const passwordHash = hashPassword(password);
    const user = await createUser(fullName, email, passwordHash);

    // Generar token de verificacion
    const verificationToken = generateToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    await createEmailVerification(user.id, verificationToken, expiresAt);

    const emailResult = await sendVerificationEmail(user.email, user.full_name, verificationToken);

    if (emailResult.sent) {
      sendJSON(res, 201, {
        success: true,
        data: {
          message: 'Cuenta creada. Revisa tu correo para verificar tu cuenta. El enlace expira en 24 horas.',
          email: user.email
        }
      });
    } else {
      var smtpReason = emailResult.reason || 'Error desconocido';
      console.error('[Register] SMTP fallo para ' + user.email + ': ' + smtpReason);
      sendJSON(res, 201, {
        success: true,
        data: {
          message: 'Cuenta creada pero no se pudo enviar el correo de verificacion. Contacta al soporte.',
          email: user.email
        }
      });
    }
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

    if (!user.email_verified) {
      return sendJSON(res, 403, { success: false, error: 'Cuenta no verificada. Revisa tu correo para activar tu cuenta.' });
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

async function verifyEmail(req, res) {
  try {
    var parsedUrl = require('url').parse(req.url, true);
    var token = parsedUrl.query.token;

    if (!token) {
      return sendJSON(res, 400, { success: false, error: 'Token de verificacion requerido' });
    }

    const verification = await getEmailVerificationByToken(token);
    if (!verification) {
      return sendJSON(res, 400, { success: false, error: 'Token invalido o expirado' });
    }

    await verifyUserEmail(verification.user_id);
    await markEmailVerificationUsed(token);

    sendJSON(res, 200, {
      success: true,
      data: { message: 'Correo verificado correctamente. Ahora puedes iniciar sesion.' }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

async function resendVerification(req, res) {
  try {
    const body = await parseRequestBody(req);
    const { email } = body;

    if (!email) {
      return sendJSON(res, 400, { success: false, error: 'Email es requerido' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return sendJSON(res, 200, {
        success: true,
        data: { message: 'Si el email existe y no esta verificado, recibiras un nuevo enlace.' }
      });
    }

    if (user.email_verified) {
      return sendJSON(res, 200, {
        success: true,
        data: { message: 'Esta cuenta ya esta verificada. Puedes iniciar sesion.' }
      });
    }

    // Invalidar tokens anteriores
    await markOldEmailVerificationsUsed(user.id);

    var newToken = generateToken();
    var expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    await createEmailVerification(user.id, newToken, expiresAt);

    var emailResult = await sendVerificationEmail(user.email, user.full_name, newToken);

    if (emailResult.sent) {
      sendJSON(res, 200, {
        success: true,
        data: { message: 'Te hemos enviado un nuevo enlace de verificacion a ' + user.email }
      });
    } else {
      var smtpReason = emailResult.reason || 'Error desconocido';
      console.error('[ResendVerification] SMTP fallo para ' + user.email + ': ' + smtpReason);
      sendJSON(res, 500, { success: false, error: 'No se pudo enviar el correo. ' + smtpReason });
    }
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

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

module.exports = { register, login, logout, me, requireAuth, forgotPassword, resetPassword, verifyEmail, resendVerification };
