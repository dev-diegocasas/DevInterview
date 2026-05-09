const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const API_KEY = process.env.API_KEY;
const PRIMARY_MODEL = 'nvidia/nemotron-nano-9b-v2:free';
const FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

// ─── OpenRouter API ──────────────────────────────────

function callOpenRouter(messages, model, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: model, messages: messages });
    const options = {
      hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (apiKey || API_KEY),
        'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'Entrevistas Tecnicas'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            var msg = (json.error.message || '').toLowerCase();
            if (msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests') || msg.includes('quota') || msg.includes('free-models-per-day')) {
              reject(new Error('RATE_LIMIT'));
            } else {
              reject(new Error(json.error.message));
            }
          } else if (json.choices && json.choices[0]) {
            resolve(json.choices[0].message.content.trim());
          } else {
            reject(new Error('Respuesta inesperada'));
          }
        } catch (e) {
          reject(new Error('Error parseando respuesta'));
        }
      });
    });
    req.on('error', (e) => reject(new Error('Error de red: ' + e.message)));
    req.write(body);
    req.end();
  });
}

// ─── Hugging Face Inference API (proveedor diferente) ─

function callHuggingFace(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 200, temperature: 0.7 } });
    const options = {
      hostname: 'api-inference.huggingface.co',
      path: '/models/mistralai/Mistral-7B-Instruct-v0.3',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error('HF: ' + json.error));
          } else if (Array.isArray(json) && json[0] && json[0].generated_text) {
            var text = json[0].generated_text.replace(prompt, '').trim();
            resolve(text);
          } else {
            reject(new Error('HF: formato inesperado'));
          }
        } catch (e) {
          reject(new Error('HF parse error'));
        }
      });
    });
    req.on('error', (e) => reject(new Error('HF: ' + e.message)));
    req.write(body);
    req.end();
  });
}

// ─── Banco de preguntas estatico (fallback final) ─────

var QUESTION_BANK = {
  frontend: {
    junior: ['Explica la diferencia entre una variable let y una variable const en JavaScript.',
             'Que es el DOM y como se relaciona con HTML y JavaScript?',
             'Describe que hace la propiedad CSS display: flex en un contenedor.',
             'Que es un evento onclick en JavaScript? Pon un ejemplo basico.',
             'Explica para que sirve la etiqueta meta viewport en HTML.'],
    mid: ['Explica como funciona el event delegation en JavaScript y da un ejemplo.',
          'Describe la diferencia entre flexbox y CSS Grid. Cuando usarias cada uno?',
          'Que es el Virtual DOM y como mejora el rendimiento en React?',
          'Explica que son los closures en JavaScript y da un ejemplo practico.',
          'Como funciona el patron de estado elevado (state lifting) en React?'],
    senior: ['Explica las diferencias entre prop drilling, context API y state managers como Redux. Cuando usarias cada uno?',
             'Como optimizarias el rendimiento de una aplicacion React con renders pesados?',
             'Describe como implementarias una arquitectura de micro-frontends. Ventajas y desventajas.',
             'Explica el concepto de CSS-in-JS vs CSS Modules. Cuales son sus trade-offs?',
             'Como manejarias la seguridad XSS y CSRF en una aplicacion frontend moderna?']
  },
  backend: {
    junior: ['Explica la diferencia entre una API REST y una API GraphQL.',
             'Que es un middleware en Node.js y para que sirve?',
             'Explica el concepto de variable de entorno y por que es importante.',
             'Que es una base de datos relacional y en que se diferencia de una no relacional?'],
    mid: ['Explica como funciona el patron Repository en el diseno de APIs.',
          'Describe la diferencia entre autenticacion y autorizacion.',
          'Que es JWT y como se utiliza en la autenticacion de APIs?',
          'Explica el concepto de middleware pipeline en Express o en Node puro.'],
    senior: ['Como disenarias una arquitectura de microservicios con comunicacion por eventos?',
             'Explica el teorema CAP y como afecta el diseno de bases de datos distribuidas.',
             'Describe estrategias de caching para una API con alto trafico (Redis, CDN, etc.).',
             'Como implementarias un sistema de rate limiting robusto para una API publica?']
  },
  databases: {
    junior: ['Que es una clave primaria y una clave foranea?',
             'Explica la diferencia entre INNER JOIN y LEFT JOIN.',
             'Que es un indice en una base de datos y para que sirve?'],
    mid: ['Explica que son las transacciones ACID y por que son importantes.',
          'Describe la diferencia entre normalizacion y desnormalizacion.',
          'Que es un EXPLAIN en PostgreSQL y como ayuda a optimizar consultas?'],
    senior: ['Como disenarias un esquema para un sistema de manejo de inventario en tiempo real?',
             'Explica tecnicas de sharding y particionamiento en bases de datos distribuidas.',
             'Describe como implementarias un sistema de replicacion maestro-esclavo y sus desafios.']
  },
  algoritmos: {
    junior: ['Explica la diferencia entre una pila (stack) y una cola (queue).',
             'Que es la complejidad Big O y por que es importante?',
             'Explica como funciona el algoritmo de busqueda binaria.'],
    mid: ['Describe como funciona el algoritmo QuickSort y su complejidad.',
          'Explica la diferencia entre un arbol binario de busqueda y un heap.',
          'Que es la programacion dinamica? Da un ejemplo basico como Fibonacci.'],
    senior: ['Explica el algoritmo de Dijkstra y en que casos se utiliza.',
             'Describe como resolverias el problema del viajante (TSP) con aproximaciones.',
             'Como implementarias un sistema de recomendacion usando filtrado colaborativo?']
  }
};

