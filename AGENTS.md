# iManager handoff

Este repo ya tiene instrucciones operativas detalladas en el chat, pero no tenía un `AGENTS.md` raíz útil para handoff entre agentes.

## Cómo continuar

- Leé primero `PROJECT_STATUS.md`.
- Después revisá `README.md` solo si necesitás contexto de producto.
- No hagas build después de cambios.
- Si tocás código, corré `lint`; si solo tocás docs, no hace falta.
- Cuando cierres una iteración importante, actualizá `PROJECT_STATUS.md`.

## Estado actual resumido

- Auditoría A completada.
- Backend real en Railway funcionando con Postgres y Firebase Auth.
- `/api/me` ya resuelve sesión de aplicación.
- Bootstrap inicial de tienda/membresía hecho para el usuario real del proyecto.
- `clients` todavía está pendiente de migración histórica porque el script encontró una base Firestore nombrada distinta a la default y eso ya fue corregido en backend.

## Archivos clave

- `PROJECT_STATUS.md` — estado vivo, roadmap, issues y próximos pasos.
- `README.md` — documentación de producto.
- `backend/README.md` — notas operativas del backend.

## Fast bootstrap for new agents
If you are joining through a fresh feature chat, start here:
- `docs/agent-context/README.md`
- `docs/agent-context/QUICK_START.md`
- `docs/agent-context/ARCHITECTURE_MAP.md`
- `docs/agent-context/FEATURE_HANDOFF_TEMPLATE.md`

Keep the bootstrap shallow. Use `PROJECT_STATUS.md` and `ARCHITECTURE_DECISIONS_2026-04-02.md` for live state and rationale.
