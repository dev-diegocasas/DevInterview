function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', (e) => reject(e));
  });
}

function parseQueryParams(parsedUrl) {
  const params = parsedUrl.query || {};
  return {
    page: params.page,
    limit: params.limit,
    search: params.search,
    areaId: params.areaId,
    difficulty: params.difficulty,
    status: params.status,
    scoreMin: params.scoreMin,
    scoreMax: params.scoreMax,
    sort: params.sort,
    order: params.order
  };
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function extractToken(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

function getPathSegments(parsedUrl) {
  return parsedUrl.pathname.replace(/^\/+|\/+$/g, '').split('/');
}

module.exports = { parseRequestBody, parseQueryParams, sendJSON, extractToken, getPathSegments };
