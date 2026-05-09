const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const API_KEY = process.env.API_KEY;
const MODEL = 'nvidia/nemotron-nano-9b-v2:free';

function callOpenRouter(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: messages
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Entrevistas Tecnicas'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message || 'Error de OpenRouter'));
          } else if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content.trim());
          } else {
            reject(new Error('Respuesta inesperada de OpenRouter'));
          }
        } catch (e) {
          reject(new Error(`Error parseando respuesta: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Error de red: ${e.message}`)));
    req.write(body);
    req.end();
  });
}

async function testConnection() {
  const messages = [
    { role: 'user', content: 'Responde SOLO con la palabra: OK' }
  ];
  const response = await callOpenRouter(messages);
  return response.includes('OK');
}

function difficultyPrompt(difficulty) {
  const prompts = {
    junior: 'basico, sobre conceptos fundamentales y sintaxis',
    mid: 'intermedio, sobre patrones de diseno, optimizacion y buenas practicas',
    senior: 'avanzado, sobre escalabilidad, trade-offs, arquitectura y diseno de sistemas'
  };
  return prompts[difficulty] || prompts.mid;
}

async function generateQuestion(areaName, difficulty) {
  const level = difficulty || 'mid';
  const levelDesc = difficultyPrompt(level);

  const messages = [
    {
      role: 'system',
      content: `Eres un entrevistador tecnico profesional. Genera preguntas claras, relevantes y de nivel ${level} (${levelDesc}). Responde UNICAMENTE con la pregunta, sin introducciones ni explicaciones adicionales. No uses markdown. Maximo 3 oraciones.`
    },
    {
      role: 'user',
      content: `Genera una pregunta tecnica de nivel ${level} sobre ${areaName}. La pregunta debe evaluar conocimiento practico de ${levelDesc}. Solo responde con la pregunta.`
    }
  ];
  return callOpenRouter(messages);
}

async function generateFirstQuestion(areaName, difficulty) {
  const level = difficulty || 'mid';
  const levelDesc = difficultyPrompt(level);

  const messages = [
    {
      role: 'system',
      content: `Eres un entrevistador tecnico profesional. Genera preguntas de nivel ${level} (${levelDesc}). Esta es la PRIMERA pregunta de la entrevista, debe ser una pregunta de calentamiento que evalue conocimientos fundamentales del area. Responde UNICAMENTE con la pregunta, sin introducciones ni explicaciones adicionales. No uses markdown.`
    },
    {
      role: 'user',
      content: `Genera la PRIMERA pregunta de una entrevista tecnica de nivel ${level} sobre ${areaName}. Debe ser introductoria, sobre ${levelDesc}. Solo responde con la pregunta.`
    }
  ];
  return callOpenRouter(messages);
}

async function generateFollowUpQuestion(areaName, difficulty, previousAnswer) {
  const level = difficulty || 'mid';
  const levelDesc = difficultyPrompt(level);

  const messages = [
    {
      role: 'system',
      content: `Eres un entrevistador tecnico profesional. Genera preguntas de nivel ${level} (${levelDesc}). Adapta la dificultad segun la calidad de la respuesta anterior. Responde UNICAMENTE con la pregunta, sin introducciones. No uses markdown.`
    },
    {
      role: 'user',
      content: `La respuesta anterior del candidato fue: "${previousAnswer}". Genera una pregunta de seguimiento sobre ${areaName} de nivel ${level}. Si la respuesta fue buena, profundiza mas. Si fue debil, haz una pregunta relacionada mas accesible. Solo responde con la pregunta.`
    }
  ];
  return callOpenRouter(messages);
}

async function evaluateAnswer(question, answer, areaName) {
  const messages = [
    {
      role: 'system',
      content: 'Eres un evaluador tecnico profesional. Evalua respuestas de entrevistas. Responde UNICAMENTE en formato JSON valido. No uses markdown. No incluyas texto fuera del JSON.'
    },
    {
      role: 'user',
      content: `Evalua la siguiente respuesta para una entrevista de ${areaName}.

Pregunta: "${question}"
Respuesta: "${answer}"

Evalua en estos criterios (1-10 cada uno):
- claridad
- precision tecnica
- profundidad

Devuelve UNICAMENTE un JSON con este formato exacto:
{"score": <numero 0-100>, "feedback": "<texto con feedback detallado>"}

Donde score es el promedio de los 3 criterios multiplicado por 3.33 para escalarlo a 100.`
    }
  ];
  const response = await callOpenRouter(messages);
  try {
    const cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      score: 0,
      feedback: `Error procesando evaluacion. Respuesta cruda: ${response.substring(0, 500)}`
    };
  }
}

async function generateFinalEvaluation(questionsAndAnswers, areaName) {
  const qaText = questionsAndAnswers
    .map((qa, i) => `Pregunta ${i + 1}: ${qa.question}\nRespuesta ${i + 1}: ${qa.answer}`)
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content: 'Eres un evaluador tecnico senior. Evalua entrevistas completas. Responde UNICAMENTE en formato JSON valido. No uses markdown. No incluyas ni una sola palabra fuera del JSON.'
    },
    {
      role: 'user',
      content: `Evalua esta entrevista completa de ${areaName}:

${qaText}

Proporciona una evaluacion general con los siguientes campos:
1. "score": puntuacion global (numero 0-100)
2. "feedback": evaluacion completa en texto (3-5 oraciones)
3. "strengths": fortalezas identificadas del candidato
4. "improvements": areas de mejora sugeridas
5. "criteriaScores": objeto JSON con puntuaciones por competencia (0-100 cada una):
   - "precision": precision tecnica de las respuestas
   - "claridad": claridad en la comunicacion
   - "profundidad": profundidad del conocimiento demostrado
   - "comunicacion": capacidad de expresar ideas tecnicas
6. "tags": array de strings con 3-5 etiquetas de habilidades demostradas (ej: ["React Hooks", "Arquitectura Limpia"])

Responde UNICAMENTE con este JSON exacto:
{"score": <numero>, "feedback": "<texto>", "strengths": "<texto>", "improvements": "<texto>", "criteriaScores": {"precision": <numero>, "claridad": <numero>, "profundidad": <numero>, "comunicacion": <numero>}, "tags": ["<tag1>", "<tag2>", "<tag3>"]}`
    }
  ];
  const response = await callOpenRouter(messages);
  try {
    const cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      score: 50,
      feedback: `Evaluacion generada. ${response.substring(0, 500)}`,
      strengths: 'No se pudo determinar',
      improvements: 'Revisar respuestas',
      criteriaScores: { precision: 50, claridad: 50, profundidad: 50, comunicacion: 50 },
      tags: ['General']
    };
  }
}

module.exports = {
  testConnection,
  generateQuestion,
  generateFirstQuestion,
  generateFollowUpQuestion,
  evaluateAnswer,
  generateFinalEvaluation
};
