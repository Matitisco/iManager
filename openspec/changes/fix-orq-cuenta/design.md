## Context
Reproducido en Chromium local 390×844 @2x: copiar con «QA cuenta invalido» llama POST /api/invitations y recibe 400. Capturas externas 025/026. Avatares azules/rosas visibles en 005/023. Onboarding nativo requiere estilos compartidos y se reporta fuera del fix.

## Goals / Non-Goals
Unificar validación antes de cualquier escritura/copia y usar tokens neutros. No rediseñar formularios ni modificar permisos, servicios o fuentes de datos.

## Decisions
Compartir una función local de validación entre ambos handlers. Un estado de error de campo separado permite que Field muestre el error junto al campo y el input exponga aria-invalid; limpiarlo al corregir el email. Usar var(--row) y var(--primary) para los avatares existentes.

## Risks / Trade-offs
Se conserva la misma regla de email que ya usaba Crear link. El servidor mantiene validación definitiva. Pruebas cubren ambos botones, opcionalidad y recuperación.

## Validation
TypeScript frontend/backend en paralelo y tests relacionados con maxWorkers=2 bajo flock. Retest visual y persistencia sobre tienda QA cuenta propia en runtime compartido. Sin build ni suite completa.
