## Context
Las hojas usan Sheet y el historial se monta sobre el detalle. La guía exige una pantalla móvil completa con flecha y mantener el detalle al volver. Las ventas históricas pueden tener clientId sin clientName.

## Goals / Non-Goals
Corregir ambas regresiones con componentes y tokens existentes. No modificar contratos ni persistencia.

## Decisions
Usar mobileBack de Sheet y una clase de layout compartida limitada al historial a 760px. Mantener scroll interno y foco de useModalLayer. Resolver comprador con saleBuyer y los clientes del contexto, conservando el nombre histórico de la venta.

## Risks / Trade-offs
La regla de altura completa solo afecta historiales, también con pocos eventos. Verificar cierre por flecha/Escape y conservación del detalle.

## Validation
Chromium real a 1440×900 y 390×844, TypeScript y pruebas relacionadas con un máximo de dos workers.
