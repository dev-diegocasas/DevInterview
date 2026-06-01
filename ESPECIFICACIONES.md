# Especificaciones Técnicas — DevInterview

## Visión general

**DevInterview** es una plataforma de simulación de entrevistas técnicas que utiliza inteligencia artificial para generar preguntas personalizadas, evaluar respuestas y proporcionar retroalimentación detallada. Está diseñada para desarrolladores que desean practicar y mejorar su desempeño en procesos de selección técnicos.

### Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (SPA)                          │
│  index.html + app.js (Vanilla JS)                              │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────────┐     │
│  │ Landing │ │ Auth     │ │ App     │ │ Standalone pages │     │
│  │ (hero,  │ │ (login,  │ │ (chat,  │ │ (reset-password, │     │
│  │  pasos) │ │  reg)    │ │  quiz,  │ │  verify-email)   │     │
│  └─────────┘ └──────────┘ │  dash)  │ └──────────────────┘     │
│                           └─────────┘                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │ fetch() / JSON
┌───────────────────────────▼─────────────────────────────────────┐
│                   BACKEND (Node.js HTTP nativo)                  │
│  server.js → routing manual → 10 archivos de rutas              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ auth     │ │ interview│ │ quiz     │ │ notifications    │   │
│  │ register │ │ start    │ │ start    │ │ CRUD, unread     │   │
│  │ login    │ │ answer   │ │ submit   │ │ count, mark read │   │
│  │ verify   │ │ finish   │ │          │ └──────────────────┘   │
│  │ reset    │ │ resume   │ │          │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ services │ │ db       │ │ email    │ │ helpers          │   │
│  │ ai.js    │ │ queries  │ │ smtpSend │ │ parse, sendJSON  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ pg (node-postgres)
┌───────────────────────────▼─────────────────────────────────────┐
│                PostgreSQL (Neon Serverless)                      │
│  15 tablas: users, sessions, interviews, questions, answers,    │
│  evaluations, notifications, email_verifications, password_resets│
│  user_goals, practice_days, quiz_questions, technical_areas     │
│  + 4 vistas materializadas para analytics                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Objetivo central del sistema

Permitir que un usuario:

1. **Se registre y verifique su identidad** mediante correo electrónico (flujo completo de verificación + seguridad)
2. **Seleccione un área técnica y nivel de dificultad** (Frontend, Backend, Bases de Datos, Algoritmos; Junior/Mid/Senior)
3. **Realice una entrevista simulada por chat con IA** que:
   - Genera preguntas contextuales adaptadas al nivel y respuestas anteriores
   - Evalúa cada respuesta con 3 criterios: fortalezas, debilidades, aspectos a mejorar
   - Produce una evaluación final con puntuación, competencias y recomendaciones
4. **Complete cuestionarios de opción múltiple** con temporizador y retroalimentación inmediata
5. **Consulte su progreso** mediante un dashboard con KPIs, gráficas de rendimiento y sesiones activas
6. **Reciba notificaciones** de sus actividades (bienvenida, inicio/fin de sesiones)
7. **Recupere su contraseña** mediante enlace seguro por correo

---

## Explicación detallada de funciones clave

### 1. Sistema de autenticación con verificación de email

#### 1.1 Registro (`register` en `backend/routes/auth.js`)

```
Entrada: { fullName, email, password }
Salida:  { message, email }

Flujo:
1. Validar campos requeridos, password >= 6 caracteres, email contiene @
2. Verificar si el email ya existe en BD
   ├─ Si existe y email_verified = false → reenviar token de verificación
   └─ Si existe y email_verified = true  → error 409 "Email ya registrado"
3. Hash de password con scrypt (salt aleatorio de 16 bytes, key de 64 bytes)
4. Crear usuario en BD con account_status = 'pending', email_verified = false
5. Generar token UUID de verificación (24h de expiración)
6. Crear registro en email_verifications
7. Crear notificación de bienvenida
8. Enviar email de verificación vía SMTP
   ├─ Éxito → 201 "Cuenta creada. Revisa tu correo."
   └─ Falla → 201 "Cuenta creada pero no se pudo enviar correo."
```

**Seguridad:**
- Password almacenada como `salt:hash` (scrypt + salt de 16 bytes)
- Token de verificación de un solo uso (UUID v4)
- Expiraciones: verificación 24h, reset password 1h
- Rate limiting: 1 solicitud de reset cada 5 minutos
- No se revela si el email existe en forgot-password (respuesta genérica)

