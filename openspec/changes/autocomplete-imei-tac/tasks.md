# Tareas

## Datos y frontend originales
- [x] Incorporar CSV Apple, generador, tabla y aviso MIT.
- [x] Agregar lookup, integrar parser y formularios existentes.
- [x] Cubrir tabla, prioridad, edición manual, escaneo y vista previa.

## B — Samsung
- [x] Validar ambos CSV y generar datos compactos con catálogo Samsung compartido.
- [x] Decodificar perezosamente y conservar Apple/ediciones manuales sin inferir otros campos.
- [x] Auditar modelos, DTOs, normalización, filtros y catálogos; ampliar atribución MIT.
- [x] Cubrir reproducibilidad, duplicados, decodificación y formularios Samsung.
- [x] Medir bundle JS total sin gzip y gzip antes/después y documentar decisión de chunk.

## A — TAC faltantes
- [x] Agregar helper silencioso, autenticado y deduplicado en los puntos de autocompletado.
- [x] Agregar modelo aditivo, migración CREATE TABLE, cliente Prisma y POST limitado por usuario.
- [x] Agregar GET admin de plataforma con límites y orden por count.
- [x] Agregar pruebas de privacidad, dedupe, hooks, upsert, formato, auth y acceso admin.
- [x] Documentar consulta de faltantes en este change.

## Verificación
- [x] TypeScript explícito y lint frontend/backend.
- [x] Tests relacionados y suites completas frontend y backend unit.
- [x] Integración PostgreSQL local de los endpoints y regresión analytics.
- [x] Generador sin diferencias y revisión final del diff; ampliar entrada existente de PROJECT_STATUS.

Resultados y comando de consulta: ver `design.md`. Verificación completada sin
commit ni push; el change permanece activo.
