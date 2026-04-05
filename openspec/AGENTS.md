# OpenSpec — Guía para agentes AI

Este archivo explica cómo usar OpenSpec en el proyecto iManager.
Leelo antes de crear o modificar cualquier artefacto en `openspec/`.

---

## Flujo estándar

```
/opsx:propose <nombre>  →  revisar artefactos  →  /opsx:apply  →  /opsx:archive
```

1. **`/opsx:propose <nombre>`** — crea el change con los 4 artefactos (proposal, specs, design, tasks)
2. El usuario revisa y aprueba antes de implementar
3. **`/opsx:apply`** — implementa las tasks del change activo
4. **`/opsx:archive`** — mergea los delta specs en `openspec/specs/` y archiva el change

Nunca implementes sin haber creado primero los artefactos. Nunca archives con `mv` directo — usá `/opsx:archive` para que el sync de specs ocurra correctamente.

---

## Estructura de carpetas

```
openspec/
├── AGENTS.md                        ← este archivo
├── config.yaml                      ← contexto del proyecto + reglas de artefactos
├── specs/                           ← FUENTE DE VERDAD del sistema (estado actual)
│   └── <dominio>/
│       └── spec.md
└── changes/
    ├── <nombre-activo>/             ← change en progreso
    │   ├── proposal.md
    │   ├── design.md
    │   ├── tasks.md
    │   └── specs/                   ← delta specs (qué está cambiando)
    │       └── <dominio>/
    │           └── spec.md
    └── archive/
        └── YYYY-MM-DD-<nombre>/     ← change completado (historial)
```

**`openspec/specs/`** describe cómo funciona el sistema *ahora*. Se construye mergeando los delta specs de cada change al archivarlo. No edites estos archivos directamente — se actualizan via archive.

**`openspec/changes/<nombre>/`** contiene todo lo relacionado con una feature en progreso. Al archivar, los artefactos (proposal, design, tasks) quedan en el historial; solo los specs se mergean hacia arriba.

---

## Los 4 artefactos

| Archivo | Pregunta que responde | Cuándo actualizarlo |
|---|---|---|
| `proposal.md` | ¿Por qué y qué? | Si cambia el alcance o la motivación |
| `specs/<dominio>/spec.md` | ¿Qué debe hacer el sistema? | Si cambian los requisitos observables |
| `design.md` | ¿Cómo? | Si cambia el enfoque técnico |
| `tasks.md` | ¿Qué pasos concretos? | A medida que se implementa (marcar `[x]`) |

---

## Delta specs — formato

Los specs dentro de un change son **deltas**, no specs completos. Usá estos headers:

```markdown
## ADDED Requirements

### Requirement: <nombre>
El sistema SHALL/MUST <comportamiento observable>.

#### Scenario: <nombre>
- **WHEN** <condición>
- **THEN** <resultado esperado>

## MODIFIED Requirements

### Requirement: <nombre existente exacto>
<!-- contenido COMPLETO actualizado — no parcial -->

## REMOVED Requirements

### Requirement: <nombre>
**Reason:** <por qué se elimina>
**Migration:** <qué usar en su lugar>
```

Reglas críticas:
- Scenarios usan exactamente `####` (4 hashtags) — nunca 3, nunca bullets
- Cada requirement DEBE tener al menos un scenario
- MODIFIED requiere el bloque completo, no solo la parte que cambia
- Usá SHALL/MUST para requisitos normativos

---

## Dominios de specs existentes

| Dominio | Qué cubre |
|---|---|
| `backend-api` | Auth middleware, `/api/me`, módulos REST por dominio |
| `postgres-data-layer` | PG como fuente de verdad, Prisma, sin fallback a Firestore |
| `store-onboarding` | Creación de Store + StoreMember OWNER para cuentas nuevas |
| `inventory-import` | Import CSV/XLSX con mapeo de columnas, normalización de batería |
| `inventory-pagination` | Paginación client-side (20 items/página, botones con elipsis) |
| `inventory-bulk-actions` | Selección masiva, Shift+click, bulk delete |
| `inventory-categories` | Tabs de categoría, CRUD, DnD reorder, mover items |
| `inventory-inline-edit` | Doble-click en celda, optimistic update, límite 30 chars |
| `inventory-column-customization` | Columnas redimensionables, reordenables y renombrables |
| `inventory-context-menu` | Menú contextual (click derecho) en filas |

Al proponer un change que toque uno de estos dominios, creá un delta spec con `## MODIFIED Requirements` — no uno nuevo desde cero.

---

## Convenciones de nombres

Usá kebab-case descriptivo. Ejemplos:

```
add-sales-report          ✓
fix-inventory-sort-bug    ✓
feature-1                 ✗
update                    ✗
```

El nombre del change se convierte en el directorio y en el prefijo del archivo archivado (`YYYY-MM-DD-<nombre>`), así que tiene que ser legible en el historial.

---

## Registrar features ya implementadas (retroactivo)

Si hay commits ya mergeados sin change correspondiente:

1. Crear el change: `openspec new change "<nombre>"`
2. Escribir los 4 artefactos manualmente con las tasks marcadas `[x]`
3. Verificar: `openspec status --change "<nombre>"` → debe mostrar 4/4
4. Archivar via CLI o con `mv` + promover specs manualmente a `openspec/specs/`

Preferí siempre el archive via `/opsx:archive` — el `mv` manual requiere promover los specs a mano.