function getFallbackQuestion(areaName, difficulty) {
  var area = areaName ? areaName.toLowerCase() : '';
  var diff = difficulty || 'mid';
  var bank = null;
  if (area.includes('frontend') || area.includes('front')) bank = QUESTION_BANK.frontend;
  else if (area.includes('backend') || area.includes('back') || area.includes('node') || area.includes('api')) bank = QUESTION_BANK.backend;
  else if (area.includes('base') || area.includes('datos') || area.includes('sql') || area.includes('postgres')) bank = QUESTION_BANK.databases;
  else if (area.includes('algorit') || area.includes('estructura') || area.includes('big o')) bank = QUESTION_BANK.algoritmos;
  else bank = QUESTION_BANK.frontend;

  var questions = bank[diff] || bank.mid;
  return questions[Math.floor(Math.random() * questions.length)] || 'Describe tu experiencia tecnica con ' + areaName + '.';
}

// ─── Call with multi-tier fallback ───────────────────

async function callWithFallback(messages, areaName, difficulty) {
  var prompt = '';
  if (messages && messages.length > 0) {
    prompt = messages.map(function (m) { return m.role + ': ' + m.content; }).join('\n');
  }

  // Tier 1: OpenRouter primario
  try {
    return await callOpenRouter(messages, PRIMARY_MODEL, API_KEY);
  } catch (e) {
    if (e.message && e.message.startsWith('RATE_LIMIT')) {
      console.log('Rate limit en nemotron, intentando Llama...');
    } else {
      console.log('Error primario: ' + e.message + ', intentando fallback...');
    }
  }

  // Tier 2: OpenRouter secundario
  try {
    return await callOpenRouter(messages, FALLBACK_MODEL, API_KEY);
  } catch (e) {
    console.log('Fallback OpenRouter fallo, intentando Hugging Face...');
  }

  // Tier 3: Hugging Face (proveedor diferente)
  try {
    var hfPrompt = prompt || 'Genera una pregunta tecnica sobre ' + (areaName || 'programacion') + ' de nivel ' + (difficulty || 'intermedio') + '.';
    var result = await callHuggingFace(hfPrompt);
    if (result && result.length > 10) return result;
  } catch (e) {
    console.log('Hugging Face fallo, usando banco estatico...');
  }

  // Tier 4: Banco de preguntas estatico (siempre funciona)
  var fallbackQ = getFallbackQuestion(areaName, difficulty);
  throw new Error('FALLBACK_Q:' + fallbackQ);
}

// ─── Funciones publicas ──────────────────────────────

async function testConnection() {
  try {
    var response = await callOpenRouter([{ role: 'user', content: 'OK' }], PRIMARY_MODEL, API_KEY);
    return response.includes('OK');
  } catch (e) {
    return false;
  }
}

function difficultyPrompt(difficulty) {
  var prompts = {
    junior: 'basico, conceptos fundamentales y sintaxis',
    mid: 'intermedio, patrones de diseno, optimizacion y buenas practicas',
    senior: 'avanzado, escalabilidad, trade-offs, arquitectura y diseno de sistemas'
  };
  return prompts[difficulty] || prompts.mid;
}

