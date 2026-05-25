# DESIGN.md

## Project Overview
Design a **technical mock interview platform** that feels modern, calm, professional, and highly usable for long sessions. The product should help users practice interviews, receive feedback, review history, and move smoothly between authentication, practice, and evaluation flows.

The interface must look polished and coherent across the entire app, with a visual style inspired by modern developer tools and SaaS products.

## Core Design Goals
- Professional and trustworthy
- Minimalist and uncluttered
- Clean UI with strong hierarchy
- Slightly dark, neutral interface
- Comfortable for long reading and practice sessions
- Developer-oriented and modern
- Accessible and readable
- Elegant, not flashy

## Content Language
- **All visible UI copy must remain in Spanish.**
- Buttons, labels, placeholders, navigation, titles, system messages, errors, and helper text must all be in Spanish.
- The design instructions may be in English, but the product content itself should stay Spanish.

## Visual Style
The visual language should feel:
- Calm
- Technical
- Modern
- Softly contrasted
- Neutral and refined

Avoid:
- Neon colors
- Excessive saturation
- Harsh black-and-white contrast
- Decorative or playful styling
- Overly heavy gradients
- Visual clutter

## Color Palette
Use this palette consistently throughout the app:

### Base Surfaces
- **Primary Background:** `#0F1115`
- **Secondary Background:** `#171A21`
- **Elevated Surface / Cards:** `#20242D`
- **Borders / Dividers:** `#2B313C`

### Text
- **Primary Text:** `#E6E8EE`
- **Secondary Text:** `#A7ADB8`
- **Muted Text:** `#7D8593`

### Accent
- **Primary Accent:** `#5B7CFA`
- **Primary Accent Hover:** `#4C6EF5`
- **Soft Accent:** `#7C8AA5`

### Status Colors
- **Success:** `#4CAF7A`
- **Warning:** `#D6A54A`
- **Error:** `#D96B6B`

## Color Usage Rules
- Use **soft contrast** instead of pure black and pure white.
- Use the accent color sparingly for primary actions, active states, links, and highlights.
- Use status colors only for feedback, alerts, and evaluation states.
- Keep cards and panels slightly lighter than the background so layers remain visible.
- Borders should be subtle and not overly bright.

## Typography
- Use a modern sans-serif for most UI text.
- Headings should feel strong, clear, and slightly refined.
- Body text must remain highly readable.
- Use consistent spacing and line height for long reading sessions.
- The tone of typography should be technical and elegant, not playful.

Suggested hierarchy:
- Large serif or expressive heading for the hero only if it fits the brand.
- Clean sans-serif for forms, labels, chat, and data sections.
- Monospace or code-style font for code snippets, logs, and technical examples.

## Layout Principles
- Use a strong grid system.
- Prioritize content clarity over decoration.
- Keep spacing generous but controlled.
- Maintain consistent padding inside cards and sections.
- Use rounded corners with subtle softness.
- Keep visual density balanced: enough information, but never crowded.

## Main Screens
The design should support these core areas:

### Authentication
- Login
- Register
- Clean card-based form layout
- Clear labels and feedback states
- Friendly but professional tone

### Home / Landing
- Strong headline
- Short supporting text
- Clear call to action
- Trust elements or social proof
- Hero section should feel premium and focused

### Interview Flow
- Area selection
- Chat-style interview interface
- Question and response visualization
- Clear progress or question counter
- Comfortable reading layout

### Evaluation
- Summary of performance
- Score or assessment blocks
- Strengths and improvement areas
- Clear next action buttons

### History
- List or card layout for past interviews
- Easy scanning and filtering
- Clear timestamps, topics, and outcomes

## Component Style

### Buttons
- Rounded corners
- Clear hierarchy: primary, secondary, tertiary
- Primary buttons should use the accent color
- Hover states should be subtle
- Active states should slightly compress or darken

### Inputs
- Dark surface or elevated surface
- Visible borders
- Soft focus states using the primary accent
- Clear placeholder text in Spanish
- High contrast text for readability

### Cards
- Use elevated surfaces
- Subtle borders
- Gentle shadows only
- Clear internal spacing
- Avoid overly large shadows or bright glows

### Navigation
- Fixed or sticky navigation is acceptable
- Keep navigation compact and readable
- Use muted text for inactive items
- Active item should be visually clear without being loud

### Chat / Interview Area
- Distinct message bubbles or blocks
- Differentiate interviewer and user responses clearly
- Use alignment, tone, and surface color to create hierarchy
- Keep code blocks and technical content readable

### Code Blocks
- Use a monospace font
- Use a darker container than regular cards
- Syntax highlighting should remain subtle
- Ensure code is easy to scan without visual noise

## Interaction States
Every interactive element should have clear states:
- Default
- Hover
- Focus
- Active
- Disabled
- Loading
- Error
- Success

Focus states must be visible and accessible.

