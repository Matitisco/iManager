# Diseño

Reutilizar `reverseCashSource` dentro de la transacción de anulación de ventas directas. Las ventas ya canceladas conservan los efectos de su cancelación previa; las integradas siguen usando su servicio de operaciones. Las reversas enlazan cada movimiento original y respetan su asignación de caja.

Calcular el plan del diálogo para ventas activas independientemente de `integratedOperation`, utilizando los importes y movimientos existentes.

Validar la regresión W4-02 copiada de QA, repetición, concurrencia, rollback, moneda y ausencia de doble reversión integrada. Ejecutar TypeScript frontend/backend e integraciones relacionadas exclusivamente en una base propia de PostgreSQL local, sin build ni push.
