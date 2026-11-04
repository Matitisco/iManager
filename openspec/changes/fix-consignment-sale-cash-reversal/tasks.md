# Tareas

- [x] Reproducir W4-02 en una base local exclusiva.
- [x] Revertir caja de la venta anulada en la misma transacción.
- [x] Mostrar la devolución en la confirmación de la venta.
- [x] Verificar idempotencia y ventas integradas con regresiones.
- [x] Ejecutar typecheck frontend/backend e integraciones sales/consignments/cash.
- [x] Preparar la entrega en la rama local y el resumen `/workspace/fix-nov4/w402.md`.

## Validación

Regresión QA reproducida en rojo (caja neta ARS 500.310 en vez de cero) y luego verde; diálogo también reproducido en rojo y verde. TypeScript frontend/backend sin errores; 126 integraciones, 48 unitarias backend y 51 pruebas frontend aprobadas.

Base creada exclusivamente para esta corrección: `qa_w402_integration` en `127.0.0.1:55404`. Sin build, push, PR, producción ni bases remotas.
