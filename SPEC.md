# SPEC.md — Especificacion Completa del Sistema

> Proyecto: **DevInterview**
> Version del documento: **3.0.0**
> Estado: **Implementacion planificada**

---

## Tabla de Contenidos

1. [Descripcion General](#1-descripcion-general)
2. [Stack Tecnologico](#2-stack-tecnologico)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Base de Datos](#4-base-de-datos)
5. [API REST](#5-api-rest)
6. [Componentes Frontend](#6-componentes-frontend)
7. [Flujos de Usuario](#7-flujos-de-usuario)
8. [Servicio de IA](#8-servicio-de-ia)
9. [Diseno Visual](#9-diseno-visual)
10. [Plan de Implementacion](#10-plan-de-implementacion)
11. [Reglas y Convenciones](#11-reglas-y-convenciones)

---

## 1. Descripcion General

Plataforma web para simulacion de entrevistas tecnicas con IA. Los usuarios
pueden registrarse, seleccionar un area tecnica (Frontend, Backend, etc.),
responder preguntas generadas por IA en una interfaz tipo chat, y recibir
evaluacion detallada con puntuacion, fortalezas y areas de mejora.

**Idioma:** 100% espanol (UI, mensajes, feedback de IA, errores).

### 1.1 Usuarios Objetivo

- Desarrolladores en busqueda laboral (junior, mid, senior)
- Profesionales preparando entrevistas tecnicas
- Equipos de recruiting evaluando candidatos

### 1.2 Funcionalidades Core

| Funcionalidad | Estado |
|--------------|--------|
| Registro e inicio de sesion | ✓ Implementado |
| Seleccion de areas tecnicas | ✓ Implementado |
| Simulacion de entrevista (chat) | ✓ Implementado |
| Evaluacion final por IA | ✓ Implementado |
| Historial de entrevistas | ✓ Implementado |
| Eliminacion de entrevistas | ✓ Implementado |
| **Dashboard con estadisticas** | ⬜ Planificado |
| **Seleccion de dificultad** | ⬜ Planificado |
| **Feedback IA por pregunta** | ⬜ Planificado |
| **Evaluacion por competencias** | ⬜ Planificado |
| **Filtros y paginacion en historial** | ⬜ Planificado |
| **Detalle de sesion** | ⬜ Planificado |
| **Rachas de practica** | ⬜ Planificado |
| **Perfil de usuario** | ⬜ Planificado |
| **Metas semanales** | ⬜ Planificado |

---

## 2. Stack Tecnologico

### 2.1 Frontend

| Tecnologia | Version | Uso |
|-----------|---------|-----|
| HTML5 | Estandar | Estructura de la SPA y vistas |
| CSS3 | Estandar | Estilos complementarios a Tailwind |
| JavaScript (ES6+) | Estandar | Logica cliente, SPA, fetch API |
| Tailwind CSS | v3 (CDN) | Utilidades de diseno (via script tag) |
| Geist | Google Fonts | Tipografia UI (sans-serif) |
| JetBrains Mono | Google Fonts | Tipografia para codigo (monospace) |
| Material Symbols | Google Fonts | Iconos (Outlined, wght 400) |

### 2.2 Backend

| Tecnologia | Version | Uso |
|-----------|---------|-----|
| Node.js | 18+ | Entorno de ejecucion |
| Modulo http | Nativo | Servidor HTTP sin frameworks |
| crypto | Nativo | Scrypt (hash passwords), UUID (tokens) |
| modulo url | Nativo | Parseo de rutas y query params |
| modulo fs | Nativo | Lectura de archivos estaticos |
| modulo path | Nativo | Manejo de rutas de archivos |

### 2.3 Dependencias NPM

| Paquete | Version | Uso |
|---------|---------|-----|
| dotenv | ^17.4.2 | Variables de entorno (.env) |
| pg | ^8.20.0 | Cliente PostgreSQL (pool de conexiones) |

### 2.4 Base de Datos

| Componente | Detalle |
|-----------|---------|
| Motor | PostgreSQL 15+ |
| Hosting | Neon (Serverless) |
| Conexion | SSL obligatorio (`sslmode=require`) |
| Pool | `pg.Pool` con connectionString |
| Pool size | Default (10 conexiones) |

### 2.5 IA

| Componente | Detalle |
|-----------|---------|
| Proveedor | OpenRouter |
| Modelo | `nvidia/nemotron-nano-9b-v2:free` |
| Auth | Bearer token via `API_KEY` en .env |
| Rate limit | Gratuito, sujeto a disponibilidad (429 en exceso) |
| Formato | JSON estricto en respuestas (prompt engineering) |
| Timeout | 30s por request (manejar con AbortController) |

### 2.6 Entorno (.env)

```
DATABASE_URL=postgresql://...
API_KEY=sk-or-v1-...
PORT=3000
```

---

## 3. Arquitectura del Sistema

### 3.1 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (SPA)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ index.html│  │ app.js   │  │ styles.css + Tailwind│   │
│  │ (7 views) │  │ (logica) │  │ (diseno)             │   │
│  └──────────┘  └──────────┘  └──────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (fetch)
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   SERVIDOR (Node.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │server.js │→│ routes/  │→│ services/             │   │
│  │(http,    │  │(auth,    │  │(ai.js, auth.js)      │   │
│  │ archivos │  │interview,│  └──────────┬───────────┘   │
│  │estaticos)│  │history,  │             │                │
│  └──────────┘  │dashboard,│             ▼                │
│                │user, areas)└──────┬──────────────────┐  │
│                └──────────┘        │  db/              │  │
│                                    │  (queries.js,     │  │
│                                    │   connection.js,  │  │
│                                    │   schema.sql)     │  │
│                                    └──────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ TCP/SSL
                       ▼
┌─────────────────────────────────────────────────────────┐
│              NEON PostgreSQL (Serverless)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │  users   │  │sessions  │  │technical_areas       │   │
│  │interviews│  │questions │  │answers               │   │
│  │evaluations│ │user_goals│  │user_streaks          │   │
│  │practice_days││ (vistas) │  │user_progress,        │   │
│  │          │  │          │  │user_stats            │   │
│  └──────────┘  └──────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘

              ┌──────────────────────────────────┐
              │      OpenRouter API (gemini)      │
              │      /api/v1/chat/completions     │
              └──────────────────────────────────┘
```

### 3.2 Flujo de Datos — Entrevista

```
1. Usuario selecciona area + dificultad
2. POST /api/interview/start { areaId, difficultyLevel }
3. Backend:
   a. Crea registro en interviews
   b. Llama a services/ai.js → generateQuestion(areaName, difficulty)
   c. Guarda en questions
   d. Devuelve question { id, text, order }
4. Usuario escribe respuesta
5. POST /api/interview/answer { interviewId, questionId, answer, questionNumber, areaName }
6. Backend:
   a. Guarda en answers
   b. Llama a services/ai.js → evaluateAnswer(question, answer, areaName)
   c. Guarda ai_feedback + ai_score en answers
   d. Si quedan preguntas → generateQuestion() siguiente
   e. Devuelve { finished: false, question } o { finished: true }
7. POST /api/interview/finish { interviewId, areaId }
8. Backend:
   a. Obtiene todas las preguntas y respuestas
   b. Llama a services/ai.js → generateFinalEvaluation(qaPairs, areaName)
   c. Guarda en evaluations (con criteria_scores y tags)
   d. Calcula duration_seconds desde started_at
   e. Actualiza interviews (status, score, finished_at)
   f. Registra practice_day
   g. Devuelve { score, feedback, strengths, improvements, criteriaScores, tags }
```

### 3.3 Flujo de Datos — Dashboard Stats

```
GET /api/dashboard/stats
Autenticacion requerida (Bearer token)

Respuesta:
{
  "totalInterviews": 12,
  "totalCompleted": 10,
  "avgScore": 78.5,
  "bestScore": 92,
  "worstScore": 45,
  "currentStreak": 3,
  "longestStreak": 7,
  "lastPracticeDate": "2026-05-08",
  "weeklyGoal": 5,
  "weeklyProgress": 3,
  "byArea": [
    { "areaName": "Frontend", "count": 5, "avgScore": 82 },
    { "areaName": "Backend", "count": 4, "avgScore": 75 }
  ]
}
```

---

## 4. Base de Datos

### 4.1 Esquema Completo v3.0

```sql
-- ====================================================================
-- DevInterview — Schema v3.0
-- Motor: PostgreSQL (Neon)
-- ====================================================================

-- MÓDULO 1: Autenticación y perfil de usuario

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    photo_url       VARCHAR(500),
    bio             TEXT,
    tech_level      VARCHAR(20) NOT NULL DEFAULT 'junior'
                    CHECK (tech_level IN ('junior', 'mid', 'senior')),
    account_status  VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (account_status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_tech_level ON users (tech_level);

CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- MÓDULO 2: Áreas técnicas

CREATE TABLE IF NOT EXISTS technical_areas (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon        VARCHAR(50),                    -- v3.0: icono Material Symbols
    popular     BOOLEAN NOT NULL DEFAULT FALSE, -- v3.0: badge "Popular"
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MÓDULO 3: Sesiones de entrevista

CREATE TABLE IF NOT EXISTS interviews (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_id             INTEGER REFERENCES technical_areas(id) ON DELETE RESTRICT,
    difficulty_level    VARCHAR(20) NOT NULL DEFAULT 'mid'
                        CHECK (difficulty_level IN ('junior', 'mid', 'senior')), -- v3.0
    status              VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    questions_answered  INTEGER NOT NULL DEFAULT 0 CHECK (questions_answered >= 0),
    questions_total     INTEGER NOT NULL DEFAULT 5 CHECK (questions_total > 0), -- v3.0
    score               INTEGER CHECK (score >= 0 AND score <= 100),
    duration_seconds    INTEGER,              -- v3.0: duracion real
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews (user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_area_id ON interviews (area_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews (status);
CREATE INDEX IF NOT EXISTS idx_interviews_started_at ON interviews (started_at DESC);

-- MÓDULO 4: Preguntas y respuestas

CREATE TABLE IF NOT EXISTS questions (
    id              SERIAL PRIMARY KEY,
    interview_id    INTEGER NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    question_order  INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_interview_id ON questions (interview_id);

CREATE TABLE IF NOT EXISTS answers (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    ai_feedback TEXT,                   -- v3.0: feedback IA individual
    ai_score    INTEGER CHECK (ai_score >= 0 AND ai_score <= 100), -- v3.0
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers (question_id);

-- MÓDULO 5: Evaluaciones

CREATE TABLE IF NOT EXISTS evaluations (
    id              SERIAL PRIMARY KEY,
    interview_id    INTEGER NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    feedback        TEXT NOT NULL,
    strengths       TEXT,
    improvements    TEXT,
    criteria_scores JSONB,              -- v3.0: {"precision":85,"claridad":70,...}
    tags            TEXT[],             -- v3.0: {"Excelencia en Hooks",...}
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evaluations_interview_id ON evaluations (interview_id);

-- MÓDULO 6: Metas y rachas (v3.0)

CREATE TABLE IF NOT EXISTS user_goals (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    weekly_target   INTEGER NOT NULL DEFAULT 5 CHECK (weekly_target > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS practice_days (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    practice_date   DATE NOT NULL,
    UNIQUE(user_id, practice_date)
);

CREATE INDEX IF NOT EXISTS idx_practice_days_user_id ON practice_days (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_days_date ON practice_days (practice_date);

-- MÓDULO 7: Vistas auxiliares

CREATE OR REPLACE VIEW user_progress AS
SELECT
    i.user_id, u.full_name, ta.name AS area_name,
    i.id AS interview_id, i.score, i.started_at, i.finished_at,
    ROW_NUMBER() OVER (PARTITION BY i.user_id, i.area_id ORDER BY i.started_at) AS attempt_number
FROM interviews i
JOIN users u ON u.id = i.user_id
JOIN technical_areas ta ON ta.id = i.area_id
WHERE i.status = 'completed' AND i.score IS NOT NULL
ORDER BY i.user_id, i.area_id, i.started_at;

CREATE OR REPLACE VIEW user_stats AS
SELECT
    i.user_id, u.full_name, u.tech_level, ta.name AS area_name,
    COUNT(i.id) AS total_interviews,
    ROUND(AVG(i.score), 1) AS avg_score,
    MAX(i.score) AS best_score,
    MIN(i.score) AS worst_score,
    MAX(i.finished_at) AS last_interview_at
FROM interviews i
JOIN users u ON u.id = i.user_id
JOIN technical_areas ta ON ta.id = i.area_id
WHERE i.status = 'completed' AND i.score IS NOT NULL
GROUP BY i.user_id, u.full_name, u.tech_level, ta.name
ORDER BY i.user_id, ta.name;

-- v3.0: Vista para racha actual
CREATE OR REPLACE VIEW user_streak_view AS
WITH daily AS (
    SELECT DISTINCT user_id, practice_date
    FROM practice_days
    ORDER BY user_id, practice_date DESC
)
SELECT
    user_id,
    COUNT(*) AS current_streak
FROM (
    SELECT user_id, practice_date,
           practice_date - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY practice_date DESC) AS grp
    FROM daily
) grouped
WHERE grp = (SELECT practice_date - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY practice_date DESC)
             FROM daily WHERE user_id = grouped.user_id
             LIMIT 1)
GROUP BY user_id;
```

### 4.2 Diccionario de Datos

#### `users`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| full_name | VARCHAR(150) | | Nombre completo |
| email | VARCHAR(255) UNIQUE | | Correo electronico |
| password_hash | VARCHAR(255) | | Hash scrypt (salt:hash) |
| photo_url | VARCHAR(500) | NULL | URL de foto de perfil |
| bio | TEXT | NULL | Biografia del usuario |
| tech_level | VARCHAR(20) | 'junior' | Nivel tecnico |
| account_status | VARCHAR(20) | 'active' | Estado de la cuenta |
| created_at | TIMESTAMPTZ | NOW() | Fecha de registro |
| last_login | TIMESTAMPTZ | NULL | Ultimo inicio de sesion |

#### `sessions`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| user_id | INTEGER FK | | Referencia a users.id |
| token | VARCHAR(255) UNIQUE | | Token UUID v4 |
| expires_at | TIMESTAMPTZ | | Fecha de expiracion (+7 dias) |
| created_at | TIMESTAMPTZ | NOW() | Fecha de creacion |

#### `technical_areas`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| name | VARCHAR(100) UNIQUE | | Nombre (Frontend, Backend...) |
| slug | VARCHAR(100) UNIQUE | | Identificador URL |
| description | TEXT | | Descripcion del area |
| icon | VARCHAR(50) | NULL | v3.0: icono Material Symbols |
| popular | BOOLEAN | FALSE | v3.0: badge popular |
| is_active | BOOLEAN | TRUE | Disponible para entrevistas |
| created_at | TIMESTAMPTZ | NOW() | |

#### `interviews`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| user_id | INTEGER FK | | Referencia a users.id |
| area_id | INTEGER FK | | Referencia a technical_areas.id |
| difficulty_level | VARCHAR(20) | 'mid' | v3.0: junior, mid, senior |
| status | VARCHAR(20) | 'in_progress' | in_progress, completed, abandoned |
| questions_answered | INTEGER | 0 | Preguntas respondidas |
| questions_total | INTEGER | 5 | v3.0: total de preguntas configurado |
| score | INTEGER | NULL | Puntaje global (0-100) |
| duration_seconds | INTEGER | NULL | v3.0: duracion en segundos |
| started_at | TIMESTAMPTZ | NOW() | Inicio de la entrevista |
| finished_at | TIMESTAMPTZ | NULL | Fin de la entrevista |

#### `questions`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| interview_id | INTEGER FK | | Referencia a interviews.id |
| question_text | TEXT | | Texto de la pregunta |
| question_order | INTEGER | | Orden en la entrevista |
| created_at | TIMESTAMPTZ | NOW() | |

#### `answers`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| question_id | INTEGER FK | | Referencia a questions.id |
| answer_text | TEXT | | Texto de la respuesta |
| ai_feedback | TEXT | NULL | v3.0: feedback IA individual |
| ai_score | INTEGER | NULL | v3.0: puntaje IA individual |
| created_at | TIMESTAMPTZ | NOW() | |

#### `evaluations`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| interview_id | INTEGER FK UNIQUE | | Referencia a interviews.id |
| score | INTEGER | | Puntaje global (0-100) |
| feedback | TEXT | | Feedback detallado |
| strengths | TEXT | NULL | Fortalezas identificadas |
| improvements | TEXT | NULL | Areas de mejora |
| criteria_scores | JSONB | NULL | v3.0: desglose por competencias |
| tags | TEXT[] | NULL | v3.0: etiquetas de habilidades |
| created_at | TIMESTAMPTZ | NOW() | |

#### `user_goals`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| user_id | INTEGER FK UNIQUE | | Referencia a users.id |
| weekly_target | INTEGER | 5 | Meta semanal de entrevistas |
| created_at | TIMESTAMPTZ | NOW() | |
| updated_at | TIMESTAMPTZ | NOW() | |

#### `practice_days`
| Columna | Tipo | Default | Descripcion |
|---------|------|---------|-------------|
| id | SERIAL PK | | ID unico |
| user_id | INTEGER FK | | Referencia a users.id |
| practice_date | DATE | | Fecha de practica |
| UNIQUE(user_id, practice_date) | | | Un registro por usuario por dia |

---

## 5. API REST

### 5.1 Endpoints

Metodo | Ruta | Autenticacion | Descripcion | Implementado
-------|------|--------------|-------------|-------------
POST | /api/auth/register | No | Registrar nuevo usuario | ✓
POST | /api/auth/login | No | Iniciar sesion | ✓
POST | /api/auth/logout | Bearer | Cerrar sesion | ✓
GET | /api/auth/me | Bearer | Obtener usuario actual | ✓
GET | /api/areas | No | Listar areas tecnicas activas | ✓
POST | /api/interview/start | Bearer | Iniciar entrevista | ✓ (mejorar)
POST | /api/interview/answer | Bearer | Enviar respuesta | ✓ (mejorar)
POST | /api/interview/finish | Bearer | Finalizar y evaluar | ✓ (mejorar)
GET | /api/interview/:id | Bearer | Detalle de entrevista | ⬜
GET | /api/interview/:id/transcript | Bearer | Transcripcion con feedback | ⬜
GET | /api/history | Bearer | Historial (con filtros) | ✓ (mejorar)
GET | /api/history/stats | Bearer | Estadisticas del historial | ⬜
GET | /api/history/:id | Bearer | Detalle de sesion | ⬜
DELETE | /api/history/:id | Bearer | Eliminar entrevista | ✓
GET | /api/dashboard/stats | Bearer | Estadisticas del dashboard | ⬜
GET | /api/user/profile | Bearer | Perfil del usuario | ⬜
PUT | /api/user/profile | Bearer | Actualizar perfil | ⬜
PUT | /api/user/password | Bearer | Cambiar contrasena | ⬜

### 5.2 Formato de Respuestas

**Exito:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Mensaje descriptivo"
}
```

### 5.3 Autenticacion

- Header: `Authorization: Bearer <token>`
- Token: UUID v4 generado con `crypto.randomUUID()`
- Expiracion: 7 dias desde la creacion
- Sesion se valida contra `sessions` + `users.account_status = 'active'`
- Contrasenas: hash con `crypto.scryptSync(password, salt, 64)` almacenado como `salt:hash`

### 5.4 Paginacion y Filtros (Historial)

```
GET /api/history?page=1&limit=10&search=react&area=1&difficulty=senior&scoreMin=70&scoreMax=100&sort=started_at&order=desc

Respuesta:
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "totalPages": 3
  }
}
```

---

## 6. Componentes Frontend

### 6.1 SPA — Vista Unica en `index.html`

La SPA contiene 7 vistas manejadas por JavaScript nativo:

```
index.html
│
├── #view-login        → Formulario de inicio de sesion
├── #view-register     → Formulario de registro
│
└── #app-main
    │
    ├── #view-home         → Dashboard resumido con stats
    ├── #view-areas        → Grid de areas tecnicas con dificultad
    ├── #view-chat         → Interfaz de entrevista tipo chat
    ├── #view-evaluation   → Resultados y feedback de IA
    └── #view-history      → Listado de entrevistas con filtros
```

### 6.2 Sistema de Vistas

```javascript
// app.js — Sistema de routing del lado cliente
// Las vistas se muestran/ocultan con clases CSS:
//   .view-hidden  → display: none !important;
//   .view-active  → display: block (o flex segun el contexto)

showAppView('home');      // Muestra home, oculta las demas
showAuthView('login');    // Modo autenticacion
showApp();                // Cambia de auth a app
```

### 6.3 Estado Global (app.js)

```javascript
var state = {
  token: null,           // Bearer token JWT-less
  user: null,            // { id, fullName, email, techLevel }
  areaId: null,          // ID del area seleccionada
  areaName: '',          // Nombre del area
  difficultyLevel: 'mid', // v3.0: junior, mid, senior
  interviewId: null,     // ID de la entrevista activa
  currentQuestion: null, // Pregunta actual { id, text, order }
  questionNumber: 0,     // Numero de pregunta actual
  questionsAndAnswers: [], // Historial de Q&A de la sesion
  isProcessing: false    // Bloqueo de UI durante peticiones
};
```

### 6.4 Funciones API (app.js)

```javascript
apiRequest(endpoint, method, body)
// Envuelve fetch() con manejo de token, errores, y parseo JSON
```

### 6.5 Vistas Detalladas

#### `view-home` (Dashboard)
- Saludo personalizado con nombre del usuario
- Stats cargados de `GET /api/dashboard/stats`
- Cards: "Empezar practica" y "Ver historial"

#### `view-areas` (Seleccion de area)
- Grid de areas cargadas de `GET /api/areas`
- v3.0: Selector de dificultad (Junior/Mid/Senior) antes de iniciar

#### `view-chat` (Entrevista)
- Cabecera: area, contador de preguntas, barra de progreso
- Historial de mensajes (sistema ⇄ usuario)
- Input de texto + boton enviar
- v3.0: Mini feedback por pregunta (opcional, colapsable)

#### `view-evaluation` (Resultados)
- Puntaje global con codigo de color
- v3.0: Barras de competencias (precision, claridad, profundidad, comunicacion)
- Feedback, fortalezas, areas de mejora
- v3.0: Tags de habilidades

#### `view-history` (Historial)
- Lista de entrevistas con area, fecha, puntaje, estado
- v3.0: Filtros (busqueda, area, dificultad, rango de score)
- v3.0: Paginacion
- v3.0: Resumen stats (total, promedio)
- Boton eliminar
- Click en entrevistas en curso para reanudar

---

## 7. Flujos de Usuario

### 7.1 Registro y Autenticacion

```
[Landing] → view-login
           ├── ¿Tiene cuenta? → Login
           │                    ├── Exitoso → view-home
           │                    └── Error → mostrar mensaje
           └── ¿No tiene cuenta? → Register
                                    ├── Exitoso → view-home
                                    └── Error → mostrar mensaje
```

### 7.2 Entrevista Completa

```
view-home → Click "Empezar practica"
          → view-areas (carga areas de GET /api/areas)
          → Selecciona area + dificultad
          → POST /api/interview/start { areaId, difficultyLevel }
          → view-chat
            ├── Muestra primera pregunta IA
            ├── Usuario escribe respuesta
            ├── POST /api/interview/answer
            │   ├── Guarda respuesta + feedback IA individual
            │   ├── ¿Ultima pregunta?
            │   │   ├── No → Muestra siguiente pregunta
            │   │   └── Si → POST /api/interview/finish
            │   │            → view-evaluation
            │   │              ├── Muestra score + competencias + feedback
            │   │              ├── "Nueva entrevista" → view-areas
            │   │              └── "Volver al inicio" → view-home
            │   └── Error → mostrar toast
            └── Error → mostrar toast
```

### 7.3 Reanudar Entrevista

```
view-history → Click en entrevista "en curso"
             → POST /api/interview/start (detecta en curso)
             → view-chat con historial de preguntas respondidas
             → Continua desde la pregunta pendiente
```

### 7.4 Ver Historial

```
view-home → Click "Ver historial"
          → view-history
          ├── GET /api/history?page=1&limit=10
          ├── GET /api/history/stats
          ├── Filtros disponibles
          ├── Click "Ver detalle" (futuro)
          └── Click "Eliminar" → DELETE /api/history/:id
```

---

## 8. Servicio de IA

### 8.1 Funciones (v3.0 actualizadas)

#### `testConnection()`
Verifica que la API key y el modelo esten operativos.
```
User: "Responde SOLO con la palabra: OK"
→ boolean (true si responde OK)
```

#### `generateQuestion(areaName, difficulty?)`

```
System: "Eres un entrevistador tecnico profesional. Genera preguntas claras,
         relevantes y de nivel {difficulty}. Responde UNICAMENTE con la
         pregunta, sin introducciones ni explicaciones adicionales.
         No uses markdown. Maximo 2 oraciones."

User: "Genera una pregunta tecnica de nivel {difficulty} sobre {areaName}.
       La pregunta debe evaluar conocimiento practico.
       Solo responde con la pregunta."
```

**Dificultad:**
- `junior` → Conceptos fundamentales, sintaxis basica, casos simples
- `mid` → Patrones de diseno, optimizacion, arquitectura
- `senior` → Escalabilidad, trade-offs, diseno de sistemas

#### `evaluateAnswer(question, answer, areaName)`

```
System: "Eres un evaluador tecnico profesional. Evalua respuestas de
         entrevistas. Responde UNICAMENTE en formato JSON valido."

User: "Evalua la siguiente respuesta...
       Pregunta: ...
       Respuesta: ...
       Devuelve UNICAMENTE un JSON:
       {"score": 0-100, "feedback": "..."}"
```

#### `generateFinalEvaluation(qaPairs, areaName)`

```
System: "Eres un evaluador tecnico senior..."

User: "Evalua esta entrevista completa de {areaName}: ...(Q&A)...
       Responde UNICAMENTE con un JSON:
       {"score": 0-100, "feedback": "...", "strengths": "...",
        "improvements": "...", "criteriaScores": {"precision": 0-100,
          "claridad": 0-100, "profundidad": 0-100, "comunicacion": 0-100},
        "tags": ["tag1", "tag2"]}"
```

### 8.2 Consideraciones

- La API de OpenRouter gratuita tiene rate limiting
- Los prompts estan disenados para forzar JSON valido
- Si falla el parseo JSON, se devuelve un fallback con score 50
- No hay almacenamiento en cache de respuestas IA
- Timeout: no configurado explicitamente (depende de Node.js)

---

## 9. Diseno Visual

### 9.1 Paleta de Colores (del design.md)

| Rol | Hex | Uso |
|-----|-----|-----|
| Fondo principal | `#0F1115` | Background de la pagina |
| Fondo secundario | `#171A21` | Nav, contenedores |
| Superficie elevada | `#20242D` | Cards, paneles |
| Bordes | `#2B313C` | Divisores, bordes |
| Texto primario | `#E6E8EE` | Titulos, cuerpo |
| Texto secundario | `#A7ADB8` | Subtitulos, metadata |
| Texto muted | `#7D8593` | Placeholders, textos bajos |
| Accent primario | `#5B7CFA` | Botones primarios, links |
| Accent hover | `#4C6EF5` | Hover de botones primarios |
| Soft accent | `#7C8AA5` | Acentos secundarios |
| Success | `#4CAF7A` | Scores altos, feedback positivo |
| Warning | `#D6A54A` | Scores medios, alertas |
| Error | `#D96B6B` | Scores bajos, errores |

### 9.2 Tipografia

| Estilo | Font | Peso | Tamano (rem) |
|--------|------|------|--------------|
| h1 | Geist | 600 | 2.0 (32px) |
| h2 | Geist | 600 | 1.5 (24px) |
| h3 | Geist | 500 | 1.25 (20px) |
| body-lg | Geist | 400 | 1.125 (18px) |
| body-md | Geist | 400 | 1.0 (16px) |
| body-sm | Geist | 400 | 0.875 (14px) |
| label-uppercase | JetBrains Mono | 600 | 0.6875 (11px) |
| code-md | JetBrains Mono | 400 | 0.875 (14px) |
| code-sm | JetBrains Mono | 400 | 0.75 (12px) |

### 9.3 Espaciado

| Token | Valor | Uso |
|-------|-------|-----|
| xs | 4px | Espaciado minimo |
| sm | 8px | Entre elementos relacionados |
| md | 16px | Espaciado base entre componentes |
| lg | 24px | Entre secciones relacionadas |
| xl | 40px | Entre secciones mayores |
| margin-mobile | 16px | Margen lateral en mobile |
| margin-desktop | 32px | Margen lateral en desktop |

### 9.4 Reglas de Diseno

1. **No modificar la estetica visual existente.** Solo se modificara la logica
   y se agregaran nuevos elementos UI siguiendo los patrones actuales.
2. **Consistencia de paleta.** Usar solo los colores definidos arriba.
3. **UI en espanol.** Todo texto visible en la interfaz debe estar en espanol.
4. **Accesibilidad.** Contraste suficiente, foco visible, soporte teclado.
5. **Responsive.** Stack vertical en mobile, grid en desktop.

---

## 10. Plan de Implementacion

### 10.1 Orden de Archivos por Fase

```
FASE 1 — Base de Datos
───────────────────────
  1. backend/db/schema.sql    → Agregar nuevas columnas y tablas v3.0
  2. backend/db/queries.js    → Agregar ~12 nuevas funciones de consulta

FASE 2 — Servicios
───────────────────
  3. backend/services/ai.js   → Modificar prompts para dificultad + criteriaScores + tags

FASE 3 — Rutas (crear y modificar)
───────────────────────────────────
  4. backend/routes/helpers.js    → Agregar parseQueryParams()
  5. backend/routes/areas.js      → Devolver icon + popular
  6. backend/routes/interview.js  → Difficulty, per-question AI, transcript, detail
  7. backend/routes/history.js    → Paginacion, filtros, stats, session detail
  8. backend/routes/dashboard.js  → CREAR (nuevo)
  9. backend/routes/user.js       → CREAR (nuevo)
 10. backend/server.js            → Registrar nuevas rutas

FASE 4 — Frontend
──────────────────
 11. frontend/js/app.js   → Nuevos features (dificultad, stats, filtros, etc.)
 12. frontend/index.html  → Nuevos elementos UI (manteniendo estetica)
```

### 10.2 Dependencias entre archivos

```
schema.sql ← sin dependencias
   └── queries.js ← depende de schema.sql
        ├── ai.js ← sin dependencias directas de DB
        ├── routes/*.js ← dependen de queries.js + services/*.js
        │    └── server.js ← depende de todas las rutas
        └── app.js + index.html ← dependen de las rutas API
```

---

## 11. Reglas y Convenciones

### 11.1 Codigo

| Regla | Descripcion |
|-------|-------------|
| R01 | SIN frameworks backend (ni Express, ni Fastify, ni Koa) |
| R02 | SIN librerias frontend (ni React, ni Vue, ni Alpine, ni jQuery) |
| R03 | Tailwind CSS solo via CDN (no npm install, no build step) |
| R04 | Queries SQL siempre parametrizadas ($1, $2, ...) |
| R05 | Variables en camelCase en JS (tanto frontend como backend) |
| R06 | Nombres de tablas y columnas en snake_case |
| R07 | Archivos JS en kebab-case (ej: `interview.js`, no `interviewRoute.js`) |
| R08 | Todo texto visible debe estar en espanol |
| R09 | Sin comentarios en el codigo (a menos que sea estrictamente necesario) |
| R10 | Respuestas API siempre con `{ success: true/false, data/error }` |

### 11.2 Base de Datos

| Regla | Descripcion |
|-------|-------------|
| D01 | Tablas con nombre en plural (users, sessions, interviews) |
| D02 | PK siempre `id SERIAL PRIMARY KEY` |
| D03 | FK siempre con `ON DELETE CASCADE` excepto casos justificados |
| D04 | CHECK constraints para campos con valores fijos conocidos |
| D05 | UNIQUE constraints para campos que deben ser unicos |
| D06 | Index en todas las FK y campos de busqueda frecuente |
| D07 | Timestamps siempre con `TIMESTAMPTZ` y `DEFAULT NOW()` |
| D08 | Nuevas columnas v3.0 deben tener DEFAULT para retrocompatibilidad |

### 11.3 API

| Regla | Descripcion |
|-------|-------------|
| A01 | Codigos HTTP: 200 exito, 201 creado, 400 bad request, 401 no auth, 403 prohibido, 404 no encontrado, 409 conflicto, 500 error server |
| A02 | Errores de validacion devolver 400 con mensaje claro |
| A03 | Endpoints siempre con prefijo `/api/` |
| A04 | Rutas protegidas validar Bearer token al inicio del handler |
| A05 | CORS habilitado globalmente con `*` |
| A06 | OPTIONS respondido con 204 para preflight |

### 11.4 Frontend

| Regla | Descripcion |
|-------|-------------|
| F01 | SPA en un solo HTML (index.html) con vistas en divs |
| F02 | Navegacion entre vistas con JS puro (classList) |
| F03 | Fetch API para todas las llamadas al backend |
| F04 | Errores de red mostrados como toast flotante |
| F05 | Loading state mostrado como overlay con spinner |
| F06 | Estado global en objeto `state` en app.js |
| F07 | No modificar la estetica visual existente (colores, fuentes, espaciado) |
| F08 | Nuevos elementos UI deben seguir los patrones de diseno actuales |

### 11.5 IA

| Regla | Descripcion |
|-------|-------------|
| I01 | Respuestas siempre forzadas a JSON mediante prompt engineering |
| I02 | Fallback seguro si falla parseo JSON (score 50, feedback generico) |
| I03 | Sin cache de respuestas IA |
| I04 | System prompts estrictos para evitar texto fuera del JSON |
| I05 | Error de red capturado y manejado con mensaje al usuario |

---

> Fin de SPEC.md v3.0
> Proximo paso: Implementar FASE 1 (schema.sql + queries.js)