## Accessibility Rules
- Maintain strong contrast for text and controls.
- Ensure keyboard navigation works properly.
- Keep clickable elements large enough.
- Avoid relying only on color to communicate meaning.
- Make forms and feedback easy to understand.
- Preserve readability at all screen sizes.

## Responsive Behavior
The design must work well on:
- Mobile
- Tablet
- Desktop

Responsive principles:
- Stack content vertically on small screens.
- Keep cards full width on mobile.
- Reduce unnecessary side-by-side complexity on narrow screens.
- Preserve spacing and readability.
- Ensure chat and forms remain usable on touch devices.

## Data Presentation
When showing interview results, history, or metrics:
- Use compact but clear cards
- Use labels and small metadata text
- Keep numbers easy to scan
- Avoid cluttered dashboards
- Use hierarchy to separate summary from details

## Tone and Personality
The interface should feel:
- Intelligent
- Calm
- Supportive
- Professional
- Efficient
- Technical

It should not feel childish, overly corporate, or excessively futuristic.

## Do
- Keep the UI neutral and polished
- Use the palette consistently
- Maintain Spanish content across the entire app
- Prioritize clarity and comfort
- Use subtle shadows and borders
- Design for long interview practice sessions
- Make key actions obvious

## Don’t
- Do not use flashy gradients everywhere
- Do not use bright neon accents
- Do not overuse glassmorphism
- Do not make the UI look playful or cartoonish
- Do not mix too many fonts
- Do not clutter the layout
- Do not break Spanish content consistency
- Do not use pure black backgrounds unless necessary

## Suggested Design Direction Summary
A modern, dark-neutral, developer-inspired SaaS interface for a Spanish-language technical interview simulator. The design should feel like a premium productivity tool: calm, structured, readable, and reliable.

---

## Responsive Design System

### Breakpoints
| Token | Min-Width | Target |
|---|---|---|
| `xs` | ≤ 375px | Teléfonos pequeños |
| `sm` | 376px – 640px | Teléfonos grandes |
| `md` | 641px – 768px | Tablets vertical |
| `lg` | 769px – 1024px | Tablets horizontal / laptops pequeños |
| `xl` | 1025px – 1279px | Desktop estándar |
| `xxl` | ≥ 1280px | Desktop grande (max 1536px contenido) |

### Responsive Spacing
- `--space-mobile`: `16px` — usado en `xs`, `sm`
- `--space-tablet`: `24px` — usado en `md`
- `--space-desktop`: `32px` — usado en `lg+`

Implementado via clase `.container-responsive` que aplica padding lateral automático según breakpoint.

### Responsive Typography
| Element | xs | sm | md | lg+ |
|---|---|---|---|---|
| `h1` (hero) | 28px | 36px | 48px | 72px |
| `h2` | 22px | 24px | 24px | 32px |
| `h3` | 18px | 18px | 20px | 20px |
| `body` | 14px | 14px | 16px | 16px |
| `score` | 48px | 56px | 72px | 72px |

Implementado via clases CSS: `.responsive-h1`, `.responsive-h2`, `.responsive-score`

### Per-Component Responsive Specifications

#### Navigation Bar
- **Archivo:** `frontend/index.html:435`, `frontend/js/app.js`
- **Desktop** (≥ 641px): Barra horizontal fija con links: Dashboard, Historial, Práctica. Avatar + notificaciones alineados a la derecha.
- **Mobile** (< 641px): Botón hamburguesa (☰) visible a la izquierda del brand. Links de navegación ocultos. Slide-in panel lateral desde la izquierda (280px de ancho) con overlay semitransparente.
- **Panel lateral:** Fondo `#171A21`, borde derecho `#2B313C`. Contiene: nombre de usuario, links de navegación (Dashboard, Historial, Práctica, Perfil), divider, y cerrar sesión. Se cierra al hacer clic en overlay, en un link, presionar Escape, o redimensionar a desktop.
- **Clases CSS:** `.mobile-nav-overlay`, `.mobile-nav-panel`, `.nav-link`, `.nav-header`, `.nav-user-info`
- **Breakpoint mobile:** `641px`

#### Hero Section (Landing)
- **Archivo:** `frontend/index.html:116`
- **Mobile:** Altura `70vh` (vs 921px fijo en desktop). Heading 28-36px. CTA buttons en columna vertical.
- **Desktop:** Altura 921px. Heading 72px. CTA buttons en fila horizontal.
- **Clase CSS:** `.hero-responsive`, `.responsive-h1`

#### Bento Grid (Características)
- **Archivo:** `frontend/index.html:208`
- **Mobile:** Una columna única, cada card ocupa todo el ancho. Cards con altura `320px` (`bento-card-tall`).
- **Desktop:** Grid de 12 columnas. Cards pueden ocupar `md:col-span-4` o `md:col-span-8`.
- **Clase CSS:** `.bento-grid-responsive`, `.bento-card-tall`

