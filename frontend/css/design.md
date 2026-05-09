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