#### 1.2 Flujo SMTP (`smtpSend` en `backend/services/email.js`)

El servidor implementa un cliente SMTP desde cero usando `tls.connect()`:

```
Conexión: TLS sobre puerto 465 (implicit TLS)
Handshake:
  1. ← 220 smtp.gmail.com
  2. → EHLO localhost
  3. ← 250 ... (lista de capacidades SMTP)
  4. → AUTH LOGIN
  5. ← 334 VXNlcm5hbWU6 ("Username:")
  6. → Base64(SMTP_USER)
  7. ← 334 UGFzc3dvcmQ6 ("Password:")
  8. → Base64(SMTP_PASS sin espacios)
  9. ← 235 Authentication successful
Envío:
  10. → MAIL FROM:<remitente>
  11. ← 250 Ok
  12. → RCPT TO:<destinatario>
  13. ← 250 Ok
  14. → DATA
  15. ← 354 Start mail input
  16. → Headers + cuerpo HTML (base64)
  17. ← 250 Ok
  18. → QUIT
```

El `SMTP_PASS` se limpia de espacios con `.replace(/\s+/g, '')` porque Gmail muestra los app passwords con espacios para legibilidad, pero la autenticación requiere los 16 caracteres sin espacios.

---

### 2. Entrevista chat con IA (4 niveles de tolerancia a fallos)

#### 2.1 Generación de preguntas (`generateFirstQuestion` / `generateFollowUpQuestion`)

El sistema implementa una **arquitectura de 4 niveles de respaldo**:

```
Tier 1 → OpenRouter + Nemotron Nano (gratuito)
  ↓ si falla (rate limit, timeout, error)
Tier 2 → OpenRouter + Llama 3.3 70B (modelo de respaldo)
  ↓ si falla
Tier 3 → Hugging Face Inference API (Mistral 7B)
  ↓ si falla
Tier 4 → Banco local de ~120 preguntas hardcodeadas (siempre funciona)
```

Cada nivel de respaldo tiene:
- **Timeout** de 30s en OpenRouter, 20s en Hugging Face
- **Reintentos** automáticos (2 intentos) en OpenRouter para errores transitorios
- **Detección de rate limit**: si OpenRouter responde con "rate limit", "429", "quota", se salta inmediatamente al siguiente tier

#### 2.2 Evaluación de respuestas (`evaluateAnswer`)

Cada respuesta del usuario se evalúa con un prompt que solicita JSON estructurado:

```
Prompt:
  System: "Eres un evaluador tecnico. Responde UNICAMENTE en JSON valido..."
  User:   "Pregunta: '{pregunta}'\nRespuesta: '{respuesta}'\nEvalua claridad,
           precision y profundidad. Identifica fortalezas, debilidades y
           aspectos a mejorar. Devuelve SOLO JSON valido."

Respuesta esperada:
  {
    "score": 75,
    "strengths": "Cubriste los conceptos clave de closures en JavaScript.",
    "weaknesses": "No mencionaste el garbage collection ni fugas de memoria.",
    "improvements": "Practica ejemplos de closures con setTimeout y loops."
  }
```

Si el JSON devuelto por la IA no es válido, el sistema aplica limpieza con regex (`\{[\s\S]*\}`) para extraer el objeto JSON del texto circundante. Si aún así falla, se ejecuta `localEvaluateAnswer` que analiza:

- **Cobertura de keywords** (30% de la nota): compara palabras clave de la pregunta con la respuesta
- **Profundidad técnica** (30%): cuenta términos técnicos especializados (API, REST, async, closure, etc.)
- **Longitud** (20%): relación con 300 caracteres base
- **Estructura** (20%): detecta código, listas, párrafos

#### 2.3 Reanudación de sesión (resume)

Cuando un usuario inicia una entrevista y ya tiene una en progreso:

```
1. Backend busca: SELECT * FROM interviews WHERE user_id=? AND area_id=? AND status='in_progress'
2. Si existe, obtiene preguntas respondidas y no respondidas
3. Devuelve: qaPairs (con feedback incluido) + currentQuestion
4. Frontend reconstruye el chat completo (preguntas, respuestas, feedbacks)
5. Continúa desde la primera pregunta sin responder
```

---

### 3. Sistema de cuestionarios con bloqueo de salida

#### 3.1 Flujo del cuestionario

