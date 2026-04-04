# Agent Context Bootstrap

Si sos un nuevo agente entrando a iManager, empezá acá.

## Lectura mínima (en orden)

1. `AGENTS.md` — onboarding completo de stack, módulos, reglas y skills
2. `PROJECT_STATUS.md` — estado vivo, roadmap, issues abiertos
3. Skill correspondiente según el área que vas a tocar:
   - `src/` → `.agent/skills/imanager-frontend/SKILL.md`
   - `backend/` → `.agent/skills/imanager-backend/SKILL.md`
   - `src/pages/Inventory.tsx` → `.agent/skills/imanager-inventory/SKILL.md`

## Reglas mínimas

- No hacer build (Railway lo hace)
- Si tocás `src/` → leer la skill de frontend primero
- Si tocás `backend/` → leer la skill de backend primero
- Si el módulo es Inventory → también leer la skill de inventory

## Para features nuevas

Usar el template en `FEATURE_HANDOFF_TEMPLATE.md` al comenzar.
Actualizar `PROJECT_STATUS.md` al terminar.
