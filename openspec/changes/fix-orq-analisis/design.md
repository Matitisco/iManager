## Context
ReturnsPatterns conserva selectedKey, allClaims y claimId. La hoja de origen permanece montada detrás de ReturnDetail; el historial del reclamo agrega una tercera hoja. QA local confirmó el problema en 1440 y 390.

## Goals / Non-Goals
Limitar el flujo a dos hojas conservando navegación y foco. Sin cambios a ReturnDetail, RecordHistoryButton, ui.tsx ni CSS compartido.

## Decisions
Condicionar ambas hojas de origen a claimId vacío. Conservar selectedKey/allClaims al abrir el reclamo para remontar el origen al volver. Registrar referencias a los botones por id y restaurar foco cuando se cierre el reclamo.

## Risks / Trade-offs
El origen se remonta y puede reiniciar su scroll interno; se vuelve a enfocar la fila elegida para mantener su ubicación accesible. Las pruebas deben verificar comportamiento y restauración de foco, sin depender de la identidad DOM anterior.

## Validation
Regresión en ambos layouts y puntos de entrada, lint frontend/backend en paralelo y retest Chromium en runtime local con historial, cierre y recarga. No build ni suite completa.
