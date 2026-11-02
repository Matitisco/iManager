# Dashboard mayorista · 2 de noviembre de 2026

Reproducción enteramente sintética, mediante Fastify y PostgreSQL nuevo en `127.0.0.1:56431/imanager_dashboard_regression`. Sin credenciales, consultas ni datos de producción; sin build.

El overview contaba sólo COMPLETADA. PENDIENTE indica saldo por cobrar, pero la venta ya existe y descontó unidades de inventario. Con todas las ventas a cuenta, resumen, tendencia y medios quedaban en cero independientemente del rango. El filtro aparece en la historia anterior a #700; ni el default de siete días ni la suma de cantidad causan esos ceros.

Fixture: ocho ventas USD por API de operaciones, cantidades 3/2/4/5/6/7/8/9, precio unitario 650 y costo unitario 450. Hay fechas recientes, cambio de mes, histórico y extremos de días argentinos. Matriz de seis rangos × dos estados × dos monedas de tienda; cotización manual 1200 para ARS. Control de otras tiendas y anulaciones. Prueba adicional de cancelledAt en período actual y comparación.

| Período | Unidades | Facturación USD | Margen USD |
| --- | ---: | ---: | ---: |
| Hoy, 2/11 | 3 | 1950 | 600 |
| Últimos 7 días, 27/10–2/11 | 9 | 5850 | 1800 |
| Este mes, 1–2/11 | 5 | 3250 | 1000 |
| Mes anterior, octubre | 22 | 14300 | 4400 |
| Total | 44 | 28600 | 8800 |
| Manual, 26/10–1/11 | 11 | 7150 | 2200 |

Con el servicio original de `866ff3b`, la matriz produce 12 fallos (todas las PENDIENTE) y 12 controles COMPLETADA aprobados. Ejemplo: siete días devuelve 0/0/0 frente a 5850/1800/9 esperados. El fix usa el mismo conjunto activo para el período actual y el anterior, conservando importe total, costo por unidad, conversión y exclusión de anuladas. No modifica cobros ni caja.

Validación: TypeScript frontend/backend; 82 pruebas frontend de Dashboard/selector/fechas/caché/cliente HTTP; 35 unitarias de reportes; 25 integraciones nuevas y 17 existentes de cantidad. Selector desktop y móvil conserva los importes USD y las unidades al aplicar cada preset.

Reejecución (base local exclusiva de test):

```bash
DATABASE_URL=postgresql://postgres:unused@127.0.0.1:56431/imanager_dashboard_regression npm --prefix backend run test:integration -- dashboard-wholesale.integration.test.ts equipment-cantidad.integration.test.ts
npm --prefix backend run test:unit -- reports.service.test.ts reports.routes.test.ts --maxWorkers=2
npm run test:frontend -- src/desk/screens/DashboardScreen.test.tsx src/desk/screens/NewAccountDashboard.test.tsx src/desk/dashboard-period.test.ts src/desk/dashboard-date-range.test.tsx src/desk/dashboard-cache.test.ts src/services/reports-api.test.ts --maxWorkers=2
npm run lint
npm --prefix backend run lint
```