async function generateQuestion(areaName, difficulty) {
  var level = difficulty || 'mid';
  var levelDesc = difficultyPrompt(level);
  var messages = [
    { role: 'system', content: 'Eres un entrevistador tecnico profesional. Genera preguntas claras, relevantes y de nivel ' + level + '. Responde UNICAMENTE con la pregunta. No uses markdown. Maximo 3 oraciones.' },
    { role: 'user', content: 'Genera una pregunta tecnica de nivel ' + level + ' sobre ' + areaName + '. ' + levelDesc + '. Solo responde con la pregunta.' }
  ];
  try {
    return await callWithFallback(messages, areaName, level);
  } catch (e) {
    if (e.message && e.message.startsWith('FALLBACK_Q:')) {
      return e.message.replace('FALLBACK_Q:', '');
    }
    throw e;
  }
}

async function generateFirstQuestion(areaName, difficulty) {
  var level = difficulty || 'mid';
  var levelDesc = difficultyPrompt(level);
  var messages = [
    { role: 'system', content: 'Eres un entrevistador tecnico profesional. Genera preguntas de nivel ' + level + ' (' + levelDesc + '). Esta es la PRIMERA pregunta de calentamiento. Responde UNICAMENTE con la pregunta.' },
    { role: 'user', content: 'Genera la PRIMERA pregunta de una entrevista tecnica de nivel ' + level + ' sobre ' + areaName + '. Debe ser introductoria. Solo responde con la pregunta.' }
  ];
  try {
    return await callWithFallback(messages, areaName, level);
  } catch (e) {
    if (e.message && e.message.startsWith('FALLBACK_Q:')) return e.message.replace('FALLBACK_Q:', '');
    throw e;
  }
}

async function generateFollowUpQuestion(areaName, difficulty, previousAnswer) {
  var level = difficulty || 'mid';
  var levelDesc = difficultyPrompt(level);
  var messages = [
    { role: 'system', content: 'Eres un entrevistador tecnico profesional. Genera preguntas de nivel ' + level + '. Adapta segun la calidad de la respuesta anterior. Responde UNICAMENTE con la pregunta.' },
    { role: 'user', content: 'Respuesta anterior: "' + (previousAnswer || '').substring(0, 300) + '". Genera una pregunta de seguimiento sobre ' + areaName + ' de nivel ' + level + '. Si fue buena, profundiza. Si fue debil, hazla mas accesible.' }
  ];
  try {
    return await callWithFallback(messages, areaName, level);
  } catch (e) {
    if (e.message && e.message.startsWith('FALLBACK_Q:')) return e.message.replace('FALLBACK_Q:', '');
    throw e;
  }
}

async function evaluateAnswer(question, answer, areaName) {
  var messages = [
    { role: 'system', content: 'Eres un evaluador tecnico. Responde UNICAMENTE en JSON valido: {"score": 0-100, "feedback": "..."}.' },
    { role: 'user', content: 'Pregunta: "' + question + '"\nRespuesta: "' + answer + '"\nEvalua claridad, precision y profundidad. Devuelve JSON.' }
  ];
  try {
    var response = await callWithFallback(messages, areaName);
    var cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return { score: 50, feedback: 'Evaluacion generada con fallback.' };
  }
}

async function generateFinalEvaluation(questionsAndAnswers, areaName) {
  var qaText = questionsAndAnswers.map(function (qa, i) { return 'Pregunta ' + (i + 1) + ': ' + qa.question + '\nRespuesta ' + (i + 1) + ': ' + qa.answer; }).join('\n\n');
  var messages = [
    { role: 'system', content: 'Eres un evaluador senior. Responde UNICAMENTE en JSON. Sin texto fuera del JSON.' },
    { role: 'user', content: 'Entrevista de ' + areaName + ':\n' + qaText + '\n\nResponde JSON exacto: {"score": 0-100, "feedback": "...", "strengths": "...", "improvements": "...", "criteriaScores": {"precision": 0-100, "claridad": 0-100, "profundidad": 0-100, "comunicacion": 0-100}, "tags": ["tag1", "tag2"]}' }
  ];
  try {
    var response = await callWithFallback(messages, areaName);
    var cleaned = response.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      score: 65, feedback: 'Evaluacion generada con recursos limitados.',
      strengths: 'Conceptos basicos demostrados.', improvements: 'Profundizar en temas avanzados.',
      criteriaScores: { precision: 60, claridad: 65, profundidad: 55, comunicacion: 60 },
      tags: ['Evaluacion con fallback']
    };
  }
}

module.exports = {
  testConnection, generateQuestion, generateFirstQuestion,
  generateFollowUpQuestion, evaluateAnswer, generateFinalEvaluation
};
