---
description: Toma contexto completo del proyecto iManager antes de trabajar
allowed-tools: Bash(git log:*), Bash(git status:*), Bash(git diff:*), Read
---

## Tu tarea

Tomá contexto del proyecto iManager para arrancar a trabajar. Hacé esto de forma concisa y estructurada.

**Paso 1 — Leer el contexto del proyecto:**

Lee `CLAUDE.md` en la raíz del repo.

**Paso 2 — Ver estado actual del repo:**

Corré estos comandos en paralelo:
- `git status` — archivos modificados sin commitear
- `git log --since="3 days ago" --pretty=format:"%h %ad %s" --date=short` — commits recientes

**Paso 3 — Reportar al usuario:**

Resumí de forma breve y concisa:
1. Stack y módulos clave del proyecto (1-2 líneas desde CLAUDE.md)
2. Qué se hizo en los últimos 3 días (commits agrupados por tema)
3. Archivos modificados sin commitear (si hay)
4. Una línea de "Listo para trabajar. ¿Qué cambiamos?"

No hagas nada más. Solo reportá el contexto y esperá instrucciones.
