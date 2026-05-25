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
    junior: [
      'Explica la diferencia entre una variable let y una variable const en JavaScript.',
      'Que es el DOM y como se relaciona con HTML y JavaScript?',
      'Describe que hace la propiedad CSS display: flex en un contenedor.',
      'Que es un evento onclick en JavaScript? Pon un ejemplo basico.',
      'Explica para que sirve la etiqueta meta viewport en HTML.',
      'Que funcion de JavaScript se usa para agregar un elemento al final de un array?',
      'Cual es la diferencia entre == y === en JavaScript?',
      'Que atributo HTML se usa para abrir un enlace en una nueva pestania?',
      'Para que sirve la propiedad position: relative en CSS?',
      'Que es una funcion flecha (arrow function) en JavaScript?'
    ],
    mid: [
      'Explica como funciona el event delegation en JavaScript y da un ejemplo.',
      'Describe la diferencia entre flexbox y CSS Grid. Cuando usarias cada uno?',
      'Que es el Virtual DOM y como mejora el rendimiento en React?',
      'Explica que son los closures en JavaScript y da un ejemplo practico.',
      'Como funciona el patron de estado elevado (state lifting) en React?',
      'Que es el patron de modulo en JavaScript y como ayuda a encapsular codigo?',
      'Explica como funciona el renderizado condicional en React con un ejemplo.',
      'Que son los CSS Custom Properties (variables CSS) y como se usan?',
      'Describe el ciclo de vida de un componente de React con hooks (useEffect).',
      'Que es el Shadow DOM y como se relaciona con los Web Components?'
    ],
    senior: [
      'Explica las diferencias entre prop drilling, context API y state managers como Redux. Cuando usarias cada uno?',
      'Como optimizarias el rendimiento de una aplicacion React con renders pesados?',
      'Describe como implementarias una arquitectura de micro-frontends. Ventajas y desventajas.',
      'Explica el concepto de CSS-in-JS vs CSS Modules. Cuales son sus trade-offs?',
      'Como manejarias la seguridad XSS y CSRF en una aplicacion frontend moderna?',
      'Como implementarias server-side rendering (SSR) con React y cuales son sus ventajas?',
      'Describe las diferencias entre arquitectura Flux, Redux y Zustand para manejo de estado.',
      'Que estrategias de Code Splitting conoces y cuando usarias cada una?',
      'Explica como optimizar el Core Web Vitals (LCP, FID, CLS) en una aplicacion web.',
      'Como manejarias la accesibilidad (WCAG 2.1) en una SPA compleja?'
    ]
  },
  backend: {
    junior: [
      'Explica la diferencia entre una API REST y una API GraphQL.',
      'Que es un middleware en Node.js y para que sirve?',
      'Explica el concepto de variable de entorno y por que es importante.',
      'Que es una base de datos relacional y en que se diferencia de una no relacional?',
      'Que es un endpoint en una API y como se define?',
      'Explica que es el manejo de errores con try/catch en JavaScript.',
      'Que es una promesa en JavaScript y para que sirve?',
      'Cual es la diferencia entre SQL y NoSQL?',
      'Que es el archivo package.json y para que se usa?',
      'Explica que es una funcion asincrona con async/await.'
    ],
    mid: [
      'Explica como funciona el patron Repository en el diseno de APIs.',
      'Describe la diferencia entre autenticacion y autorizacion.',
      'Que es JWT y como se utiliza en la autenticacion de APIs?',
      'Explica el concepto de middleware pipeline en Express o en Node puro.',
      'Como implementarias un sistema de cache en una API REST?',
      'Explica la diferencia entre los patrones de diseno Factory y Singleton.',
      'Que es un webhook y como se diferencia de una API tradicional?',
      'Describe como funciona el protocolo OAuth 2.0 para autenticacion.',
      'Que es la inyeccion de dependencias y por que es util?',
      'Explica como manejarias la paginacion en una API con muchos resultados.'
    ],
    senior: [
      'Como disenarias una arquitectura de microservicios con comunicacion por eventos?',
      'Explica el teorema CAP y como afecta el diseno de bases de datos distribuidas.',
      'Describe estrategias de caching para una API con alto trafico (Redis, CDN, etc.).',
      'Como implementarias un sistema de rate limiting robusto para una API publica?',
      'Como diseniarias un sistema de colas de mensajes con RabbitMQ o Kafka?',
      'Explica las diferencias entre escalado horizontal y vertical en sistemas distribuidos.',
      'Que es el patron CQRS y en que casos es recomendable?',
      'Describe como implementarias un sistema de logging centralizado en microservicios.',
      'Que estrategias de migracion de bases de datos conoces (blue-green, rolling, etc.)?',
      'Explica el concepto de observabilidad (logging, metricas, tracing) en sistemas.'
    ]
  },
  databases: {
    junior: [
      'Que es una clave primaria y una clave foranea?',
      'Explica la diferencia entre INNER JOIN y LEFT JOIN.',
      'Que es un indice en una base de datos y para que sirve?',
      'Que es una clave compuesta en una base de datos?',
      'Para que sirve la clausula WHERE en SQL?',
      'Que es la normalizacion de bases de datos?',
      'Explica la diferencia entre DELETE y TRUNCATE en SQL.',
      'Que es una vista (VIEW) en SQL?',
      'Cual es la funcion de GROUP BY en una consulta SQL?',
      'Que es un JOIN en SQL y por que se usa?'
    ],
    mid: [
      'Explica que son las transacciones ACID y por que son importantes.',
      'Describe la diferencia entre normalizacion y desnormalizacion.',
      'Que es un EXPLAIN en PostgreSQL y como ayuda a optimizar consultas?',
      'Que es un CTE (Common Table Expression) y como se usa?',
      'Explica la diferencia entre los niveles de aislamiento en transacciones SQL.',
      'Que son las funciones de ventana (window functions) en SQL?',
      'Describe como funciona el versionado de esquemas en bases de datos.',
      'Que es la desnormalizacion y cuando tiene sentido usarla?',
      'Explica como funcionan los indices parciales en PostgreSQL.',
      'Que es el plan de ejecucion de una consulta y como interpretarlo?'
    ],
    senior: [
      'Como diseniarias un esquema para un sistema de manejo de inventario en tiempo real?',
      'Explica tecnicas de sharding y particionamiento en bases de datos distribuidas.',
      'Describe como implementarias un sistema de replicacion maestro-esclavo y sus desafios.',
      'Como implementarias un sistema de replicacion multi-maestro en PostgreSQL?',
      'Explica las diferencias entre sharding y particionamiento horizontal.',
      'Que estrategias de backup y recuperacion ante desastres conoces?',
      'Describe como manejarias la consistencia eventual en sistemas distribuidos.',
      'Como optimizarias una base de datos con mas de 100 millones de registros?',
      'Que es el vacuum en PostgreSQL y por que es importante?',
      'Explica el concepto de Change Data Capture (CDC) y sus aplicaciones.'
    ]
  },
  algoritmos: {
    junior: [
      'Explica la diferencia entre una pila (stack) y una cola (queue).',
      'Que es la complejidad Big O y por que es importante?',
      'Explica como funciona el algoritmo de busqueda binaria.',
      'Que es un array y como se diferencia de una lista enlazada?',
      'Explica como funciona el algoritmo de ordenamiento por burbuja (bubble sort).',
      'Que es la recursion y da un ejemplo simple?',
      'Cual es la diferencia entre un conjunto (Set) y un mapa (Map)?',
      'Explica como funciona el algoritmo de busqueda lineal.',
      'Que es un hash table y como funciona?',
      'Explica la diferencia entre un arbol y un grafo.'
    ],
    mid: [
      'Describe como funciona el algoritmo QuickSort y su complejidad.',
      'Explica la diferencia entre un arbol binario de busqueda y un heap.',
      'Que es la programacion dinamica? Da un ejemplo basico como Fibonacci.',
      'Como funciona el algoritmo MergeSort y cual es su complejidad?',
      'Explica la diferencia entre BFS y DFS en recorrido de grafos.',
      'Que es el algoritmo de two pointers y da un ejemplo de uso.',
      'Describe como funciona un Trie (arbol de prefijos) y sus aplicaciones.',
      'Que es la memoria cache en el contexto de algoritmos (principio de localidad)?',
      'Explica el algoritmo de ordenamiento por insercion (insertion sort) y su complejidad.',
      'Que son los algoritmos voraces (greedy) y da un ejemplo?'
    ],
    senior: [
      'Explica el algoritmo de Dijkstra y en que casos se utiliza.',
      'Describe como resolverias el problema del viajante (TSP) con aproximaciones.',
      'Como implementarias un sistema de recomendacion usando filtrado colaborativo?',
      'Como resolverias el problema de la subsequencia comun mas larga (LCS)?',
      'Explica el algoritmo A* para busqueda de caminos y sus aplicaciones.',
      'Que es la tecnica de ventana deslizante (sliding window) y cuando usarla?',
      'Describe como implementarias un sistema de recomendacion basado en contenido.',
      'Como funciona el algoritmo de Floyd-Warshall para caminos mas cortos?',
      'Explica el concepto de backtesting de algoritmos de trading.',
      'Que es la complejidad amortizada y como se calcula?'
    ]
  }
};

