# DevInterview — Simulador de Entrevistas Técnicas con IA

Plataforma web progresiva para simular entrevistas técnicas usando inteligencia artificial. Genera preguntas dinámicas, evalúa respuestas en tiempo real y ofrece retroalimentación detallada para mejorar el desempeño del usuario.

**Objetivo central:** Proporcionar un entorno de práctica realista donde desarrolladores de todos los niveles puedan prepararse para procesos de selección técnicos mediante simulación de entrevistas con IA y cuestionarios de opción múltiple.

---

## Tecnologías utilizadas

| Tecnología | Uso |
|------------|-----|
| **HTML5** | Estructura semántica de la interfaz, formularios, vistas SPA (Single Page Application) |
| **CSS3** | Diseño visual, animaciones, sistema de cuadrícula responsive, variables CSS personalizadas |
| **JavaScript Vanilla** | Toda la lógica del frontend: SPA routing, peticiones AJAX, manipulación del DOM, eventos asíncronos |
| **Node.js (HTTP nativo)** | Servidor HTTP backend sin frameworks externos (sin Express, sin Nest) |
| **PostgreSQL (Neon)** | Base de datos relacional en la nube con pool de conexiones |
| **SMTP (TLS nativo)** | Envío de correos de verificación y recuperación de contraseña mediante sockets TLS directos a Gmail |
| **OpenRouter API** | Generación de preguntas y evaluación de respuestas mediante IA (Nemotron Nano, Llama 70B) |
| **Hugging Face API** | Proveedor de respaldo para inferencia de IA |
| **dotenv** | Gestión de variables de entorno para configuración segura |

> **Restricción del proyecto:** No se utilizan frameworks ni librerías externas como React, Bootstrap, Tailwind (excepto CDN para utilidades CSS mínimas), Vue, Angular, Express, etc. Todo el código es JavaScript Vanilla y CSS puro.

---

## Estructura del proyecto

```
DevInterview/
├── backend/
│   ├── server.js              # Servidor HTTP principal, routing de API, archivos estáticos
│   ├── db/
│   │   ├── connection.js      # Pool de conexión a PostgreSQL (Neon)
│   │   ├── queries.js         # Todas las consultas SQL parametrizadas (739+ líneas)
│   │   ├── schema.sql         # Definición completa del esquema de base de datos
│   │   ├── setup.js           # Inicialización de esquema y migraciones automáticas
│   │   └── migrate-email-verification.sql  # Script de migración manual
│   ├── routes/
│   │   ├── auth.js            # Login, registro, verificación email, reset password
│   │   ├── areas.js           # Catálogo de áreas técnicas
│   │   ├── dashboard.js       # Estadísticas y KPIs del dashboard
│   │   ├── history.js         # Historial de entrevistas con paginación
│   │   ├── interview.js       # Ciclo completo de entrevista chat con IA
│   │   ├── quiz.js            # Cuestionarios de opción múltiple
│   │   ├── notifications.js   # Sistema de notificaciones push-style
│   │   ├── user.js            # Perfil de usuario y cambio de contraseña
│   │   └── helpers.js         # Funciones auxiliares (parseo, respuestas JSON)
│   └── services/
│       ├── ai.js              # Integración con IA: OpenRouter, Hugging Face, banco local
│       ├── auth.js            # Hash de contraseñas (scrypt), tokens UUID
│       └── email.js           # Cliente SMTP raw sobre TLS (Gmail)
├── frontend/
│   ├── index.html             # SPA completa con todas las vistas (landing, auth, app)
│   ├── reset-password.html    # Página standalone de restablecimiento de contraseña
│   ├── verify-email.html      # Página standalone de verificación de correo
│   ├── css/
│   │   ├── components.css     # Componentes reutilizables (tarjetas, botones, badges)
│   │   └── responsive.css     # Sistema responsive con breakpoints y media queries
│   └── js/
│       └── app.js             # Toda la lógica del frontend SPA (2100+ líneas)
├── .env                       # Variables de entorno (no incluido en git)
├── railway.json               # Configuración de despliegue en Railway
├── Dockerfile                 # Imagen Docker para producción
├── Procfile                   # Configuración para Heroku
├── render.yaml                # Configuración para Render
├── package.json               # Dependencias: dotenv, pg
└── README.md                  # Este archivo
```

---

## Explicación del diseño web

### Arquitectura visual

El diseño sigue una **estética dark mode** con una paleta de colores técnica y sobria:

- **Fondo principal:** `#0F1115` (surface-dim)
- **Superficies elevadas:** `#171A21` (surface-container) y `#20242D` (surface-container-high)
- **Color primario:** `#5B7CFA` (azul acento) para acciones principales y elementos interactivos
- **Texto:** `#E6E8EE` (on-surface) y `#A7ADB8` (on-surface-variant)
- **Feedback visual:** Verde `#4CAF7A` para aciertos, amarillo `#D6A54A` para advertencias, rojo `#D96B6B` para errores

### Diseño responsive

La plataforma se adapta a cualquier dispositivo mediante un sistema de **media queries progresivas**:

