const { pool } = require('./connection');
const fs = require('fs');
const path = require('path');

async function setupDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
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
