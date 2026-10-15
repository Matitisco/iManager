## Implementación
- [x] Permitir movimientos sin asignar y configuración opcional por moneda/medio.
- [x] Compensar sin modificar cierres ni originales y conservar idempotencia.
- [x] Permitir ajustes de precio pagado sin duplicar cobros; corregir singular de equipo.
## Validación
- [x] Agregar regresiones unitarias, integración y E2E desktop/iPhone.
- [x] Verificar prisma db push sin pérdida sobre datos existentes.
- [x] Ejecutar lint/typecheck, unitarios, integración y E2E relevantes, incluyendo #305.
- [x] Actualizar documentación y crear commit conciso en español, sin push.

## Regresión de reintegros sin caja (#307)
- [x] Condicionar la asignación de compensaciones a la caja del cobro original.
- [x] Cubrir cobros sin asignar, sin configuración y ajustes de precio con unitarios, integración y E2E desktop/iPhone.
- [x] Ejecutar lint/typecheck, unitarios, integración y E2E de caja, cuenta corriente y cancelación/reintegros.
- [x] Actualizar documentación y crear commit local en español, sin push.