| Breakpoint | Objetivo | Comportamiento |
|-----------|----------|----------------|
| `>= 1024px` | Desktop | Layout completo con sidebar, navegación horizontal, grid de 3-4 columnas |
| `641px - 1023px` | Tablet | Grid de 2 columnas, navegación compacta, márgenes reducidos |
| `<= 640px` | Móvil | Navegación lateral deslizante, grid de 1 columna, botones touch-target (44px mínimo) |

**Técnicas responsive implementadas:**

1. **CSS Grid con `auto-fit` y `minmax`** — Las tarjetas del dashboard y las áreas se recolocan automáticamente según el ancho disponible
2. **Flexbox con `flex-wrap`** — Los headers, barras de herramientas y grupos de botones envuelven contenido cuando no caben
3. **Unidades relativas** — `rem`, `%`, `vw` para tamaños de fuente y espaciado que escalan con el viewport
4. **Clases utilitarias propias** — `.hide-mobile`, `.show-mobile`, `.flex-responsive`, `.responsive-grid-1-2-3`, `.full-height-responsive`
5. **Tipografía fluida** — La fuente principal (Geist) escala de 14px a 18px según el dispositivo
6. **Touch targets** — Botones con `min-height: 44px` y `padding: 12px` para interacción táctil cómoda

### Animaciones y transiciones

- Transiciones suaves de 150ms-300ms en todos los elementos interactivos (hover, focus, active)
- Animaciones de carga con spinner CSS (`@keyframes spin`)
- Barras de progreso animadas con transición de `width`
- Efecto `backdrop-blur` en la barra de navegación fija
- Modal de confirmación con `backdrop-filter: blur(4px)` para enfoque visual

---

## Funcionalidades clave

### 1. SPA con routing manual
El frontend es una Single Page Application construida sin frameworks. El sistema de routing muestra y oculta vistas mediante clases CSS `.view-hidden` / `.view-active`:

```javascript
function showAppView(viewName) {
    Object.keys(appViews).forEach(function (key) {
        if (appViews[key]) {
            appViews[key].classList.remove('view-active');
            appViews[key].classList.add('view-hidden');
        }
    });
    if (appViews[viewName]) {
        appViews[viewName].classList.remove('view-hidden');
        appViews[viewName].classList.add('view-active');
    }
}
```

### 2. Entrevista chat con IA
- **Inicio:** `POST /api/interview/start` crea la sesión, IA genera la primera pregunta
- **Respuesta:** `POST /api/interview/answer` evalúa la respuesta, IA genera la siguiente pregunta
- **Finalización:** `POST /api/interview/finish` genera evaluación final con puntuación, fortalezas y áreas de mejora
- **Reanudación:** Si el usuario cierra y vuelve, el backend devuelve las preguntas respondidas y continúa desde donde quedó

### 3. Cuestionarios de opción múltiple
- Temporizador de 10 minutos con autoenvío al llegar a 0
- Bloqueo de salida: si el usuario intenta navegar a otra sección, un modal pregunta si desea terminar y evaluar respuestas parciales
- Evaluación instantánea al enviar con desglose de respuestas correctas/incorrectas y explicaciones

### 4. Evaluación por respuesta con 3 criterios
Cada respuesta del usuario recibe un análisis estructurado:

```
✅ Fortalezas   → "Cubriste los conceptos clave..."
⚠️ Debilidades  → "Respuesta breve, faltó profundizar..."
📈 A mejorar    → "Incluye ejemplos de código..."
```

El prompt de IA solicita específicamente este formato JSON. Si la IA falla, un evaluador local basado en keywords proporciona el mismo análisis.

### 5. Dashboard con métricas y gráficas
- 5 tarjetas de KPIS: total entrevistas (con desglose chat/quiz), promedio, racha, progreso semanal
- Barras de rendimiento por área técnica (separadas por chat y quiz)
- Historial de puntuaciones de últimas sesiones
- Círculo SVG de progreso semanal
- Sesiones activas con botón "Reanudar" que distingue entre chat y quiz

### 6. Sistema de notificaciones
- Notificaciones push-style: bienvenida, inicio/fin de entrevista, inicio/fin de cuestionario
- Campana en navegador con badge de no leídas
- Dropdown de últimas 5 notificaciones
- Página completa de notificaciones con paginación y marcado de leídas

### 7. Verificación de email y recuperación de contraseña
- Registro con verificación por correo (token de 24h)
- Recuperación de contraseña mediante enlace único (token de 1h)
- Páginas standalone `reset-password.html` y `verify-email.html` independientes del SPA
- Cliente SMTP raw sobre TLS que envía correos sin librerías externas

---

## Despliegue

La aplicación está configurada para desplegarse en:

- **Railway** (principal) — `railway.json` con Nixpacks builder
- **Docker** — `Dockerfile` multi-etapa con Node.js 20 Alpine
- **Heroku** — `Procfile` legacy
- **Render** — `render.yaml` con servicio web

### Variables de entorno requeridas

```
DATABASE_URL=postgresql://...
API_KEY=sk-or-v1-...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=correo@gmail.com
SMTP_PASS=app_password
FROM_EMAIL=correo@gmail.com
APP_URL=https://dominio.com
NODE_ENV=production
PORT=8080
```

---

## Licencia

Proyecto educativo. Todos los derechos reservados.
