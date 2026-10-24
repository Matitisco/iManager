## Context
SalePaymentsFields ya convierte pagos al validar el payload, pero coveredPreview suma importes sin moneda. El QA local lo reprodujo en Chromium a 1440×900.

## Goals / Non-Goals
Alinear la visibilidad de Excedente con la liquidación existente. No cambiar contratos ni componentes compartidos.

## Decisions
Calcular coveredPreview usando la cotización positiva y finita para cada fila en moneda diferente. Si falta una cotización válida devolver null y mantener la validación visible. Usar `due + 0.009` tanto para la nota como para las opciones.

## Risks / Trade-offs
La vista sigue siendo orientativa; el backend confirma la liquidación. Cubrir ambas direcciones ARS/USD, suma mixta, cotización inválida y tolerancia.

## Validation
Pruebas relacionadas con máximo dos workers, lint frontend/backend en paralelo, QA visual desktop/mobile y persistencia en la DB ficticia compartida. No build ni suite completa.
