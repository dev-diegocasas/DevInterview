const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  const result = await pool.query('SELECT 1 AS alive');
  console.log('Conexion a Neon PostgreSQL exitosa:', result.rows[0]);
  return result.rows[0];
}

module.exports = { pool, testConnection };
