---
description: Verifica que los cambios recientes no rompieron nada. Corre lint de TypeScript en frontend y backend en paralelo.
allowed-tools: [Bash]
---

# Test — Verificar cambios

Corré el lint de TypeScript en el frontend y en el backend **en paralelo** y reportá el resultado.

## Comandos

Ejecutá ambos al mismo tiempo:
- `npm run lint` — desde la raíz (frontend)
- `npm --prefix backend run lint` — backend

## Cómo reportar

**Si ambos pasaron sin errores:**
> ✓ Frontend y backend sin errores de TypeScript. Listo para pushear.

**Si hay errores:**
- Mostrá solo los errores relevantes, agrupados por archivo
- Indicá si el error es **pre-existente** (en archivos que ya estaban modificados antes de esta sesión) o **introducido** por los cambios actuales
- Sugerí el fix solo si es obvio y acotado

No arregles nada automáticamente a menos que el usuario lo pida. Solo reportá y esperá.
