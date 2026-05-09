async function areasRoute(req, res) {
  const { getAreas } = require('../db/queries');

  try {
    const areas = await getAreas();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: areas }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

module.exports = { areasRoute };
