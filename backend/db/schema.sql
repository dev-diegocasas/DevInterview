-- ====================================================================
-- DevInterview — Schema de Base de Datos
-- Motor: PostgreSQL (hosteado en Neon, SSL obligatorio)
-- Versión: 2.0
-- ====================================================================

-- ....................................................................
-- NOTA: Para Neon, ejecutar con sslmode=require
-- psql "postgresql://..." -f schema.sql
-- ....................................................................

BEGIN;

-- ====================================================================
-- MÓDULO 1: Autenticación y perfil de usuario
-- ====================================================================

-- Tabla: users
-- Propósito: Almacena cuentas de usuario con datos de perfil y
-- credenciales. El password se guarda con hash bcrypt. El nivel
-- técnico define el seniority del candidato.
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(150)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    password_hash   VARCHAR(255)    NOT NULL,
    photo_url       VARCHAR(500),
    bio             TEXT,
    tech_level      VARCHAR(20)     NOT NULL DEFAULT 'junior'
                    CHECK (tech_level IN ('junior', 'mid', 'senior')),
    account_status  VARCHAR(20)     NOT NULL DEFAULT 'active'
                    CHECK (account_status IN ('active', 'inactive')),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

COMMENT ON TABLE users IS 'Cuentas de usuario con perfil y credenciales';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt de la contraseña';
COMMENT ON COLUMN users.tech_level IS 'Nivel técnico: junior, mid, senior';
COMMENT ON COLUMN users.account_status IS 'Estado: active, inactive';
COMMENT ON COLUMN users.last_login IS 'Último inicio de sesión exitoso';

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_tech_level ON users (tech_level);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);

-- Tabla: sessions
-- Propósito: Maneja tokens de sesión para autenticación persistente.
-- Cada login genera un nuevo token con fecha de expiración.
CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255)    NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ     NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Tokens de sesión para autenticación';
COMMENT ON COLUMN sessions.token IS 'Token único tipo UUID';
COMMENT ON COLUMN sessions.expires_at IS 'Fecha de expiración del token';

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ====================================================================
-- MÓDULO 2: Áreas técnicas
-- ====================================================================

