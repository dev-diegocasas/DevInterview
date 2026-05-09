const { pool } = require('./connection');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(schema);
    console.log('Schema ejecutado correctamente.');
  } catch (error) {
    console.error('Error ejecutando schema:', error.message);
    throw error;
  }
}

module.exports = { setupDatabase };
