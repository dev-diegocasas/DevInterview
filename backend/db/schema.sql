-- ====================================================================
-- DevInterview — Schema de Base de Datos v3.0
-- Motor: PostgreSQL (Neon, SSL obligatorio)
-- ====================================================================

BEGIN;

-- ====================================================================
-- MÓDULO 1: Autenticación y perfil de usuario
-- ====================================================================

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
COMMENT ON COLUMN users.password_hash IS 'Hash scrypt de la contraseña (salt:hash)';
COMMENT ON COLUMN users.tech_level IS 'Nivel técnico: junior, mid, senior';
COMMENT ON COLUMN users.account_status IS 'Estado: active, inactive';

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_tech_level ON users (tech_level);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users (account_status);

CREATE TABLE IF NOT EXISTS sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255)    NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ     NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Tokens de sesión para autenticación';
COMMENT ON COLUMN sessions.token IS 'Token UUID v4';

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ====================================================================
-- MÓDULO 2: Áreas técnicas
-- ====================================================================

CREATE TABLE IF NOT EXISTS technical_areas (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL UNIQUE,
    slug        VARCHAR(100)    NOT NULL UNIQUE,
    description TEXT            NOT NULL,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- v3.0: Migración de nuevas columnas para tablas existentes
ALTER TABLE technical_areas ADD COLUMN IF NOT EXISTS icon    VARCHAR(50);
ALTER TABLE technical_areas ADD COLUMN IF NOT EXISTS popular BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON TABLE technical_areas IS 'Catálogo de áreas técnicas para entrevistas';
COMMENT ON COLUMN technical_areas.slug IS 'Identificador para URLs (ej: frontend, backend)';
COMMENT ON COLUMN technical_areas.icon IS 'Nombre del icono Material Symbols';
COMMENT ON COLUMN technical_areas.popular IS 'TRUE si el área tiene badge de popular';

-- ====================================================================
-- MÓDULO 3: Sesiones de entrevista
-- ====================================================================

CREATE TABLE IF NOT EXISTS interviews (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_id             INTEGER REFERENCES technical_areas(id) ON DELETE RESTRICT,
    difficulty_level    VARCHAR(20) NOT NULL DEFAULT 'mid'
                        CHECK (difficulty_level IN ('junior', 'mid', 'senior')), -- v3.0
    type                VARCHAR(10) NOT NULL DEFAULT 'chat'
                        CHECK (type IN ('chat', 'quiz')), -- v4.0: chat con IA o quiz multiple choice
    status              VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    questions_answered  INTEGER         NOT NULL DEFAULT 0
                        CHECK (questions_answered >= 0),
    score               INTEGER         CHECK (score >= 0 AND score <= 100),
    started_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    finished_at         TIMESTAMPTZ
);

-- v3.0: Migración de nuevas columnas para interviews
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(20) NOT NULL DEFAULT 'mid'
    CHECK (difficulty_level IN ('junior', 'mid', 'senior'));
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS questions_total INTEGER NOT NULL DEFAULT 5
    CHECK (questions_total > 0 AND questions_total <= 20);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS duration_seconds INTEGER CHECK (duration_seconds >= 0);
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'chat'
    CHECK (type IN ('chat', 'quiz'));
UPDATE interviews SET type = 'chat' WHERE type IS NULL;

COMMENT ON TABLE interviews IS 'Sesiones de entrevista técnica';
COMMENT ON COLUMN interviews.difficulty_level IS 'Nivel de dificultad configurado al iniciar';
COMMENT ON COLUMN interviews.status IS 'Estado: in_progress, completed, abandoned';
COMMENT ON COLUMN interviews.questions_total IS 'Cantidad total de preguntas configuradas para esta sesión';
COMMENT ON COLUMN interviews.questions_answered IS 'Cantidad de preguntas respondidas';
COMMENT ON COLUMN interviews.score IS 'Puntaje global (0-100), se llena al finalizar';
COMMENT ON COLUMN interviews.duration_seconds IS 'Duración real en segundos';
COMMENT ON COLUMN interviews.finished_at IS 'NULL mientras la entrevista está en curso';

CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON interviews (user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_area_id ON interviews (area_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews (status);
CREATE INDEX IF NOT EXISTS idx_interviews_started_at ON interviews (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_interviews_user_status ON interviews (user_id, status);
CREATE INDEX IF NOT EXISTS idx_interviews_user_date ON interviews (user_id, started_at DESC);
-- v3.0: Nuevos índices
CREATE INDEX IF NOT EXISTS idx_interviews_difficulty ON interviews (difficulty_level);
CREATE INDEX IF NOT EXISTS idx_interviews_score ON interviews (score);

-- ====================================================================
-- MÓDULO 4: Preguntas y respuestas
-- ====================================================================

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
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions (interview_id, question_order);

CREATE TABLE IF NOT EXISTS answers (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER         NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT            NOT NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- v3.0: Migración de nuevas columnas para answers
ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS ai_score INTEGER CHECK (ai_score >= 0 AND ai_score <= 100);

COMMENT ON TABLE answers IS 'Respuestas del usuario a cada pregunta';
COMMENT ON COLUMN answers.ai_feedback IS 'Feedback de IA individual por respuesta';
COMMENT ON COLUMN answers.ai_score IS 'Puntaje de IA individual por respuesta (0-100)';

CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers (question_id);

-- ====================================================================
-- MÓDULO 5: Evaluaciones
-- ====================================================================

CREATE TABLE IF NOT EXISTS evaluations (
    id              SERIAL PRIMARY KEY,
    interview_id    INTEGER         NOT NULL UNIQUE REFERENCES interviews(id) ON DELETE CASCADE,
    score           INTEGER         NOT NULL CHECK (score >= 0 AND score <= 100),
    feedback        TEXT            NOT NULL,
    strengths       TEXT,
    improvements    TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- v3.0: Migración de nuevas columnas para evaluations
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS criteria_scores JSONB;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS tags TEXT[];

COMMENT ON TABLE evaluations IS 'Evaluación generada por IA al finalizar entrevista';
COMMENT ON COLUMN evaluations.score IS 'Puntaje numérico (0-100)';
COMMENT ON COLUMN evaluations.feedback IS 'Feedback detallado del desempeño';
COMMENT ON COLUMN evaluations.strengths IS 'Fortalezas identificadas por la IA';
COMMENT ON COLUMN evaluations.improvements IS 'Áreas de mejora sugeridas';
COMMENT ON COLUMN evaluations.criteria_scores IS 'Desglose por competencias: {precision, claridad, profundidad, comunicacion}';
COMMENT ON COLUMN evaluations.tags IS 'Etiquetas de habilidades identificadas';

CREATE INDEX IF NOT EXISTS idx_evaluations_interview_id ON evaluations (interview_id);

-- ====================================================================
-- MÓDULO 6: Metas y rachas (v3.0)
-- ====================================================================

CREATE TABLE IF NOT EXISTS user_goals (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    weekly_target   INTEGER         NOT NULL DEFAULT 5
                    CHECK (weekly_target > 0 AND weekly_target <= 30),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_goals IS 'Metas semanales de práctica por usuario';
COMMENT ON COLUMN user_goals.weekly_target IS 'Número objetivo de entrevistas por semana';

CREATE TABLE IF NOT EXISTS practice_days (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    practice_date   DATE            NOT NULL,
    UNIQUE (user_id, practice_date)
);

COMMENT ON TABLE practice_days IS 'Registro diario de práctica para calcular rachas';
COMMENT ON COLUMN practice_days.practice_date IS 'Fecha en que el usuario practicó (sin hora)';

CREATE INDEX IF NOT EXISTS idx_practice_days_user_id ON practice_days (user_id);
CREATE INDEX IF NOT EXISTS idx_practice_days_user_date ON practice_days (user_id, practice_date DESC);

-- Tabla: password_resets
CREATE TABLE IF NOT EXISTS password_resets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255)    NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ     NOT NULL,
    used        BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE password_resets IS 'Tokens para restablecimiento de contraseña';
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets (user_id);

-- ====================================================================
-- MÓDULO 7: Vistas auxiliares (v3.0 actualizadas)
-- ====================================================================

-- Vista: user_progress
-- Muestra la evolución del puntaje por usuario y área a lo largo del tiempo
DROP VIEW IF EXISTS user_progress CASCADE;
CREATE VIEW user_progress AS
SELECT
    i.user_id,
    u.full_name,
    ta.name    AS area_name,
    i.id       AS interview_id,
    i.score,
    i.difficulty_level,
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
-- Estadísticas agregadas por usuario y área técnica
DROP VIEW IF EXISTS user_stats CASCADE;
CREATE VIEW user_stats AS
SELECT
    i.user_id,
    u.full_name,
    u.tech_level,
    ta.name            AS area_name,
    COUNT(i.id)        AS total_interviews,
    ROUND(AVG(i.score), 1) AS avg_score,
    MAX(i.score)       AS best_score,
    MIN(i.score)       AS worst_score,
    ROUND(AVG(i.duration_seconds), 0)::INTEGER AS avg_duration_seconds,
    MAX(i.finished_at) AS last_interview_at
FROM interviews i
JOIN users u           ON u.id = i.user_id
JOIN technical_areas ta ON ta.id = i.area_id
WHERE i.status = 'completed'
  AND i.score IS NOT NULL
GROUP BY i.user_id, u.full_name, u.tech_level, ta.name
ORDER BY i.user_id, ta.name;

COMMENT ON VIEW user_stats IS 'Estadísticas agregadas por usuario y área técnica';

-- Vista: user_dashboard_stats
-- Estadísticas globales del dashboard para un usuario
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT
    i.user_id,
    COUNT(i.id)                                        AS total_interviews,
    COUNT(i.id) FILTER (WHERE i.status = 'completed')  AS completed_interviews,
    ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed'), 1) AS avg_score,
    MAX(i.score) FILTER (WHERE i.status = 'completed') AS best_score,
    MIN(i.score) FILTER (WHERE i.status = 'completed') AS worst_score,
    MAX(i.finished_at) FILTER (WHERE i.status = 'completed') AS last_interview_at
FROM interviews i
GROUP BY i.user_id;

COMMENT ON VIEW user_dashboard_stats IS 'Estadísticas globales del dashboard por usuario';

-- Vista: user_weekly_progress
-- Progreso semanal actual del usuario
CREATE OR REPLACE VIEW user_weekly_progress AS
SELECT
    i.user_id,
    COUNT(i.id) AS weekly_count
FROM interviews i
WHERE i.status = 'completed'
  AND i.finished_at >= date_trunc('week', CURRENT_TIMESTAMP)
GROUP BY i.user_id;

COMMENT ON VIEW user_weekly_progress IS 'Conteo de entrevistas completadas en la semana actual';

-- Vista: area_popularity
-- Ranking de popularidad de áreas por número de entrevistas
CREATE OR REPLACE VIEW area_popularity AS
SELECT
    ta.id,
    ta.name,
    ta.slug,
    ta.icon,
    COUNT(i.id) AS total_interviews,
    ROUND(AVG(i.score) FILTER (WHERE i.status = 'completed'), 1) AS avg_score
FROM technical_areas ta
LEFT JOIN interviews i ON i.area_id = ta.id
GROUP BY ta.id, ta.name, ta.slug, ta.icon
ORDER BY total_interviews DESC;

COMMENT ON VIEW area_popularity IS 'Ranking de áreas por uso y rendimiento';

-- ====================================================================
-- DATOS DE EJEMPLO
-- ====================================================================

-- Contraseña de ejemplo: "Test1234" (scrypt hash)
INSERT INTO users (full_name, email, password_hash, bio, tech_level) VALUES
    ('Ana García López',   'ana@example.com',   'salthash_ejemplo_ana', 'Desarrolladora frontend con 3 años de experiencia', 'junior'),
    ('Carlos Mendoza R',   'carlos@example.com', 'salthash_ejemplo_carlos', 'Backend developer especializado en APIs',            'mid'),
    ('María Fernández',    'maria@example.com',  'salthash_ejemplo_maria', 'Tech lead con 8 años en la industria',              'senior')
ON CONFLICT (email) DO NOTHING;

-- Metas semanales para usuarios de ejemplo
INSERT INTO user_goals (user_id, weekly_target) VALUES
    (1, 5), (2, 3), (3, 7)
ON CONFLICT (user_id) DO NOTHING;

-- Áreas técnicas (v3.0 con iconos y popular — actualiza existentes)
INSERT INTO technical_areas (name, slug, description, icon, popular) VALUES
    ('Frontend',       'frontend',       'HTML semantico, CSS Grid/Flexbox, JavaScript (ES6+), TypeScript, React, Vue, Angular, accesibilidad (WCAG), rendimiento web (Core Web Vitals), patrones de diseño UI, testing con Jest y Cypress.',
       'html',        TRUE),
    ('Backend',        'backend',        'APIs REST y GraphQL, Node.js, Python (Django/FastAPI), Java Spring, Go, microservicios, autenticacion (JWT, OAuth), patrones de diseño, manejo de errores, caching con Redis, mensajeria con RabbitMQ/Kafka.',
       'dns',         TRUE),
    ('Bases de Datos', 'bases-de-datos', 'SQL (PostgreSQL, MySQL), normalizacion, indices (B-tree, hash, GIN), transacciones ACID, optimizacion de queries (EXPLAIN ANALYZE), modelado entidad-relacion, NoSQL (MongoDB, Redis), migraciones y backups.',
       'database',    FALSE),
    ('Algoritmos',     'algoritmos',     'Estructuras de datos (listas, arboles, grafos, hash tables), complejidad Big O, recursion, algoritmos de ordenamiento (QuickSort, MergeSort), busqueda binaria, DFS, BFS, Dijkstra, programacion dinamica, dos punteros, sliding window.',
       'function',    TRUE),
    ('Desarrollo Móvil','desarrollo-movil', 'React Native, Flutter/Dart, Swift (iOS), Kotlin (Android), ciclo de vida de apps, state management (Redux, BLoC), navegacion, consumo de APIs, persistencia local, notificaciones push, publicación en stores.',
       'smartphone',  FALSE),
    ('Cloud & DevOps', 'cloud-devops',   'Docker, Kubernetes, AWS (EC2, S3, Lambda, RDS), CI/CD (GitHub Actions, Jenkins), Terraform, monitoreo (Prometheus, Grafana), escalado horizontal, balanceo de carga, estrategias de despliegue (blue-green, canary).',
       'cloud',       FALSE),
    ('Testing',        'testing',        'Pruebas unitarias (Jest, JUnit, PyTest), pruebas de integracion, E2E (Cypress, Playwright), TDD, BDD, mocks y stubs, cobertura de codigo, pruebas de carga (k6, JMeter), calidad de software y CI.',
       'checklist',   FALSE),
    ('Ciencia de Datos','ciencia-de-datos', 'Python (pandas, NumPy, scikit-learn), SQL analitico, visualizacion (Matplotlib, Tableau), estadistica descriptiva e inferencial, machine learning (regresion, clasificacion, clustering), feature engineering, validacion de modelos.',
       'analytics',   FALSE)
ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon, popular = EXCLUDED.popular, description = EXCLUDED.description;

-- Entrevistas de ejemplo completadas
INSERT INTO interviews (user_id, area_id, difficulty_level, status, questions_answered, questions_total, score, duration_seconds, started_at, finished_at) VALUES
    (1, 1, 'junior', 'completed', 5, 5, 78, 1800, '2026-04-15 10:00:00-05', '2026-04-15 10:30:00-05'),
    (2, 2, 'mid', 'completed', 5, 5, 85, 2100, '2026-04-20 14:00:00-05', '2026-04-20 14:35:00-05'),
    (3, 1, 'senior', 'completed', 5, 5, 92, 1680, '2026-05-01 09:00:00-05', '2026-05-01 09:28:00-05');

-- Días de práctica para ejemplo
INSERT INTO practice_days (user_id, practice_date) VALUES
    (1, '2026-04-15'), (1, '2026-04-16'), (1, '2026-04-17'),
    (2, '2026-04-20'),
    (3, '2026-05-01'), (3, '2026-05-02')
ON CONFLICT (user_id, practice_date) DO NOTHING;

-- Preguntas de ejemplo para la primera entrevista
INSERT INTO questions (interview_id, question_text, question_order) VALUES
    (1, '¿Qué diferencia hay entre flexbox y CSS Grid? ¿En qué casos usarías cada uno?', 1),
    (1, 'Explica el concepto de "event delegation" en JavaScript y da un ejemplo práctico.', 2),
    (1, '¿Qué es el Virtual DOM y cómo mejora el rendimiento en frameworks como React?', 3),
    (1, 'Describe la diferencia entre accesibilidad y usabilidad. ¿Cómo medirías cada una?', 4),
    (1, '¿Qué son los Web Vitals y por qué son importantes para el SEO?', 5);

-- Respuestas de ejemplo
INSERT INTO answers (question_id, answer_text, ai_feedback, ai_score) VALUES
    (1, 'Flexbox es unidimensional y Grid es bidimensional. Usaría flexbox para barras de navegación y Grid para layouts de página completos.',
        'Respuesta clara y precisa. Identifica correctamente la diferencia dimensional y da ejemplos de uso apropiados.', 85),
    (2, 'Event delegation es asignar un listener a un padre para manejar eventos de sus hijos, usando event.target para identificar el elemento origen.',
        'Buena definición conceptual. Podría profundizar en bubbling vs capturing.', 78),
    (3, 'El Virtual DOM es una copia ligera del DOM real. React compara el virtual DOM anterior con el nuevo y solo aplica los cambios necesarios al DOM real.',
        'Explicación sólida del concepto. Menciona correctamente la reconciliación aunque podría detallar el algoritmo diff.', 82),
    (4, 'La accesibilidad se enfoca en que personas con discapacidades puedan usar el sitio. La usabilidad mide qué tan fácil es de usar para todos. Se miden con herramientas como Lighthouse y pruebas de usuario.',
        'Excelente diferenciación de conceptos. Buenos ejemplos de herramientas de medición.', 90),
    (5, 'Los Web Vitals son métricas de Google (LCP, FID, CLS) que miden rendimiento real. Impactan el SEO porque Google los usa como factor de ranking.',
        'Conocimiento sólido de métricas Core Web Vitals y su impacto en SEO.', 88);

-- Evaluación de ejemplo con criteria_scores y tags
INSERT INTO evaluations (interview_id, score, feedback, strengths, improvements, criteria_scores, tags) VALUES
    (1, 78,
     'Buen desempeño general. Conoces los conceptos fundamentales de frontend. Destacaste en accesibilidad y Web Vitals. Necesitas profundizar más en Virtual DOM.',
     'Sólido conocimiento de accesibilidad y métricas de rendimiento. Buena capacidad para explicar conceptos con ejemplos.',
     'Profundizar en el funcionamiento interno del Virtual DOM y algoritmos de reconciliación. Practicar más escenarios de event delegation complejos.',
     '{"precision": 80, "claridad": 85, "profundidad": 70, "comunicacion": 78}',
     ARRAY['Accesibilidad', 'Web Vitals', 'Conceptos DOM'])
ON CONFLICT (interview_id) DO NOTHING;

COMMIT;



-- ====================================================================
-- MÓDULO 8: Preguntas de quiz (multiple choice, respaldo para IA)
-- ====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS quiz_questions (
    id              SERIAL PRIMARY KEY,
    area_id         INTEGER         NOT NULL REFERENCES technical_areas(id),
    difficulty      VARCHAR(20)     NOT NULL CHECK (difficulty IN ('junior', 'mid', 'senior')),
    question_text   TEXT            NOT NULL,
    options         JSONB           NOT NULL,
    correct_answer  CHAR(1)        NOT NULL CHECK (correct_answer IN ('a', 'b', 'c', 'd')),
    explanation     TEXT            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_area_diff ON quiz_questions (area_id, difficulty);

INSERT INTO quiz_questions (area_id, difficulty, question_text, options, correct_answer, explanation) VALUES

-- Frontend (area_id=1)
(1, 'junior', '¿Qué etiqueta HTML se usa para crear un enlace?',
  '{"a": "&lt;link&gt;", "b": "&lt;a&gt;", "c": "&lt;href&gt;", "d": "&lt;url&gt;"}', 'b',
  'La etiqueta &lt;a&gt; (anchor) es la correcta para crear enlaces HTML. El atributo href define la URL.'),
(1, 'junior', '¿Qué propiedad CSS se usa para cambiar el color de fondo?',
  '{"a": "color", "b": "background-color", "c": "bg-color", "d": "background"}', 'b',
  'background-color es la propiedad correcta. La propiedad "background" es un shorthand que incluye varias propiedades.'),
(1, 'mid', '¿Qué es el Virtual DOM?',
  '{"a": "Una copia del DOM que se renderiza en el servidor", "b": "Una representacion ligera del DOM en memoria que permite detectar cambios eficientemente", "c": "Un tipo de DOM usado solo en navegadores antiguos", "d": "Un framework para manipular el DOM directamente"}', 'b',
  'El Virtual DOM es una representacion en memoria del DOM real. React lo usa para comparar cambios (diffing) y aplicar solo las actualizaciones necesarias.'),
(1, 'mid', '¿Cuál es la diferencia entre flexbox y CSS Grid?',
  '{"a": "Flexbox es para layouts 2D y Grid para 1D", "b": "Flexbox es 1D (fila O columna) y Grid es 2D (filas Y columnas)", "c": "Ambos son iguales pero Grid es mas nuevo", "d": "Flexbox solo funciona en navegadores modernos"}', 'b',
  'Flexbox trabaja en una sola direccion (fila o columna), mientras que CSS Grid permite disenar en dos dimensiones simultaneamente.'),
(1, 'senior', '¿Qué estrategia es mejor para optimizar el rendimiento de una SPA?',
  '{"a": "Usar solo CSS sin JavaScript", "b": "Code splitting y lazy loading de modulos", "c": "Cargar todo en un solo bundle", "d": "Usar imagenes en lugar de componentes"}', 'b',
  'Code splitting divide el codigo en fragmentos que se cargan bajo demanda, reduciendo el tiempo de carga inicial. Lazy loading retrasa la carga de componentes no criticos.'),
(1, 'senior', '¿Qué es el Closure en JavaScript?',
  '{"a": "Una funcion que se ejecuta inmediatamente", "b": "La combinacion de una funcion con su entorno lexico exterior", "c": "Un tipo de bucle cerrado", "d": "Una forma de declarar variables privadas en ES6"}', 'b',
  'Un closure ocurre cuando una funcion interna recuerda el ambito (scope) de su funcion externa, incluso despues de que esta haya terminado de ejecutarse.'),

-- Backend (area_id=2)
(2, 'junior', '¿Qué método HTTP se usa para crear un recurso en REST?',
  '{"a": "GET", "b": "PUT", "c": "POST", "d": "DELETE"}', 'c',
  'POST se usa para crear nuevos recursos. GET es para leer, PUT para actualizar, DELETE para eliminar.'),
(2, 'junior', '¿Qué es una API REST?',
  '{"a": "Un tipo de base de datos", "b": "Un conjunto de reglas para construir servicios web usando HTTP", "c": "Un lenguaje de programacion", "d": "Un framework de frontend"}', 'b',
  'REST (Representational State Transfer) es un estilo arquitectonico que define como crear servicios web usando los verbos HTTP.'),
(2, 'mid', '¿Qué es un middleware en el contexto de servidores HTTP?',
  '{"a": "Una base de datos intermedia", "b": "Una funcion que intercepta peticiones HTTP antes de llegar al manejador final", "c": "Un tipo de servidor web", "d": "Un protocolo de comunicacion"}', 'b',
  'Un middleware es una funcion que se ejecuta en medio del pipeline de procesamiento de una peticion HTTP. Puede modificar la request, la response, o terminar el ciclo.'),
(2, 'mid', '¿Qué es JWT y para que sirve?',
  '{"a": "Un formato de compresion de imagenes", "b": "Un estandar abierto para transmitir informacion de forma segura entre partes como un objeto JSON", "c": "Un tipo de base de datos NoSQL", "d": "Un framework de autenticacion"}', 'b',
  'JWT (JSON Web Token) permite transmitir informacion entre partes como un objeto JSON firmado digitalmente, comunmente usado para autenticacion y autorizacion.'),
(2, 'senior', '¿Qué es el teorema CAP en sistemas distribuidos?',
  '{"a": "Todo sistema distribuido solo puede garantizar dos de tres: consistencia, disponibilidad y tolerancia a particiones", "b": "Un sistema debe tener los tres: consistencia, atomicidad y persistencia", "c": "Un algoritmo de balanceo de carga", "d": "Un protocolo de cache distribuida"}', 'a',
  'El teorema CAP establece que un sistema distribuido no puede garantizar simultaneamente Consistencia, Disponibilidad y Tolerancia a Particiones. Solo puede garantizar dos de las tres.'),
(2, 'senior', '¿Cuál es la ventaja de usar microservicios sobre una arquitectura monolítica?',
  '{"a": "Menos complejidad operativa", "b": "Escalabilidad independiente por servicio y despliegues aislados", "c": "Base de datos unica mas simple", "d": "Menor latencia en las peticiones"}', 'b',
  'Los microservicios permiten escalar, desplegar y mantener cada servicio de forma independiente, mejorando la agilidad y el aislamiento de fallos.'),

-- Algoritmos (area_id=4)
(4, 'junior', '¿Qué es la complejidad O(n)?',
  '{"a": "El algoritmo siempre toma el mismo tiempo", "b": "El tiempo de ejecucion crece linealmente con el tamano de entrada", "c": "El tiempo se duplica con cada elemento", "d": "El tiempo es constante"}', 'b',
  'O(n) indica que el tiempo de ejecucion crece de forma lineal y proporcional al tamano de la entrada.'),
(4, 'junior', '¿Qué estructura de datos usa el principio LIFO?',
  '{"a": "Cola (Queue)", "b": "Pila (Stack)", "c": "Lista enlazada", "d": "Arbol binario"}', 'b',
  'LIFO (Last In, First Out) es el principio de la pila (stack). El ultimo elemento en agregarse es el primero en salir.'),
(4, 'mid', '¿Qué complejidad tiene el algoritmo QuickSort en el caso promedio?',
  '{"a": "O(n)", "b": "O(n log n)", "c": "O(n^2)", "d": "O(log n)"}', 'b',
  'QuickSort tiene complejidad O(n log n) en el caso promedio. En el peor caso (arrays ya ordenados sin buena eleccion de pivote) es O(n^2).'),
(4, 'senior', '¿Qué es la programacion dinamica?',
  '{"a": "Un lenguaje de programacion", "b": "Una tecnica que resuelve problemas dividiendolos en subproblemas y almacenando sus resultados", "c": "Un tipo de compilacion en tiempo real", "d": "Una libreria de JavaScript"}', 'b',
  'La programacion dinamica resuelve problemas complejos dividiendolos en subproblemas mas simples, resolviendo cada uno una sola vez y almacenando sus soluciones (memoization).'),

-- Bases de Datos (area_id=3)
(3, 'junior', '¿Qué comando SQL se usa para obtener datos de una tabla?',
  '{"a": "INSERT", "b": "SELECT", "c": "UPDATE", "d": "DELETE"}', 'b',
  'SELECT es el comando para consultar/obtener datos de una tabla en SQL.'),
(3, 'mid', '¿Qué es un INDEX en una base de datos?',
  '{"a": "Un tipo de dato especial", "b": "Una estructura que acelera las consultas al permitir busquedas mas rapidas", "c": "Una tabla temporal", "d": "Una funcion de agregacion"}', 'b',
  'Un indice es una estructura de datos (como un arbol B-tree) que mejora la velocidad de las operaciones SELECT, WHERE y JOIN a costa de mas espacio en disco.'),
(3, 'senior', '¿Qué es una transaccion ACID en bases de datos?',
  '{"a": "Una consulta que se ejecuta automaticamente", "b": "Un conjunto de operaciones que se ejecutan como una unidad, garantizando Atomicidad, Consistencia, Aislamiento y Durabilidad", "c": "Un tipo de backup", "d": "Un comando de PostgreSQL"}', 'b',
  'ACID es un acronimo que define propiedades de las transacciones en bases de datos relacionales: Atomicidad, Consistencia, Aislamiento (Isolation) y Durabilidad.'),

-- Cloud & DevOps (area_id=31)
(31, 'mid', '¿Qué es Docker?',
  '{"a": "Una base de datos", "b": "Una plataforma para crear, desplegar y ejecutar aplicaciones en contenedores", "c": "Un lenguaje de programacion", "d": "Un sistema operativo"}', 'b',
  'Docker permite empaquetar aplicaciones con sus dependencias en contenedores ligeros y portatiles que pueden ejecutarse en cualquier sistema con Docker instalado.'),
(31, 'senior', '¿Qué es Kubernetes?',
  '{"a": "Un editor de texto", "b": "Un orquestador de contenedores que automatiza el despliegue, escalado y gestion de aplicaciones", "c": "Un sistema de archivos", "d": "Un compilador"}', 'b',
  'Kubernetes (K8s) es una plataforma de orquestacion de contenedores que automatiza el despliegue, escalado y operacion de aplicaciones en contenedores a traves de clusters.'),

-- Ciencia de Datos (area_id=145)
(145, 'junior', '¿Qué libreria de Python se usa principalmente para manipular datos tabulares?',
  '{"a": "Matplotlib", "b": "NumPy", "c": "pandas", "d": "Scikit-learn"}', 'c',
  'pandas es la libreria principal para manipulacion y analisis de datos tabulares en Python, proporcionando DataFrames.'),
(145, 'mid', '¿Qué es el sobreajuste (overfitting) en Machine Learning?',
  '{"a": "Cuando el modelo no aprende lo suficiente", "b": "Cuando el modelo se ajusta demasiado a los datos de entrenamiento y no generaliza bien", "c": "Cuando hay demasiados datos", "d": "Cuando el modelo es muy simple"}', 'b',
  'El overfitting ocurre cuando un modelo aprende el ruido y los detalles especificos de los datos de entrenamiento, perjudicando su rendimiento en datos nuevos no vistos.')

ON CONFLICT DO NOTHING;

COMMIT;