// ─── Contador secuencial para evitar repeticion ──────

var bankIndex = {};

function getFallbackQuestion(areaName, difficulty, usedQuestions) {
  var area = areaName ? areaName.toLowerCase() : '';
  var diff = difficulty || 'mid';
  var bank = null;
  if (area.includes('frontend') || area.includes('front')) bank = QUESTION_BANK.frontend;
  else if (area.includes('backend') || area.includes('back') || area.includes('node') || area.includes('api')) bank = QUESTION_BANK.backend;
  else if (area.includes('base') || area.includes('datos') || area.includes('sql') || area.includes('postgres')) bank = QUESTION_BANK.databases;
  else if (area.includes('algorit') || area.includes('estructura') || area.includes('big o')) bank = QUESTION_BANK.algoritmos;
  else bank = QUESTION_BANK.frontend;

  var questions = bank[diff] || bank.mid;
  usedQuestions = usedQuestions || [];

  // Filtrar preguntas ya usadas en esta sesion para evitar repeticiones
  var available = usedQuestions.length > 0
    ? questions.filter(function (q) { return usedQuestions.indexOf(q) === -1; })
    : questions;

  // Si todas las preguntas se han agotado, reiniciar el ciclo
  if (available.length === 0) {
    available = questions;
  }

  var key = areaName + ':' + diff;
  if (!bankIndex[key]) bankIndex[key] = 0;
  var idx = bankIndex[key] % available.length;
  bankIndex[key]++;
  return available[idx] || 'Describe tu experiencia tecnica con ' + areaName + '.';
}

