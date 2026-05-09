const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const API_KEY = process.env.API_KEY;
const MODEL = 'google/gemini-2.0-flash-exp:free';

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

async function generateQuestion(areaName) {
  const messages = [
    {
      role: 'system',
      content: 'Eres un entrevistador tecnico profesional. Genera preguntas claras, relevantes y de nivel intermedio. Responde UNICAMENTE con la pregunta, sin introducciones ni explicaciones adicionales. No uses markdown. Maximo 2 oraciones.'
    },
    {
      role: 'user',
      content: `Genera una pregunta tecnica de nivel intermedio sobre ${areaName}. La pregunta debe evaluar conocimiento practico. Solo responde con la pregunta.`
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
      content: 'Eres un evaluador tecnico senior. Evalua entrevistas completas. Responde UNICAMENTE en formato JSON valido. No uses markdown.'
    },
    {
      role: 'user',
      content: `Evalua esta entrevista completa de ${areaName}:

${qaText}

Proporciona una evaluacion general con:
- Puntuacion global (0-100)
- Fortalezas identificadas
- Areas de mejora
- Recomendaciones

Responde UNICAMENTE con un JSON:
{"score": <numero>, "feedback": "<evaluacion completa>", "strengths": "<fortalezas>", "improvements": "<areas de mejora>"}`
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
      improvements: 'Revisar respuestas'
    };
  }
}

module.exports = { generateQuestion, evaluateAnswer, generateFinalEvaluation };
