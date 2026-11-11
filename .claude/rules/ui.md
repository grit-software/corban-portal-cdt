---
description: Componentes, páginas, accesibilidad y tokens de diseño
paths:
  - "src/app/**/*.tsx"
  - "src/components/**"
---

# UI: páginas y componentes

- Solo tokens de `src/app/globals.css` (`bg-primary`, `text-muted-foreground`, `rounded-lg`,
  `shadow-card`…). Sin hex, sin px arbitrarios (`w-[37px]`), sin estilos en línea.
- Server Component por defecto; `"use client"` en la hoja más pequeña. Un componente cliente nunca
  importa `src/server/**` ni `src/lib/env.ts`: datos por props o por `/api/v1` con react-query.
- Área de cliente mobile-first: un paso por pantalla, objetivos táctiles ≥ 44 px (`min-h-11`),
  texto 16 px. Staff desktop-first: tablas densas (filas 40 px, texto 14 px) que bajo 768 px pasan
  a tarjetas; nada provoca desplazamiento horizontal a 375 px.
- Cada página: un solo `h1`, contenido dentro de `<main id="contenido">` del shell, título en
  español con `metadata`.
- Formularios: `label` visible en cada campo; error en texto junto al campo con `aria-describedby`;
  resumen con `role="alert"`; foco al primer inválido; nunca solo color. OTP con
  `autoComplete="one-time-code"` y pegar permitido.
- Estados de carga, vacío y error en toda lista y superficie asíncrona (tabla de §6 del blueprint):
  `loading.tsx`/`error.tsx` en staff, `Skeleton` y mensajes en cliente.
- Texto sobre navy siempre blanco; `#2F9E5B` solo íconos/bordes, texto de éxito con `success-strong`.
- Toda transición con `motion-reduce:transition-none`.
- `src/components/ui/**` lo genera shadcn: se puede editar, pero no se lintea (override en `biome.json`).
- Ninguna página lee `getEnv()` en tiempo de build: si lo necesita, `export const dynamic = "force-dynamic"`.
- Copia en español de Colombia, trato de "tú", sin anglicismos innecesarios.
