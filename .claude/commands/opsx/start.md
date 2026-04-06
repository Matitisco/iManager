---
description: Lee openspec/AGENTS.md y reporta el estado actual de OpenSpec en el proyecto.
allowed-tools: [Read, Bash]
---

Lee `openspec/AGENTS.md` y luego corré `openspec list --json` en paralelo.

Con esa información reportá al usuario:

```
## OpenSpec — contexto

**Flujo:** /opsx:propose → revisar → /opsx:apply → /opsx:archive

**Dominios especificados:** [lista de carpetas en openspec/specs/]

**Changes activos:** [lista de openspec list, o "ninguno" si está vacío]

Listo. ¿Qué feature especificamos?
```

Nada más. Solo reportá y esperá instrucciones.
