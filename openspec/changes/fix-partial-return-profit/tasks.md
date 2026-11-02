- [x] Backend: exponer cantidad de venta en devoluciones y corregir facturación/margen de overview y comparación.
- [x] Frontend: descontar devoluciones en Ventas, ficha/lista de clientes y reportes; costo total por cantidad.
- [x] Regresión: integración local 10 unidades y devolución parcial con reintegro/nota y ARS/USD; render y períodos.
- [x] Validación: lint frontend/backend y tests relacionados sin build; commit, push de rama y PR contra test.

Validación: lint frontend/backend OK; 211 tests frontend, 1.021 unitarias backend y 49 integraciones (4 nuevas) OK. PostgreSQL local nuevo en 127.0.0.1:55439, base imanager_partial_return_test, datos sintéticos. Regresión antes del fix: las 4 variantes fallaban por facturación 1.000 en vez de 800 y margen 32% en vez de 40%. Sin build ni acceso a producción.