```
1. startQuizRoute → selecciona preguntas del banco quiz_questions
   (intenta dificultad preferida, completa con otras si faltan)
2. Crea entrevista con type='quiz'
3. Frontend inicia temporizador de 10 minutos
4. Usuario navega entre preguntas (anterior/siguiente)
5. Al enviar (o al terminar tiempo):
   └─ submitQuizRoute → evalúa respuestas contra correct_answer
                      → guarda en evaluations.criteria_scores (JSON con resultados)
                      → actualiza interview con status='completed'
```

#### 3.2 Bloqueo de salida

Cuando el cuestionario está activo (`quizState.active = true`):

```
Intento de navegación:
  ¿quizState.active?
    ├─ Sí → attemptLeaveQuiz()
    │       ├─ Muestra modal "¿Abandonar cuestionario?"
    │       ├─ Seguir respondiendo → oculta modal, continúa
    │       └─ Terminar y evaluar → submitQuizAnswers() con respuestas parciales
    └─ No → navegación normal
```

**Protecciones adicionales:**
- `window.addEventListener('beforeunload', ...)` → muestra confirmación nativa del navegador
- `showAppView()` interceptada para evitar cambiar de vista sin confirmación
- Navegación móvil interceptada para evitar salir desde el menú lateral

---

### 4. Dashboard con indicadores y gráficas CSS

#### 4.1 KPIs principales

| Métrica | Cálculo | Consulta SQL |
|---------|---------|--------------|
| Total entrevistas | COUNT(id) | `getDashboardStats` |
| Cuestionarios completados | COUNT FILTER (status='completed' AND type='quiz') | `getDashboardStats` |
| Promedio general | AVG(score) FILTER (status='completed') | `getDashboardStats` |
| Racha actual | Días consecutivos con práctica | `getCurrentStreak` |
| Progreso semanal | COUNT en la semana actual / meta | `user_weekly_progress` |

#### 4.2 Gráficas sin librerías

Todas las visualizaciones están hechas con CSS y SVG puros:

- **Barras de rendimiento por área:** Divs con `height: 6px` y `width: X%` coloreados según rango (verde ≥ 70, amarillo ≥ 40, rojo < 40)
- **Historial de sesiones:** Lista horizontal con barras proporcionales + icono de tipo (chat/quiz)
- **Círculo de progreso semanal:** SVG `<circle>` con `stroke-dasharray` y `stroke-dashoffset` calculados dinámicamente:
  ```javascript
  var circumference = 2 * Math.PI * 34; // 213.6
  var offset = circumference - (progreso / meta) * circumference;
  circle.setAttribute('stroke-dashoffset', offset);
  ```

---

### 5. Sistema de notificaciones

#### 5.1 Tabla y queries

