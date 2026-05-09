const { parseRequestBody, sendJSON, extractToken } = require('./helpers');
const { hashPassword, verifyPassword, generateToken } = require('../services/auth');
const {
  createUser,
  getUserByEmail,
  updateLastLogin,
  createSession,
  getSessionByToken,
  deleteSession
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

module.exports = { register, login, logout, me, requireAuth };
