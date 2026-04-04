---
description: Toma contexto completo del proyecto iManager antes de comenzar a trabajar. Lee AGENTS.md, commits recientes y estado del repo.
allowed-tools: [Read, Bash]
---

# Start — Tomar contexto del proyecto

Tu objetivo es darle al agente el contexto necesario para trabajar en iManager. Hacelo de forma concisa.

## Pasos

1. Leé el archivo `AGENTS.md` en la raíz del repo para entender el proyecto.

2. Corré estos dos comandos en paralelo:
   - `git log --since="3 days ago" --pretty=format:"%h %ad %s" --date=short`
   - `git status --short`

3. Reportá al usuario un resumen estructurado:

```
## Contexto iManager

**Stack:** [1 línea desde AGENTS.md]
**Módulos migrados:** [lista desde AGENTS.md]

**Últimos commits:**
[agrupa por tema si hay varios del mismo día]

**Sin commitear:**
[lista de archivos modificados, o "nada" si está limpio]

Listo. ¿Qué trabajamos hoy?
```

No hagas nada más. Solo reportá el contexto y esperá instrucciones.
