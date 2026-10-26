# Diseño

Usar las operaciones de AppContext y la definición existente de la ficha: ventas y reparaciones no anuladas; canjes recibidos no suman compras. Compartir agregación y formato con la lista, incluidos filtros y orden por monto. No utilizar el acumulador histórico Client.totalSpent ni balanceCurrency para este indicador. Resolver monedas ausentes con la moneda activa del sistema; desglosar monedas múltiples y mantener la conversión existente para totales de una moneda.

El encabezado público ORIGINAL indica moneda por equipo; ARS/USD explícitos conservan su etiqueta. Mantener precios y conversión existentes del catálogo, sin cambios en backend, persistencia ni CSS.

Evidencia en /workspace/qa-montos-impl, PostgreSQL ficticio imanager_ux leído sin mutaciones, puertos 3670/4670. Verificar TypeScript frontend/backend y tests relacionados con máximo dos workers, sin build.