#### Stats Cards (Dashboard)
- **Archivo:** `frontend/index.html:468`
- **Mobile:** 2 columnas (xs) → 3 columnas (sm) → 5 columnas (md+).
- **Breakpoints:** `xs: 2 cols`, `sm: 3 cols`, `md+: 5 cols`
- **Clase CSS:** `.responsive-grid-2-4-5`

#### Mode Selector (Areas View)
- **Archivo:** `frontend/index.html:525`
- **Mobile:** Label y botones en fila, descripción debajo en bloque separado.
- **Desktop:** Todo en una fila horizontal con `ml-auto` para la descripción.
- **Clase CSS:** `.mode-selector-responsive`

#### History Items
- **Archivo:** `frontend/js/app.js:1294`
- **Mobile:** Información (área, fecha, badges) arriba, score + botones (Detalle, Eliminar) abajo en fila separada.
- **Desktop:** Todo en una fila horizontal. Info a la izquierda, score + botones a la derecha.
- **Clase CSS:** `.history-item-inner`, `.history-actions`

#### Chat Interface
- **Archivo:** `frontend/index.html:542`, `frontend/js/app.js:818-845`
- **Altura:** Usa `100dvh` (dynamic viewport height) con fallback a `100vh` para manejar teclado virtual en mobile.
- **Mensajes:** `max-width: 85%` en mobile, `80%` en desktop.
- **Input:** Textarea con 2 filas sugeridas en mobile, 3 en desktop.
- **Clase CSS:** `.full-height-responsive`, `.message-feedback`

#### Quiz Options
- **Archivo:** `frontend/js/app.js:978`, `frontend/js/app.js:1125`
- **Mobile:** Opciones en una columna única (`grid-template-columns: 1fr`).
- **Desktop:** Opciones en dos columnas (`grid-template-columns: 1fr 1fr`).
- **Clase CSS:** `.quiz-option-grid`, `.quiz-option`, `.quiz-option__circle`, `.quiz-option__letter`, `.quiz-option--selected`

#### Evaluation Score
- **Archivo:** `frontend/js/app.js:1211`
- **Mobile:** Score `48px` (xs) → `56px` (sm).
- **Desktop:** Score `72px`.
- **Clase CSS:** `.responsive-score`

#### History Filter Bar
- **Archivo:** `frontend/index.html:640`
- **Mobile:** Filtros en columna vertical.
- **Desktop:** Filtros en fila horizontal con `flex-wrap`.
- **Clase CSS:** `.filter-bar-responsive`

#### Session Detail Metadata
- **Archivo:** `frontend/js/app.js:1424`
- **Mobile:** Metadatos en grid 2 columnas.
- **Desktop:** Metadatos en fila horizontal.
- **Clase CSS:** `.meta-grid-responsive`, `.meta-item`, `.meta-item__label`, `.meta-item__value`

#### Toast Notifications
- **Archivo:** `frontend/js/app.js:1562`
- **Mobile:** `max-width: 90vw`, `bottom: 1rem`.
- **Desktop:** `max-width: 400px`, `bottom: 2rem`.
- **Clase CSS:** `.toast-responsive`

#### Footer
- **Archivo:** `frontend/index.html:289`
- **Mobile:** Brand y copyright centrados arriba, links de navegación debajo.
- **Desktop:** Brand a la izquierda, links a la derecha.
- **Clase CSS:** `.footer-responsive`

### Touch Target Guidelines
- Mínimo tamaño táctil: `44×44px` para elementos interactivos principales.
- Mínimo tamaño para elementos secundarios: `36×36px`.
- Espaciado mínimo entre elementos táctiles: `8px`.
- Implementado via clases: `.touch-target` (44px), `.touch-target-sm` (36px).

### Viewport & Keyboard Handling
- Usar `100dvh` (dynamic viewport height) en lugar de `100vh` para layouts full-height (chat).
- Fallback con `@supports not (height: 100dvh)` para navegadores legacy.
- El área de input del chat debe permanecer visible cuando el teclado mobile se abre.
- Los formularios no deben quedar ocultos detrás del teclado virtual.

### CSS File Architecture
Los estilos responsive se organizan en 3 archivos:

| Archivo | Propósito |
|---|---|
| `responsive.css` | Breakpoints, utilidades responsive (grid, flex, show/hide), tipografía responsive, animaciones |
| `components.css` | Clases de componentes reutilizables (cards, botones, badges, opciones de quiz, etc.) |
| `index.html <style>` | Estilos específicos de layout y overriding de Tailwind para casos no cubiertos |

Archivo legacy eliminado: `styles.css` (sus reglas fueron consolidadas en los 3 archivos anteriores).

### Orden de Carga de CSS
1. Tailwind CDN (framework base)
2. `responsive.css` (sistema responsive)
3. `components.css` (componentes reutilizables)
4. `<style>` inline en `index.html` (overrides específicos)