// ─── Call with multi-tier fallback ───────────────────

async function callWithFallback(messages, areaName, difficulty, usedQuestions) {
  var prompt = '';
  if (messages && messages.length > 0) {
    prompt = messages.map(function (m) { return m.role + ': ' + m.content; }).join('\n');
  }

  var sawRateLimit = false;

  // Tier 1: OpenRouter primario
  try {
    var text = await callOpenRouter(messages, PRIMARY_MODEL, API_KEY);
    return { text: text, model: 'Nemotron Nano', rateLimited: false };
  } catch (e) {
    if (e.message && (e.message === 'RATE_LIMIT' || e.message.startsWith('RATE_LIMIT'))) {
      sawRateLimit = true;
      console.log('Rate limit en nemotron, intentando Llama...');
    } else {
      console.log('Error primario: ' + e.message + ', intentando fallback...');
    }
  }

  // Tier 2: OpenRouter secundario
  try {
    var text = await callOpenRouter(messages, FALLBACK_MODEL, API_KEY);
    return { text: text, model: 'Llama 70B', rateLimited: false };
  } catch (e) {
    if (e.message === 'RATE_LIMIT') sawRateLimit = true;
    console.log('Fallback OpenRouter fallo, intentando Hugging Face...');
  }

  // Tier 3: Hugging Face (proveedor diferente)
  try {
    var hfPrompt = prompt || 'Genera una pregunta tecnica sobre ' + (areaName || 'programacion') + ' de nivel ' + (difficulty || 'intermedio') + '.';
    var result = await callHuggingFace(hfPrompt);
    if (result && result.length > 10) return { text: result, model: 'Mistral 7B', rateLimited: false };
  } catch (e) {
    console.log('Hugging Face fallo, usando banco estatico...');
  }

  // Tier 4: Banco de preguntas estatico (siempre funciona)
  var fallbackQ = getFallbackQuestion(areaName, difficulty, usedQuestions);
  return { text: fallbackQ, model: 'Banco local', rateLimited: sawRateLimit };
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
  var result = await callWithFallback(messages, areaName, level);
  return result.text;
}

