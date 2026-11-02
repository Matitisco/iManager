# QA Juan · 2 de noviembre de 2026

Rama `qa/juan-nov2`, base inicial `origin/test` en `866ff3b`. Se integraron localmente `fix/juan-nov2`, `fix/cliente-compras-count`, `fix/devolucion-parcial-ganancia` y `feat/admin-store-history`. Las ramas pendientes aparecieron antes del límite de 45 minutos; se hicieron reintentos cada tres minutos. También se incorporaron los avances concurrentes de `test` hasta `a618cfb`, conservando sus implementaciones y resolviendo los conflictos entre métricas y devoluciones. No se pusheó a `test` ni a `main`.

## Entorno y datos

- PostgreSQL nuevo y exclusivo: `127.0.0.1:55492/qa_juan_nov2`; segunda base `qa_juan_nov2_integration_test` para las integraciones. Sesión SQL UTC; navegador Buenos Aires.
- Fastify real `127.0.0.1:3196`, Vite `127.0.0.1:4196`, Chromium real a 1440 × 900 y 390 × 900. Sin build, Firebase real, BD de producción ni llamadas del navegador fuera de loopback.
- Autenticación de test existente; admin ficticio incluido en `ADMIN_EMAILS`. Claves de PostHog, importador remoto y pagos vacías; cotización manual 1000.
- Semilla por API real: mayorista USD, stock de 100 unidades a costo 60 y precio 100; siete ventas el mismo día al mismo cliente con cantidades 2/3/5/2/3/5/2. Venta adicional de 10 unidades a otro cliente, ventas de ayer, hace cinco días y hace 32 días, canje pendiente, reparación y empleado sin Reportes. Cada ejecución usa tiendas y personas ficticias nuevas.

## Resultados

| Punto | Estado | Evidencia / causa | Rama afectada |
| --- | --- | --- | --- |
| Integración y entorno local | OK | Cuatro ramas integradas; servicios y bases aislados | `qa/juan-nov2` |
| Dashboard | OK | Cinco presets y rango manual; ventas COMPLETADA y PENDIENTE, importes USD, costos y cantidades verificadas | `fix/juan-nov2` |
| Ficha de cliente | OK | Compras = 7, garantías = 22 unidades; listado completo de siete operaciones, desktop y móvil | `fix/cliente-compras-count` |
| Devolución: facturación y ganancia | OK | Devolver 200 de una venta de 1000 con costo total 600 deja 800 netos y ganancia 320. Coinciden Ventas, Dashboard, ficha, Reportes y API net-profit | `fix/devolucion-parcial-ganancia` |
| Tabla de Ventas | OK | Cant./Precio unit./Total/Ganancia; costo multiplicado por cantidad y scroll contenido en desktop; tarjetas en móvil | Base `test` |
| Admin e historial | OK | Altas, cambio de precio, archivo, actor/rol, filtros y una entrada diaria pese a repetir `/api/me`; propietario y empleado reciben 403 | `feat/admin-store-history` |
| Canje, reparación y reportes vecinos | OK | Canje retomado y confirmado con venta vinculada; reparación visible; Stock/Canjes/Clientes/Servicio sin NaN ni desborde | Base `test` |
| Privacidad financiera de empleado | FALLA | STAFF sin Reportes recibe 200 en overview y ve margen/ganancia. Excepción temporal explícita en ambas funciones `canSeeFinancials` | Preexistente en `test` |
| Reposición de devolución parcial | FALLA | Tras vender las diez unidades y devolver dos, stock queda en 0. `cantidad: 2` se ignora y solo cambia el estado | Devoluciones; pendiente fuera del ajuste financiero |

Las visitas de PostHog no se consultaron: el historial muestra el aviso previsto y los eventos de la BD local. La validación de cargas corresponde a altas reales de equipos; no se afirma cobertura del proveedor externo.

## Bugs reproducibles

1. **Alta: exposición financiera a STAFF sin permiso.** Crear empleado con secciones dashboard/inventory/sales/clients/tradeins/service/notifications, sin reports. `GET /api/reports/overview` responde 200; Dashboard muestra Margen bruto y Ventas muestra Ganancia total. Causa: `src/desk/sections.ts` y `backend/src/modules/stores/sections.ts` devuelven true para STAFF antes de consultar las secciones.
2. **Alta: no se reponen unidades devueltas.** Crear lote de 10, vender 10, abrir reclamo y resolver reintegro de 200 con destino STOCK y `cantidad: 2`. Se acepta el request pero inventario queda con cantidad 0 y estado EN_REVISION. Causa: schemas de devoluciones sin cantidad y `moveStock` actualiza solo estado. La regresión financiera del punto anterior sí pasa; no hay un campo de devolución física de unidades en el formulario.

## Regresiones y evidencia

Suite dedicada: `e2e/juan-nov2.spec.ts`, configuración `e2e/juan-nov2.config.ts`, semilla `e2e/fixtures/juan-nov2.ts`. Son veinte casos: dieciséis pasan y cuatro reproducen los dos bugs en ambos anchos. Los fallos llevan `@known-bug` y conservan asserts que exigen el comportamiento correcto; no se convierten en éxitos esperados ni se ocultan con mocks. El runner general los omite: esta suite necesita su configuración local con admin habilitado y base exclusiva.

TypeScript frontend/backend y los archivos e2e verificados sin build. Pruebas relacionadas: 220 frontend, 52 unitarias backend y 60 integraciones aprobadas. Los timeouts transitorios por carga del entorno se reejecutaron con timeout de test de 20 segundos.

Capturas, fixtures de ejecución ficticios, resultados JSON y trazas están en `/workspace/qa-juan-nov2/`. Capturas representativas: `cliente-siete-compras-{1440,390}.png`, `dashboard-pendientes-rango-manual-{1440,390}.png`, `devolucion-parcial-{ventas,dashboard,cliente,reportes,reportes-ganancia}-{1440,390}.png`, `admin-historial-filtros-{1440,390}.png`, `empleado-dashboard-{1440,390}.png` y `devolucion-unidades-stock-{1440,390}.png`. Todas las personas y tiendas de esa evidencia son ficticias.

## Reejecución local

Con PostgreSQL local y una base vacía llamada `qa_juan_nov2`:

```bash
npm ci
npm --prefix backend ci
npm --prefix backend run prisma:generate
npx playwright install chromium --only-shell
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55492/qa_juan_nov2 \
  npx playwright test --config e2e/juan-nov2.config.ts
```

La configuración inicia API y Vite, aplica el schema solo a esa base, rechaza hosts no locales y genera la semilla. Para usar servidores existentes, agregar `JUAN_QA_EXISTING=1`; comprobar antes `/api/health`. `JUAN_QA_ARTIFACTS` cambia la carpeta de evidencia (default `test-results/juan-nov2`). Se pueden cambiar los puertos con `PLAYWRIGHT_APP_BASE_URL` y `PLAYWRIGHT_API_BASE_URL`, siempre locales.

Para ejecutar solo los dieciséis flujos conformes, agregar `--grep-invert @known-bug`; la suite completa debe seguir roja hasta corregir los dos bugs documentados.
