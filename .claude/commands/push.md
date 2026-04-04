---
description: Commitea los cambios de la sesión y pushea a main
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
---

## Tu tarea

Commitear y pushear los cambios hechos en esta sesión de trabajo.

**Paso 1 — Entender el estado:**

Corré en paralelo:
- `git status` — para ver qué archivos están modificados
- `git diff HEAD` — para ver los cambios concretos
- `git log --oneline -5` — para seguir el estilo de commits del proyecto

**Paso 2 — Identificar qué commitear:**

Solo stagear los archivos que fueron modificados *en esta sesión*. Si hay archivos con cambios pre-existentes (que ya aparecían como modificados al inicio de la conversación), NO los incluyas a menos que el usuario lo pida explícitamente.

**Paso 3 — Crear el commit:**

- Seguí el estilo de commits del proyecto: `tipo: descripción en inglés`
- Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`
- Mensaje conciso, en inglés, que explique QUÉ se hizo
- Siempre agregá al final: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

**Paso 4 — Pushear:**

`git push origin main`

**Paso 5 — Confirmar:**

Reportá el hash del commit y que el push fue exitoso. Una línea.