async function generateFirstQuestion(areaName, difficulty, usedQuestions) {
  var level = difficulty || 'mid';
  var levelDesc = difficultyPrompt(level);
  var messages = [
    { role: 'system', content: 'Eres un entrevistador tecnico profesional. Genera preguntas de nivel ' + level + ' (' + levelDesc + '). Esta es la PRIMERA pregunta de calentamiento. Responde UNICAMENTE con la pregunta.' },
    { role: 'user', content: 'Genera la PRIMERA pregunta de una entrevista tecnica de nivel ' + level + ' sobre ' + areaName + '. Debe ser introductoria. Solo responde con la pregunta.' }
  ];
  var result = await callWithFallback(messages, areaName, level, usedQuestions);
  return { text: result.text, fromBank: result.model === 'Banco local', rateLimited: result.rateLimited, model: result.model };
}

async function generateFollowUpQuestion(areaName, difficulty, previousAnswer, usedQuestions) {
  var level = difficulty || 'mid';
  var levelDesc = difficultyPrompt(level);
  var messages = [
    { role: 'system', content: 'Eres un entrevistador tecnico profesional. Genera preguntas de nivel ' + level + '. Adapta segun la calidad de la respuesta anterior. Responde UNICAMENTE con la pregunta.' },
    { role: 'user', content: 'Respuesta anterior: "' + (previousAnswer || '').substring(0, 300) + '". Genera una pregunta de seguimiento sobre ' + areaName + ' de nivel ' + level + '. Si fue buena, profundiza. Si fue debil, hazla mas accesible.' }
  ];
  var result = await callWithFallback(messages, areaName, level, usedQuestions);
  return { text: result.text, model: result.model, rateLimited: result.rateLimited };
}

async function evaluateAnswer(question, answer, areaName) {
  var messages = [
    { role: 'system', content: 'Eres un evaluador tecnico. Responde UNICAMENTE en JSON valido: {"score": 0-100, "feedback": "..."}.' },
    { role: 'user', content: 'Pregunta: "' + question + '"\nRespuesta: "' + answer + '"\nEvalua claridad, precision y profundidad. Devuelve JSON.' }
  ];
  try {
    var result = await callWithFallback(messages, areaName);
    var cleaned = result.text.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return localEvaluateAnswer(question, answer);
  }
}

