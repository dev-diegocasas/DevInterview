const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./db/connection');
const { setupDatabase } = require('./db/setup');
const { areasRoute } = require('./routes/areas');
const { startInterview, submitAnswer, finishInterviewRoute } = require('./routes/interview');
const { historyRoute, deleteInterviewRoute } = require('./routes/history');
const { register, login, logout, me } = require('./routes/auth');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
}

function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer(async (req, res) => {
  setCORSHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    return register(req, res);
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    return login(req, res);
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    return logout(req, res);
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    return me(req, res);
  }

  if (pathname === '/api/areas' && req.method === 'GET') {
    return areasRoute(req, res);
  }

  if (pathname === '/api/interview/start' && req.method === 'POST') {
    return startInterview(req, res);
  }

  if (pathname === '/api/interview/answer' && req.method === 'POST') {
    return submitAnswer(req, res);
  }

  if (pathname === '/api/interview/finish' && req.method === 'POST') {
    return finishInterviewRoute(req, res);
  }

  if (pathname === '/api/history' && req.method === 'GET') {
    return historyRoute(req, res);
  }

  if (pathname.startsWith('/api/history/') && req.method === 'DELETE') {
    return deleteInterviewRoute(req, res);
  }

  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Ruta API no encontrada' }));
    return;
  }

  let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(FRONTEND_DIR, 'index.html');
    }
    serveStaticFile(res, filePath);
  });
});

async function start() {
  try {
    console.log('Verificando conexion a la base de datos...');
    await testConnection();
    await setupDatabase();
    console.log('Base de datos lista.');

    server.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

start();
