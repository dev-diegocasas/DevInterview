const { pool } = require('./connection');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    // Migraciones de esquemas existentes (ALTER TABLE ADD COLUMN IF NOT EXISTS)
    // Ejecutar ANTES del schema.sql para que las nuevas columnas existan
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active', 'inactive', 'pending'))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS email_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    console.log('Migraciones ejecutadas correctamente.');

    await pool.query(schema);
    console.log('Schema ejecutado correctamente.');

    // Cargar preguntas adicionales del quiz
    const seedPath = path.join(__dirname, 'seed-quiz-questions.sql');
    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await pool.query(seed);
      console.log('Seed de preguntas quiz cargado correctamente.');
    } else {
      console.log('Archivo seed-quiz-questions.sql no encontrado, se omite.');
    }
  } catch (error) {
    console.error('Error ejecutando schema:', error.message);
    throw error;
  }
}

module.exports = { setupDatabase };
