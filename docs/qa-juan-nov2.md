# QA Juan · 2 de noviembre de 2026

Rama `qa/juan-nov2`, PR #712 contra `test`. Base inicial `866ff3b`; se integraron `fix/juan-nov2`, `fix/cliente-compras-count`, `fix/devolucion-parcial-ganancia` y `feat/admin-store-history`. En el cierre se hizo fetch explícito de `test` y merge de `origin/test` en `9ee29dd` (#708), resolviendo los conflictos del historial con la implementación vigente de la base. En el último fetch apareció #711 recién mergeado: se integró también `b9a89a6`, conservando ventas elegibles, cantidades parciales, límites proporcionales y su selector compartido. No se modificaron ni pushearon `test` o `main`.

La suite completa queda verde: **20/20**, diez casos en desktop y diez en mobile, sin `@known-bug`, `expected-failure` ni mocks de negocio. La exposición financiera señalada inicialmente era el comportamiento temporal intencional de #691; se corrigió el test. La reposición física sí tenía un defecto real y se corrigió.

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
| Finanzas de STAFF según #691 | OK | Overview 200, costo unitario 60 y ganancias positivas por API/UI. Reportes no aparece en navegación y admin conserva 403; ambas funciones `canSeeFinancials` quedan intactas | Expectativa de QA corregida |
| Reposición de devolución parcial | OK | Vender diez y devolver dos ingresa un registro de cantidad 2 y estado EN_REVISION. Se conserva el lote original, incluso agotado, según #711 | Fix en `qa/juan-nov2` |

Las visitas de PostHog no se consultaron: el historial muestra el aviso previsto y los eventos de la BD local. La validación de cargas corresponde a altas reales de equipos; no se afirma cobertura del proveedor externo.

## Causas y correcciones

1. **STAFF: expectativa obsoleta del test.** #691 (`9d1cabb`) concede temporalmente facturación, costos, ganancias y margen a STAFF, como al dueño, sin cambiar acceso a la sección Reportes. El QA anterior exigía overview 403 y ocultamiento de ganancias, en contradicción con esa decisión. Se conservan sin cambios `src/desk/sections.ts`, `backend/src/modules/stores/sections.ts`, el costo de inventario y el bridge de sesión. El test ahora exige overview 200, costo 60, margen/ganancia positivos en ambos anchos y ausencia de Reportes en navegación; el escenario administrativo sigue exigiendo 403.
2. **Stock: cantidad descartada y actualización de solo estado.** Los schemas de apertura/resolución omitían `cantidad` y `moveStock` no reponía unidades descontadas al vender. La integración de #711 agrega `ReturnCase.cantidad` nullable, valida unidades de apertura e ingresa un registro separado para lotes sin IMEI, preservando el original, sus remanentes y reservas. La regresión ahora busca el registro vinculado al reclamo: exige dos unidades devueltas y cero en el lote original agotado; no confunde identidad de registro con falta de reposición. Además se permite precisar la cantidad al resolver, se valida contra el reclamo y la venta vigente, y se usa esa cantidad también para el límite económico proporcional de #711. El selector de apertura de #711 y sus ventas elegibles se conservan. RMA ingresa una vez, recibir no duplica y reparación devuelve las unidades al cliente. Resolver dos veces, anular/cambiar una venta con devolución física, resolver una venta anulada o sobrepasar unidades previamente devueltas se rechaza sin duplicar efectos.

`cantidad: null` conserva el alcance de toda la venta para reclamos históricos. Las ventas históricas de una unidad que no descontaban cantidad mantienen su semántica. No se infieren ni corrigen retroactivamente cantidades físicas a partir de importes monetarios.

El merge también actualizó las expectativas de historial de la suite: «Se conectó», descripción del precio con campos y filtro `create`, según #708. No se reintrodujeron las categorías anteriores.

## Regresiones y evidencia

Suite dedicada: `e2e/juan-nov2.spec.ts`, configuración `e2e/juan-nov2.config.ts`, semilla `e2e/fixtures/juan-nov2.ts`. Son veinte casos: **todos pasan** con Chromium real a 1440×900 y 390×900. El flujo por formulario devuelve dos unidades desde un lote con remanente y verifica que éste no cambia; el caso API vende diez de diez y exige exactamente dos unidades en el registro devuelto, conservando cero en el original. Facturación y ganancia siguen neteando 200 y 80 respectivamente.

Antes del fix, la reproducción enfocada dejó los dos casos de stock rojos (cantidad esperada 2, recibida 0) y los cuatro casos STAFF/admin verdes después de alinear las expectativas vigentes.

Validación sin build: TypeScript frontend, backend y archivos e2e; **217 pruebas frontend**, **1.061 unitarias backend** y **103 integraciones relacionadas**. Las integraciones incluyen cantidades inválidas, remanente/reserva, legado, resolución concurrente, rollback, aislamiento, archivo, RMA, edición/anulación/restauración y límite económico. Se conserva la prueba de límite económico actualizada por #711, con tres unidades sin IMEI y una devolución por reclamo. No se consultaron datos reales.

La suite general omite la ejecución de estos casos por su guard de entorno local; no se modificó ese aislamiento. Los veinte se ejecutan con su configuración dedicada.

Evidencia inicial en `/workspace/qa-juan-nov2/`; capturas, fixtures ficticios y JSON de la ejecución final en `test-results/juan-nov2/` (fuera de git). Logs de validación en `/tmp/qa-712-*.log`. Capturas representativas: `cliente-siete-compras-{1440,390}.png`, `dashboard-pendientes-rango-manual-{1440,390}.png`, `devolucion-parcial-{ventas,dashboard,cliente,reportes,reportes-ganancia}-{1440,390}.png`, `admin-historial-filtros-{1440,390}.png`, `empleado-dashboard-{1440,390}.png` y `devolucion-unidades-stock-{1440,390}.png`. Todas las personas y tiendas de esa evidencia son ficticias.

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

La ejecución completa debe dar `20 passed`; no se requiere excluir ningún caso.