```sql
CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL DEFAULT 'system',
    title       VARCHAR(255) NOT NULL,
    message     TEXT,
    link        VARCHAR(500),
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Tipos de notificación: `welcome`, `interview_started`, `interview_completed`, `quiz_started`, `quiz_completed`, `system`.

#### 5.2 Disparadores (triggers)

Las notificaciones se crean automáticamente en los siguientes puntos del backend:

| Evento | Archivo | Línea |
|--------|---------|-------|
| Registro exitoso | `auth.js → register()` | 68 |
| Inicio de entrevista chat | `interview.js → startInterview()` | 128, 162, 182 |
| Entrevista completada | `interview.js → finishInterviewRoute()` | 332 |
| Inicio de cuestionario | `quiz.js → startQuizRoute()` | 27 |
| Cuestionario completado | `quiz.js → submitQuizRoute()` | 102 |

#### 5.3 Frontend: polling y visualización

- `startNotifPolling()` inicia un intervalo de 30s que consulta `GET /api/notifications/unread-count`
- El badge rojo en la campana muestra el número de no leídas (oculto si es 0)
- El dropdown muestra las últimas 5 notificaciones con indicador de leída/no leída
- La página completa (`view-notifications`) muestra todas con paginación
- Click en notificación no leída → `PUT /api/notifications/:id/read`

---

### 6. Integración con IA (OpenRouter)

#### 6.1 Formato de los prompts

Cada función de IA construye un array de mensajes en formato ChatML:

```javascript
var messages = [
    { role: 'system', content: 'Eres un entrevistador tecnico...' },
    { role: 'user', content: 'Genera una pregunta sobre...' }
];
```

#### 6.2 Timeout y reintentos

```javascript
req.setTimeout(30000, function () {
    req.destroy();
    // Reintentar si quedan intentos
});
```

- Primer intento: modelo primario (Nemotron Nano)
- Segundo intento: modelo secundario (Llama 70B)
- Si ambos fallan: Hugging Face (Mistral 7B)
- Si todo falla: banco de preguntas local

---

## Base de datos: esquema relacional

### Tablas principales

| Tabla | Propósito | Columnas clave |
|-------|-----------|----------------|
| `users` | Cuentas de usuario | `id`, `email`, `password_hash`, `account_status`, `email_verified` |
| `sessions` | Tokens de autenticación | `id`, `user_id`, `token`, `expires_at` |
| `interviews` | Sesiones de entrevista | `id`, `user_id`, `area_id`, `type` (chat/quiz), `status` (in_progress/completed), `score` |
| `questions` | Preguntas generadas por IA | `id`, `interview_id`, `question_text`, `question_order` |
| `answers` | Respuestas del usuario | `id`, `question_id`, `answer_text`, `ai_feedback` (JSON), `ai_score` |
| `evaluations` | Evaluaciones finales | `id`, `interview_id`, `score`, `strengths`, `improvements`, `criteria_scores` (JSONB) |
| `notifications` | Notificaciones del sistema | `id`, `user_id`, `type`, `title`, `message`, `read` |
| `email_verifications` | Tokens de verificación | `id`, `user_id`, `token`, `expires_at`, `used` |
| `password_resets` | Tokens de recuperación | `id`, `user_id`, `token`, `expires_at`, `used` |
| `quiz_questions` | Banco de preguntas MCQ | `id`, `area_id`, `question_text`, `options` (JSONB), `correct_answer` |
| `technical_areas` | Catálogo de áreas técnicas | `id`, `name`, `slug`, `description`, `icon` |

### Vistas materializadas

| Vista | Propósito |
|-------|-----------|
| `user_progress` | Evolución temporal de puntuaciones por usuario y área |
| `user_stats` | Estadísticas agregadas por usuario y área |
| `user_dashboard_stats` | Métricas globales del dashboard |
| `user_weekly_progress` | Conteo de sesiones en la semana actual |
| `area_popularity` | Ranking de áreas por uso |

---

## API REST: endpoints disponibles

### Autenticación
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/auth/register` | Crear cuenta + enviar verificación |
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/logout` | Cerrar sesión |
| GET | `/api/auth/me` | Verificar sesión actual |
| GET | `/api/auth/verify-email?token=` | Verificar correo |
| POST | `/api/auth/resend-verification` | Reenviar verificación |
| POST | `/api/auth/forgot-password` | Solicitar reset de contraseña |
| POST | `/api/auth/reset-password` | Restablecer contraseña |

### Entrevistas
| Método | Ruta | Propósito |
|--------|------|-----------|
| POST | `/api/interview/start` | Iniciar/reanudar entrevista |
| POST | `/api/interview/answer` | Enviar respuesta, recibir feedback |
| POST | `/api/interview/finish` | Finalizar y evaluar |

### Dashboard
| GET | `/api/dashboard/stats` | KPIs, gráficas, sesiones activas |

### Historial
| GET | `/api/history` | Lista paginada con filtros |
| GET | `/api/history/:id` | Detalle de sesión |

### Notificaciones
| GET | `/api/notifications` | Lista paginada |
| GET | `/api/notifications/unread-count` | Contador no leídas |
| PUT | `/api/notifications/:id/read` | Marcar como leída |
| PUT | `/api/notifications/read-all` | Marcar todas leídas |

### Debug (solo diagnóstico)
| GET | `/api/debug/info` | Estado del servidor |
| GET | `/api/debug/smtp-status` | Configuración SMTP |

---

## Consideraciones de seguridad

1. **Contraseñas:** Hash con `crypto.scryptSync` (salt aleatorio de 16 bytes, key de 64 bytes)
2. **Tokens:** UUID v4 generados con `crypto.randomUUID()`
3. **Sesiones:** 7 días de expiración, almacenadas en BD con referencia al usuario
4. **CORS:** Origen configurable mediante `FRONTEND_URL` (permisivo solo en desarrollo)
5. **Headers de seguridad:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` en producción
6. **SQL Injection:** Todas las consultas usan parámetros con `$1`, `$2` (parametrizadas)
7. **Rate limiting:** 1 solicitud de reset password cada 5 minutos por usuario
8. **Path traversal:** Las rutas de archivos estáticos se normalizan y verifican contra `FRONTEND_DIR`