-- Tabla: technical_areas
-- Propósito: Catálogo de áreas técnicas disponibles para entrevistas.
-- El slug se usa en URLs amigables.
CREATE TABLE IF NOT EXISTS technical_areas (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL UNIQUE,
    slug        VARCHAR(100)    NOT NULL UNIQUE,
    description TEXT            NOT NULL,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE technical_areas IS 'Catálogo de áreas técnicas para entrevistas';
COMMENT ON COLUMN technical_areas.slug IS 'Identificador para URLs (ej: frontend, backend)';
COMMENT ON COLUMN technical_areas.is_active IS 'TRUE si el área está disponible para entrevistas';

-- ====================================================================
-- MÓDULO 3: Sesiones de entrevista
-- ====================================================================

-- Tabla: interviews
-- Propósito: Registra cada sesión de entrevista iniciada por un
-- usuario. El estado refleja si está en curso, completada o
-- abandonada. El puntaje global se actualiza al finalizar.
CREATE TABLE IF NOT EXISTS interviews (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_id             INTEGER         REFERENCES technical_areas(id) ON DELETE RESTRICT,
    status              VARCHAR(20)     NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    questions_answered  INTEGER         NOT NULL DEFAULT 0
                        CHECK (questions_answered >= 0),
    score               INTEGER         CHECK (score >= 0 AND score <= 100),
    started_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    finished_at         TIMESTAMPTZ
);

COMMENT ON TABLE interviews IS 'Sesiones de entrevista técnica';
COMMENT ON COLUMN interviews.status IS 'Estado: in_progress, completed, abandoned';
COMMENT ON COLUMN interviews.questions_answered IS 'Cantidad de preguntas respondidas en la sesión';
COMMENT ON COLUMN interviews.score IS 'Puntaje global (0-100), se llena al finalizar';
COMMENT ON COLUMN interviews.finished_at IS 'NULL mientras la entrevista está en curso';

CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews (user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_area_id ON interviews (area_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews (status);
CREATE INDEX IF NOT EXISTS idx_interviews_started_at ON interviews (started_at DESC);

-- ====================================================================
-- MÓDULO 4: Preguntas y respuestas
-- ====================================================================

-- Tabla: questions
-- Propósito: Almacena las preguntas generadas por IA para cada
-- entrevista, en el orden en que se presentaron al usuario.
CREATE TABLE IF NOT EXISTS questions (
    id              SERIAL PRIMARY KEY,
    interview_id    INTEGER         NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    question_text   TEXT            NOT NULL,
    question_order  INTEGER         NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE questions IS 'Preguntas generadas por IA en cada entrevista';
COMMENT ON COLUMN questions.question_order IS 'Orden de aparición en la entrevista';

CREATE INDEX IF NOT EXISTS idx_questions_interview_id ON questions (interview_id);

-- Tabla: answers
-- Propósito: Guarda las respuestas escritas por el usuario para
-- cada pregunta. Cada respuesta tiene su timestamp individual.
CREATE TABLE IF NOT EXISTS answers (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER         NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT            NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE answers IS 'Respuestas del usuario a cada pregunta';
COMMENT ON COLUMN answers.answer_text IS 'Texto libre escrito por el usuario';

CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers (question_id);

-- ====================================================================
-- MÓDULO 5: Evaluaciones
-- ====================================================================

-- Tabla: evaluations
-- Propósito: Almacena la evaluación generada por IA al finalizar
-- una entrevista. Incluye puntaje, feedback, fortalezas y áreas
-- de mejora. Una evaluación por entrevista (restricción UNIQUE).
CREATE TABLE IF NOT EXISTS evaluations (
    id              SERIAL PRIMARY KEY,
    interview_id    INTEGER         NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    score           INTEGER         NOT NULL CHECK (score >= 0 AND score <= 100),
    feedback        TEXT            NOT NULL,
    strengths       TEXT,
    improvements    TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE evaluations IS 'Evaluación generada por IA al finalizar entrevista';
COMMENT ON COLUMN evaluations.score IS 'Puntaje numérico (0-100)';
COMMENT ON COLUMN evaluations.feedback IS 'Feedback detallado del desempeño';
COMMENT ON COLUMN evaluations.strengths IS 'Fortalezas identificadas por la IA';
COMMENT ON COLUMN evaluations.improvements IS 'Áreas de mejora sugeridas';

CREATE INDEX IF NOT EXISTS idx_evaluations_interview_id ON evaluations (interview_id);

-- ====================================================================
-- VISTAS AUXILIARES (MÓDULO 6: Historial y estadísticas)
-- ====================================================================

-- Vista: user_progress
-- Propósito: Muestra la evolución del puntaje por usuario y área
-- a lo largo del tiempo, útil para gráficas de progreso.
CREATE OR REPLACE VIEW user_progress AS
SELECT
    i.user_id,
    u.full_name,
    ta.name    AS area_name,
    i.id       AS interview_id,
    i.score,
    i.started_at,
    i.finished_at,
    ROW_NUMBER() OVER (
        PARTITION BY i.user_id, i.area_id
        ORDER BY i.started_at
    ) AS attempt_number
FROM interviews i
JOIN users u           ON u.id = i.user_id
JOIN technical_areas ta ON ta.id = i.area_id
WHERE i.status = 'completed'
  AND i.score IS NOT NULL
ORDER BY i.user_id, i.area_id, i.started_at;

COMMENT ON VIEW user_progress IS 'Evolución temporal de puntajes por usuario y área';

-- Vista: user_stats
-- Propósito: Estadísticas agregadas por usuario y área técnica:
-- promedio, total de entrevistas, mejor y peor puntaje.
CREATE OR REPLACE VIEW user_stats AS
SELECT
    i.user_id,
    u.full_name,
    u.tech_level,
    ta.name            AS area_name,
    COUNT(i.id)        AS total_interviews,
    ROUND(AVG(i.score), 1) AS avg_score,
    MAX(i.score)       AS best_score,
    MIN(i.score)       AS worst_score,
    MAX(i.finished_at) AS last_interview_at
FROM interviews i
JOIN users u           ON u.id = i.user_id
JOIN technical_areas ta ON ta.id = i.area_id
WHERE i.status = 'completed'
  AND i.score IS NOT NULL
GROUP BY i.user_id, u.full_name, u.tech_level, ta.name
ORDER BY i.user_id, ta.name;

COMMENT ON VIEW user_stats IS 'Estadísticas agregadas por usuario y área técnica';

-- ====================================================================
-- DATOS DE EJEMPLO
-- ====================================================================

-- Contraseña de ejemplo: "Test1234" (bcrypt hash generado con 10 rounds)
INSERT INTO users (full_name, email, password_hash, bio, tech_level) VALUES
    ('Ana García López',   'ana@example.com',   '$2b$10$EjemploHashBcryptAna1234567890abcdefghij', 'Desarrolladora frontend con 3 años de experiencia', 'junior'),
    ('Carlos Mendoza R',   'carlos@example.com', '$2b$10$EjemploHashBcryptCarlos1234567890abcdefghi', 'Backend developer especializado en APIs',            'mid'),
    ('María Fernández',    'maria@example.com',  '$2b$10$EjemploHashBcryptMaria1234567890abcdefghij', 'Tech lead con 8 años en la industria',              'senior')
ON CONFLICT (email) DO NOTHING;

-- Áreas técnicas disponibles
INSERT INTO technical_areas (name, slug, description) VALUES
    ('Frontend',       'frontend',       'HTML, CSS, JavaScript, React, Vue, accesibilidad, rendimiento web y patrones de diseño de UI.'),
    ('Backend',        'backend',        'APIs REST, Node.js, Python, bases de datos, autenticación, arquitectura de microservicios.'),
    ('Bases de Datos', 'bases-de-datos', 'SQL, PostgreSQL, índices, normalización, transacciones, optimización de consultas y modelado.'),
    ('Algoritmos',     'algoritmos',     'Estructuras de datos, complejidad algorítmica, recursión, ordenamiento, grafos y programación dinámica.'),
    ('Desarrollo Móvil','desarrollo-movil', 'React Native, Flutter, Swift, Kotlin, ciclo de vida de apps, state management y publicación.')
ON CONFLICT (name) DO NOTHING;

-- Entrevista de ejemplo completada
INSERT INTO interviews (user_id, area_id, status, questions_answered, score, started_at, finished_at) VALUES
    (1, 1, 'completed', 5, 78, '2026-04-15 10:00:00-05', '2026-04-15 10:30:00-05'),
    (2, 2, 'completed', 5, 85, '2026-04-20 14:00:00-05', '2026-04-20 14:35:00-05'),
    (3, 1, 'completed', 5, 92, '2026-05-01 09:00:00-05', '2026-05-01 09:28:00-05');

-- Preguntas de ejemplo para la primera entrevista
INSERT INTO questions (interview_id, question_text, question_order) VALUES
    (1, '¿Qué diferencia hay entre flexbox y CSS Grid? ¿En qué casos usarías cada uno?', 1),
    (1, 'Explica el concepto de "event delegation" en JavaScript y da un ejemplo práctico.', 2),
    (1, '¿Qué es el Virtual DOM y cómo mejora el rendimiento en frameworks como React?', 3),
    (1, 'Describe la diferencia entre accesibilidad y usabilidad. ¿Cómo medirías cada una?', 4),
    (1, '¿Qué son los Web Vitals y por qué son importantes para el SEO?', 5);

-- Respuestas de ejemplo
INSERT INTO answers (question_id, answer_text) VALUES
    (1, 'Flexbox es unidimensional y Grid es bidimensional. Usaría flexbox para barras de navegación y Grid para layouts de página completos.'),
    (2, 'Event delegation es asignar un listener a un padre para manejar eventos de sus hijos, usando event.target para identificar el elemento origen.'),
    (3, 'El Virtual DOM es una copia ligera del DOM real. React compara el virtual DOM anterior con el nuevo y solo aplica los cambios necesarios al DOM real.'),
    (4, 'La accesibilidad se enfoca en que personas con discapacidades puedan usar el sitio. La usabilidad mide qué tan fácil es de usar para todos. Se miden con herramientas como Lighthouse y pruebas de usuario.'),
    (5, 'Los Web Vitals son métricas de Google (LCP, FID, CLS) que miden rendimiento real. Impactan el SEO porque Google los usa como factor de ranking.');

-- Evaluación de ejemplo
INSERT INTO evaluations (interview_id, score, feedback, strengths, improvements) VALUES
    (1, 78, 'Buen desempeño general. Conoces los conceptos fundamentales de frontend. Destacaste en accesibilidad y Web Vitals. Necesitas profundizar más en Virtual DOM.', 'Sólido conocimiento de accesibilidad y métricas de rendimiento. Buena capacidad para explicar conceptos con ejemplos.', 'Profundizar en el funcionamiento interno del Virtual DOM y algoritmos de reconciliación. Practicar más escenarios de event delegation complejos.')
ON CONFLICT (interview_id) DO NOTHING;

COMMIT;