async function generateFinalEvaluation(questionsAndAnswers, areaName) {
  var qaText = questionsAndAnswers.map(function (qa, i) { return 'Pregunta ' + (i + 1) + ': ' + qa.question + '\nRespuesta ' + (i + 1) + ': ' + qa.answer; }).join('\n\n');
  var messages = [
    { role: 'system', content: 'Eres un evaluador senior. Responde UNICAMENTE en JSON. Sin texto fuera del JSON.' },
    { role: 'user', content: 'Entrevista de ' + areaName + ':\n' + qaText + '\n\nResponde JSON exacto: {"score": 0-100, "feedback": "...", "strengths": "...", "improvements": "...", "criteriaScores": {"precision": 0-100, "claridad": 0-100, "profundidad": 0-100, "comunicacion": 0-100}, "tags": ["tag1", "tag2"]}' }
  ];
  try {
    var result = await callWithFallback(messages, areaName);
    var cleaned = result.text.replace(/```json\s*|\s*```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return localFinalEvaluation(questionsAndAnswers, areaName);
  }
}

// ─── Evaluacion local (cuando IA falla) ──────────────

function extractKeywords(question) {
  var stopwords = ['que', 'es', 'como', 'cual', 'para', 'con', 'una', 'del', 'las', 'los',
    'mas', 'pero', 'esta', 'este', 'entre', 'por', 'cada', 'debe', 'puede', 'hace',
    'tiene', 'explica', 'describe', 'diferencia', 'funciona', 'sirve', 'usarias',
    'implementarias', 'manejarias', 'diseniarias', 'resolverias', 'explica', 'da',
    'un', 'una', 'el', 'la', 'en', 'y', 'a', 'al', 'su', 'se', 'no', 'lo'];
  return question.toLowerCase()
    .replace(/[¿?¡!,.:;"]/g, '')
    .split(/\s+/)
    .filter(function (w) { return w.length > 2 && stopwords.indexOf(w) === -1; });
}

function localEvaluateAnswer(question, answer) {
  if (!answer || answer.trim().length < 10) {
    return { score: 20, feedback: 'Respuesta demasiado corta. Intenta desarrollar mas tu respuesta con ejemplos concretos.' };
  }

  var keywords = extractKeywords(question);
  var ans = answer.toLowerCase();

  // Puntaje por longitud (20%)
  var lengthScore = Math.min(20, Math.round((answer.length / 300) * 20));

  // Puntaje por cobertura de keywords (30%)
  var matchedKw = keywords.filter(function (kw) { return ans.includes(kw); });
  var kwScore = keywords.length > 0 ? Math.round((matchedKw.length / keywords.length) * 30) : 15;

  // Puntaje por profundidad tecnica (30%)
  var techTerms = ['codigo', 'ejemplo', 'funcion', 'variable', 'metodo', 'clase', 'objeto',
    'array', 'objeto', 'promesa', 'async', 'await', 'callback', 'evento', 'dom', 'api',
    'rest', 'http', 'json', 'sql', 'base', 'datos', 'indice', 'join', 'select', 'insert',
    'update', 'delete', 'query', 'middleware', 'ruta', 'controlador', 'modelo', 'vista',
    'componente', 'estado', 'prop', 'hook', 'effect', 'contexto', 'reducer', 'redux',
    'patron', 'diseno', 'arquitectura', 'microservicio', 'escalabilidad', 'rendimiento',
    'cache', 'redis', 'sesion', 'token', 'jwt', 'auth', 'seguridad', 'xss', 'csrf',
    'testing', 'prueba', 'debug', 'log', 'error', 'excepcion', 'try', 'catch'];
  var matchedTech = techTerms.filter(function (t) { return ans.includes(t); });
  var techScore = Math.min(30, matchedTech.length * 6);

  // Puntaje por estructura (20%)
  var hasCode = ans.includes('```') || ans.includes('<') && ans.includes('>') || /\b(function|const|let|var|class|def|import|export)\b/.test(ans);
  var hasStructure = (answer.split('.').length > 2) || (answer.split('\n').length > 2);
  var structScore = 0;
  if (hasCode) structScore += 12;
  if (hasStructure) structScore += 8;

  var totalScore = Math.min(100, Math.max(5, lengthScore + kwScore + techScore + structScore));

  // Feedback generado localmente
  var feedback = '';
  if (totalScore < 30) {
    feedback = 'La respuesta necesita mas desarrollo. Incluye conceptos tecnicos, ejemplos y estructura.';
  } else if (totalScore < 50) {
    feedback = 'Respuesta basica. Para mejorarla, profundiza en los conceptos clave y agrega ejemplos practicos.';
  } else if (totalScore < 70) {
    feedback = 'Respuesta adecuada con algunos conceptos correctos. Puedes mejorar incluyendo ejemplos de codigo y casos de uso.';
  } else if (totalScore < 85) {
    feedback = 'Buena respuesta. Demuestras comprension del tema. Considera mencionar variantes o casos limites.';
  } else {
    feedback = 'Excelente respuesta. Cubres los conceptos con claridad y profundidad.';
  }

  // Afinar feedback segun keywords faltantes
  var missingKw = keywords.filter(function (kw) { return !ans.includes(kw); });
  if (missingKw.length > 0 && totalScore < 70) {
    feedback += ' No se mencionaron aspectos como: ' + missingKw.slice(0, 3).join(', ') + '.';
  }

  return { score: totalScore, feedback: feedback };
}

function localFinalEvaluation(qaPairs, areaName) {
  if (!qaPairs || qaPairs.length === 0) {
    return {
      score: 0, feedback: 'No se encontraron respuestas para evaluar.',
      strengths: '', improvements: 'Completa todas las preguntas de la entrevista.',
      criteriaScores: { precision: 0, claridad: 0, profundidad: 0, comunicacion: 0 },
      tags: []
    };
  }

  var perQuestion = qaPairs.map(function (qa) {
    return localEvaluateAnswer(qa.question, qa.answer);
  });

  var avgScore = Math.round(perQuestion.reduce(function (s, e) { return s + e.score; }, 0) / perQuestion.length);
  var allFeedbacks = perQuestion.map(function (e) { return e.feedback; });

  // Determinar fortalezas y mejoras
  var strengths = [];
  var improvements = [];
  if (avgScore >= 70) strengths.push('Buena comprension de los conceptos presentados.');
  if (avgScore >= 50) strengths.push('Capacidad para estructurar respuestas tecnicas.');
  if (avgScore < 50) improvements.push('Profundizar en conceptos fundamentales del area.');
  if (avgScore < 70) improvements.push('Incluir ejemplos de codigo y casos practicos.');
  if (avgScore < 60) improvements.push('Desarrollar respuestas mas completas y estructuradas.');

  var overallFeedback = 'Evaluacion local generada. ';
  if (avgScore >= 80) {
    overallFeedback += 'Desempeno destacado. Demuestras solidez en ' + areaName + '.';
  } else if (avgScore >= 60) {
    overallFeedback += 'Desempeno aceptable. Tienes bases solidas pero puedes seguir mejorando.';
  } else if (avgScore >= 40) {
    overallFeedback += 'Desempeno basico. Te recomendamos repasar los fundamentos y practicar mas.';
  } else {
    overallFeedback += 'Desempeno insuficiente. Te sugerimos estudiar los conceptos basicos antes de continuar.';
  }

  // Calcular criteriaScores
  var avgLen = qaPairs.reduce(function (s, qa) { return s + qa.answer.length; }, 0) / qaPairs.length;
  var criteriaScores = {
    precision: Math.min(100, avgScore + 5),
    claridad: Math.min(100, avgScore),
    profundidad: Math.min(100, Math.max(10, avgScore - 10)),
    comunicacion: Math.min(100, avgScore + 3)
  };

  var tags = [];
  if (avgScore >= 70) tags.push('Dominio conceptual');
  if (avgScore >= 50 && avgScore < 80) tags.push('Conocimiento intermedio');
  if (avgScore >= 30) tags.push('Practica recomendada');
  if (avgLen > 150) tags.push('Respuestas elaboradas');

  return {
    score: avgScore,
    feedback: overallFeedback,
    strengths: strengths.join(' ') || 'Ninguna destacada.',
    improvements: improvements.join(' ') || 'Continua practicando para mantener el nivel.',
    criteriaScores: criteriaScores,
    tags: tags.length > 0 ? tags : ['Evaluacion local']
  };
}

module.exports = {
  testConnection, generateQuestion, generateFirstQuestion,
  generateFollowUpQuestion, evaluateAnswer, generateFinalEvaluation,
  localEvaluateAnswer, localFinalEvaluation
};
