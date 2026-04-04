---
description: Corre lint del frontend y backend para verificar que no hay errores de TypeScript
allowed-tools: Bash(npm run lint:*), Bash(cd backend*), Bash(npm --prefix:*)
---

## Tu tarea

Verificá que los cambios recientes no rompieron nada corriendo el lint de TypeScript en el frontend y backend.

**Corré estos dos comandos en paralelo:**

1. `npm run lint` — lint del frontend (raíz del repo)
2. `npm --prefix backend run lint` — lint del backend

**Luego reportá al usuario:**

- Si ambos pasaron sin errores → "✓ Frontend y backend sin errores de TypeScript. Listo para pushear."
- Si hay errores → mostrá solo los errores nuevos o más relevantes, agrupados por archivo. Indicá si los errores son pre-existentes (archivos que ya estaban modificados antes de la sesión) o introducidos por los cambios actuales.

No arregles nada automáticamente. Solo reportá el resultado y esperá instrucciones.
