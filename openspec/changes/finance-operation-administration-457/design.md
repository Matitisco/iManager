## Context
Base f889b830b32e40b29fb95bc9418d90de34ad008f, igual a origin/main local. Diseños aprobados 457 en pantallas; HTML/PNG son referencia y TSX son prototipos. Plan aprobado en la solicitud autoriza implementación.

## Decisions
- Cada caja conserva moneda y medio. Desktop: operación/movimientos y columna secundaria de administración/cierres; móvil: una columna. Sin estado «Sin abrir»: última sesión cerrada o ausencia de historial explícita.
- Devolver openedAt, openedBy (nombre solamente) y opening protegido por cashBalances. Resolver nombres en lote. Exponer día vigente y zona de tienda para apertura válida.
- Aprobación/reconteo/ajustes/administración exclusivos del dueño, conteo a ciegas e idempotencia conservados.
- Resumen mensual de gastos desde /api/reports/net-profit; cantidades desconocidas como —. Filtros de lista independientes del resumen. No calcular totales con historial paginado.
- El gasto reduce resultados y no mueve Caja. Ofrecer Ir a Cajas sin crear movimientos. «Egreso registrado» se reserva para una relación verificable futura: no existe en Expense/CashMovement.
- Formulario usa notes, sin concepto persistido; recuperación de archivados desde fetchExpenses existente. Footer fijo y errores sin perder borrador.
- Proveedores: contacto/equipos/última compra activa (StockPurchase), agregación por supplierId. No proveedores sintéticos de canjes. Ficha con costos sujetos a permiso y acciones secundarias en menú.
- STAFF no descubre Finanzas en desktop/Más/chips; sectionAllowed y aliases mantienen autorización.

## Validation
Suites frontend, backend unitarias/integración, typechecks y E2E secuenciales. Persistencia exclusivamente en 127.0.0.1:5434/imanager_test. Capturas antes/después con API interceptada y datos ficticios, 390×844/1440×900 y modales 1536×640. Sin cambios a AppContext ni componentes globales.

## Tooling
El binario openspec no está instalado; artefactos creados manualmente según openspec/AGENTS.md. No archivar esta entrega.
