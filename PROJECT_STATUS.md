# iManager - Project Status

Documento vivo. Se actualiza al cerrar cada iteracion importante.
**Ultima actualizacion: 2026-10-12**

## Issue #286 — Seguimiento QA del detalle de venta — 2026-10-12

- `SaleDetail` entrega sus acciones al footer explícito de `Sheet`; el cuerpo conserva scroll propio y el footer no encoge. La misma vista atiende Ventas, Reportes («Ventas del período»), Dashboard y notificaciones, también para ventas iniciadas desde la ficha del cliente.
- Grilla de dos columnas iguales con separación de 10 px para dos, tres o cuatro acciones; la última acción impar ocupa toda la fila. Canje agrupado en «Canje como parte de pago», botones de al menos 48 px y safe areas de iPhone.
- Validación: lint frontend/backend, build solicitado y 497 tests Vitest aprobados. Suite E2E completa: 116 casos aprobados con `--workers=1`; pasada final del detalle: 12 casos aprobados, con geometría y scroll a 1280×640, 1280×800, 1440×900 e iPhone 13 (WebKit). La ejecución secuencial evita los conflictos de serialización de los fixtures observados con cuatro workers.
- Las cuatro capturas `docs/pr-shots/issue-286-fix-{desktop,mobile-iphone}-{canje,sin-canje}.png` fueron generadas e inspeccionadas. Regenerar con `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_issue286_fix_test ISSUE_286_SHOTS=docs/pr-shots npm run test:e2e -- e2e/sale-detail-layout.spec.ts --workers=1`. La evidencia con canje se abre desde Reportes y muestra todo el bloque después del scroll; la venta histórica sin canje se importa por API para ejercitar tres botones reales.
- El test de menú de filas guarda sus capturas en `test-results/row-actions-shots` (o `ROW_ACTIONS_SHOTS`) para funcionar sin permisos sobre `/opt/cursor/artifacts`. Commit en la rama actual, sin push y sin incluir `.qa`, según el pedido.

## Issue #287 — Desplegable propio de Reportes — 2026-10-12

- `DeskSelect` reemplaza el selector nativo de Desglose en todos los reportes y se reutiliza en moneda/cotización de Configuración. Conserva valores, permisos y validación; no modifica backend ni AppContext.
- Combobox/listbox con flechas, Enter/Espacio, Home/End, typeahead, Escape y clic externo; selección amarilla, hover y foco visible. En teléfonos usa sheet modal con safe areas, filas de 52 px, fondo inert y foco contenido/restaurado. Escape cierra el selector antes del modal padre.
- Validación: lint frontend/backend, build solicitado por el issue y 487 tests frontend (12 nuevos del componente) aprobados. Los 12 escenarios Playwright de Reportes, Configuración, moneda y cotización pasan, incluido WebKit con emulación iPhone 13.
- Capturas revisadas: `docs/pr-shots/issue-287-desktop.png` (1440×900) y `docs/pr-shots/issue-287-mobile-iphone.png` (iPhone 13, retina). E2E usa exclusivamente Postgres local `imanager_issue287_test`; puertos 3127/4177 por colisión con los habituales mediante configuración temporal retirada. Para regenerar capturas: `ISSUE_287_SHOTS=docs/pr-shots npx playwright test e2e/report-dropdown*.spec.ts` con los servidores/DB de la configuración E2E.
- Commit en la rama actual y sin push, según la instrucción específica del issue.

## Issue #285 — Acciones masivas en las tablas — 2026-10-12

- Inventario, Ventas, Canjes y Clientes incorporan checkboxes por fila, selección del filtro completo entre páginas, rangos con Shift+click y barra con cantidad. La selección se limita al usuario/tienda y descarta registros que salen del filtro.
- Las cuatro tablas exportan los campos explícitos seleccionados a CSV con moneda original, sin costos ocultos. El helper de descarga se comparte con Reportes y conserva acentos, comillas y saltos de línea; neutraliza fórmulas de planilla.
- Inventario/Clientes permiten eliminar; Ventas permite cancelar operaciones integradas o asociadas a un canje; Canjes permite cancelar operaciones pendientes/confirmadas. Los registros históricos sin operación y los cancelados se pueden exportar. Las acciones destructivas usan confirmación y `canManageSensitive`, y reutilizan los endpoints existentes con permisos, scope de tienda, auditoría y reglas de stock/saldos. Sin endpoints ni cambios de Prisma; sin cambios en comisiones.
- Cada lote procesa solicitudes individuales en secuencia: ante el primer error se detiene, informa completados/pendientes y conserva los pendientes seleccionados. No se promete atomicidad global. Cambiar de sección, tienda o usuario impide continuar la secuencia; se bloquean doble envío y cierre durante el procesamiento.
- En móvil, mantener presionada una tarjeta selecciona sin abrir el detalle/menú; scroll/cancelación interrumpe el gesto. Barra inferior con safe areas, controles de 44 px; reemplaza la navegación inferior mientras hay selección. El menú ⋯ sigue disponible fuera de selección.
- Validación: lint frontend/backend, build, 496 tests frontend, 232 unitarios y 75 de integración backend aprobados. 14 escenarios Playwright aprobados: acciones en las cuatro tablas, inventario, patrones móviles y menú por fila. La suite de menú acepta `ROW_ACTIONS_SHOTS` para evitar rutas de capturas de otra máquina.
- Capturas generadas e inspeccionadas en `docs/pr-shots/issue-285-desktop.png`, `issue-285-mobile-iphone.png` e `issue-285-desktop-confirm.png`: desktop 1440×900 e iPhone 13/WebKit 390×844, sin overflow, barra/confirmación completas. Regenerar con `ISSUE_285_SHOTS=docs/pr-shots npm run test:e2e -- e2e/bulk-actions.spec.ts` y una base local de pruebas. Esta sesión usó `imanager_issue285_test`/`imanager_issue285_e2e_test` y puertos temporales 3125/4195 por colisión con los habituales.
- Commit en la rama actual, sin push, según el pedido de la issue.

- Corrección CI #285: la celda de selección usa el nombre genérico «Selección» y el input conserva «Seleccionar …», evitando que los nombres de registros coincidan con dos celdas. Las filas desktop abren el detalle sin cambiar la selección, incluso con selección activa; solo el checkbox y su label seleccionan. Las tarjetas móviles conservan sus gestos. Cuatro regresiones nuevas cubren las tablas; se mantienen las expectativas E2E existentes.
- Validación de la corrección: lint frontend/backend, build solicitado, 512 tests frontend y los 109 escenarios de la suite E2E completa aprobados. Ejecución final E2E con un worker, sin retries, usando exclusivamente PostgreSQL local `imanager_issue285_regression_test`; se prepararon las carpetas de capturas existentes en `/opt/cursor/artifacts/` sin cambiar tests. Commit en la rama actual, sin push.

## Issue #286 — Detalle de venta compacto — 2026-10-12

- El detalle agrupa los datos del canje en dos columnas. El cuerpo tiene scroll propio y las acciones permanecen visibles en el footer en desktop y mobile, con botones de al menos 48 px y safe area inferior. Conserva textos, permisos y operaciones existentes; solo frontend.
- Validación: lint frontend/backend, build y 478 tests frontend aprobados. Seis escenarios Playwright aprobados, incluidas regresiones de ventas/canjes y layout en WebKit a 1440×900 e iPhone 13 con viewport 390×844. El footer permanece fijo también al forzar scroll con 500 px de altura; sin overflow horizontal.
- Capturas generadas e inspeccionadas en `docs/pr-shots/issue-286-desktop.png` y `docs/pr-shots/issue-286-mobile-iphone.png`: las cuatro acciones visibles sin scroll. Regenerar con `ISSUE_286_SHOTS=docs/pr-shots npm run test:e2e -- e2e/sale-detail-layout.spec.ts` usando una base local de pruebas. Validación local en `imanager_issue286_test`, con puertos temporales 3119/4189 por colisión con los habituales.
- Commit en la rama actual, sin push, según el pedido de esta issue.

## Issue #290 — PWA instalable — 2026-10-12

- Manifest completo y assets del logo propuesta 3: íconos normales/maskable, Apple touch y 26 splash screens de iPhone. Guía Safari ilustrada y prompt Android después de 30 s con sesión/tienda lista; descarte persistente, sin invitación en desktop/standalone.
- Worker de producción con caché explícita de shell/bundles/branding, excluyendo API, sesión, helpers Firebase y query strings. Actualizaciones esperan el cierre de clientes. Safe areas en login/onboarding, shell y navegación.
- Google en iOS standalone usa redirect y helpers del mismo origen a través del servidor web; errores visibles en Login. Email/password y popup del navegador conservados. El handler del dominio desplegado debe estar autorizado en Firebase/Google OAuth.
- Build y TypeScript frontend/backend aprobados, pruebas PWA/worker/servidor aprobadas y unitarios backend aprobados sin tests live. La validación de navegador está bloqueada por sandbox/sockets/DNS; queda suite WebKit/Chromium en CI y checklist de iPhone/OAuth real en `docs/pwa.md`.
- Commit local bloqueado porque `.git` es solo lectura (`.git/index.lock`). Cambios en la rama existente, sin push ni PR.

## Iteración hifi-desk — 2026-10-06

- Issue #89: Inventario, Ventas, Clientes y Canjes comparten operaciones atómicas. Venta/canje mantiene el precio total de salida, diferencia y deuda; los borradores persisten y se recuperan, y cancelar restaura la salida, archiva el recibido y revierte saldos sin borrar historia.
- Las notificaciones de operaciones y el alta/cambio manual a VENDIDO se guardan en PostgreSQL. Cada evento se comparte por tienda, las lecturas son por usuario, la lista respeta permisos de sección y los enlaces abren registros autorizados, incluido el detalle archivado de un recibido.
- Validación #89: integración backend, pruebas frontend y Playwright de operaciones, recuperación, cancelación y notificaciones; lint TypeScript frontend/backend. Tests E2E usan exclusivamente la base local `imanager_issue89_test`; no se corrió build.

- Ajuste visual #84: los calendarios de Reportes reemplazan el popup nativo por un desplegable del sistema: tipografía DM Sans, superficies blancas, bordes redondeados, selección oscura y acentos lima. Incluye escritura dd/mm/aaaa, selección de mes/año, Hoy/Borrar, navegación por teclado, cierre externo/Escape y ubicación dentro del viewport. Las fechas siguen siendo borradores hasta aplicar el período.
- Validación del calendario: 37 pruebas de calendario, períodos y Reportes aprobadas; TypeScript frontend/backend aprobado. Revisión visual del componente real a 1440 px y del popup en una ventana de 680×600 px, con selección, cambios de mes/año y cierre verificados.
- Issue #84: Reportes incorpora Personalizado con fecha de inicio/fin inclusivas y aplicación explícita. Fechas faltantes, inválidas o invertidas conservan el último reporte válido. Totales, gráficos, listas y CSV usan el mismo período en Ventas, Stock y Canjes; la exportación también respeta el filtro de categoría.
- Stock informa equipos ingresados en el período con su estado actual y explica los registros sin fecha excluidos. Los gráficos cubren todo el rango con hasta 12 barras; fechas YYYY-MM-DD se interpretan y muestran en el calendario local.
- Validación #84 (2026-10-07): 45 pruebas aprobadas, incluidas 29 nuevas de fechas y pantalla; TypeScript frontend/backend aprobado. Revisión del componente real con datos de prueba a 1440/1024 px, rango de seis años y error de fechas invertidas. Sin cambios de API, AppContext o Prisma.
- Issue #85: el rol STAFF se muestra como Empleado en toda la interfaz: invitaciones, equipo, perfil, navegación, login, onboarding y selector de tienda. También se unificaron las referencias anteriores a Vendedor.
- Validación #85: 19 pruebas existentes de Login, Onboarding, Settings y StoreSwitcher aprobadas; TypeScript frontend/backend aprobado. Búsqueda en `src/` sin etiquetas Agente/Vendedor restantes. Cambio de texto, sin modificaciones de permisos, API o base de datos.
- Issue #62: al volver del popup de Google, el login y el registro recuperan el botón sin esperar la respuesta diferida de Firebase. Cierres/cancelaciones no muestran un error; respuestas de intentos anteriores no alteran un reintento.
- Validación: 12 pruebas de Login aprobadas, incluidos foco, visibilidad, reintentos y limpieza al desmontar. TypeScript de frontend y backend aprobado. La autenticación real continúa en Firebase; las pruebas usan promesas controladas y eventos del navegador.
- Issue #81: el indicador de batería hi-fi reutiliza los colores de `main` (rojo <70%, ámbar 70–85%, verde >85%) y anima el llenado con Motion. Conserva rangos y convierte fracciones decimales con los mismos helpers de la referencia.
- Validación #81: revisión en Chrome del componente real con 69/70/85/86/100%, rangos y fracciones; transición de 87% a 40% y llenado de entrada observados. Los 10 tests existentes de los helpers y TypeScript frontend/backend pasaron. Vista temporal de QA retirada.

- Issue #146: editar una venta permite agregar, modificar o quitar el canje en desktop y mobile con el formulario compartido. Quitar conserva la venta activa y el historial del canje, archiva el recibido y recalcula la deuda; un recibido ya vendido bloquea la operación sin cambios parciales. Compatible con ventas históricas; sin cambios de Prisma.
- Validación #146: 450 tests frontend, 225 unitarios backend y 72 de integración aprobados; lint frontend/backend aprobado. Playwright verifica agregar, cambiar, quitar y persistir tras recargar a 1440×900 y 390×844. Capturas en `docs/pr-shots/issue-146-*.png`; sin build.

- Issue #288: Canjes muestra Cancelado con ícono y color en historial/filtros y mantiene los filtros mobile en una fila. Al quitar un canje, conserva el número de venta en `TradeIn.removedFromSaleNumber` (único campo nuevo nullable, solo lectura) y muestra «Canje quitado de la venta V-XXXX» tras recargar; las otras cancelaciones y registros antiguos sin referencia muestran «Operación cancelada». El aviso usa el estado técnico real del canje, incluido Pendiente, y los modales mobile cubren la navegación inferior hasta el borde de la pantalla con safe area y scroll interno.
- Validación #288: lint frontend/backend, 453 tests frontend, 232 unitarios backend, 73 de integración con Postgres local `imanager_test` y 6 escenarios Playwright aprobados (regresión #146, patrones compartidos y presentación #288). Ocho capturas a 1440×900 y 390×844 en `docs/pr-shots/issue-288-*.png`; sin build. Los E2E usaron puertos 3118/4178 mediante una configuración temporal por colisión con otra app local.
- Corrección CI #288: cancelar la operación completa vuelve a mostrar «Operación cancelada» en aviso, historial y detalle. Settings comprueba que el sheet cubre la tab bar y sus acciones reciben clics; el walkthrough mobile cierra la OT antes de navegar. Sus capturas son opcionales mediante `REFACTOR_WALKTHROUGH_SHOTS`, sin depender de rutas de Cursor. Validación local: 19 escenarios E2E aprobados (los cuatro specs fallidos, presentación #288 y patrones), 33 tests frontend, 27 de integración y lint frontend/backend; bases Postgres locales separadas y puertos 3118/4178, sin build ni regeneración de capturas del PR.

---

## Estado actual

- Core estable con datos reales en Railway (Postgres + Firebase Auth)
- Inventory es el modulo mas maduro: categorias, import XLSX, inline edit, bulk actions, paginacion, sort
- Trade-ins ya usa TableEngine para el historial, alineado con Inventory, Clients y Sales
- Tests unitarios de frontend + CI con GitHub Actions agregados hoy
- Dashboard sigue siendo demo (Fase 3 pendiente)
- Reports ahora consume SQL real con widgets configurables, rango custom y export local de lo visible

---

## Modulos: estado detallado

### Produccion

| Modulo     | Notas |
|------------|-------|
| Auth       | Google + email/password, `/api/me`, retry automatico cada 15 s |
| Onboarding | Pantalla real para usuarios sin Store/StoreMember; crea contexto antes del core |
| Inventory  | Categorias con tabs, inline edit (dbl-click), bulk select (shift+click), delete, import CSV/XLSX con mapeo de columnas, paginacion (20/pag), sort, columnas custom |
| Clients    | CRUD real en backend |
| Sales      | Transaccional; muta status de inventario y totalSpent del cliente |
| Trade-ins  | CRUD real filtrado por storeId; write path hardened y historial migrado a TableEngine |

### Demo / pendiente

| Modulo        | Estado |
|---------------|--------|
| Dashboard     | No consulta SQL real; KPIs hardcodeados |
| Reports       | SQL real; widgets configurables, rango custom, charts dinamicos y export local |
| Notifications | Eventos persistidos por tienda; lectura individual por usuario y filtro de permisos |
| Settings      | UI presente; sin persistencia real por ahora |

---

## Issues conocidos

### Activos

- `AppContext.tsx` linea ~179: hay un `onSnapshot` a `tradeIns` en Firestore que corre siempre, incluso cuando el backend esta activo. Es redundante con el useEffect de `backendTradeInsEnabled`.
- Sales y clients aun tienen fallback silencioso a Firestore en sus write paths (a diferencia de inventory y trade-ins que ya fueron hardened).

### Resueltos

- Inventory: eliminado fallback fantasma a Firestore cuando el backend esta activo
- Trade-ins: hardened write path
- Trade-ins: historial migrado a TableEngine
- Formularios: ya no cierran el modal antes de esperar resultado async
- Timeout de fetch: 15 s en helpers HTTP
- `batteryHealth`: migrado a `string` para soportar rangos como `"83-85%"`
- Import XLSX: normalizacion de decimales (`0.84` -> `"84%"`)

---

## Roadmap

### Fase 0 - Fundaciones

- Stack real: Firebase Auth + Postgres + Railway backend

### Fase 1 - Sesion y bootstrap

- `/api/me`, onboarding real, retry automatico de sesion

### Fase 2 - Migracion de dominio

- Clients, Inventory, Sales, Trade-ins -> PostgreSQL
- Inventory: categorias, import, inline edit, bulk actions, paginacion
- Trade-ins: historial sobre TableEngine

### Fase 3 - Operacion y reporting

- [ ] Dashboard sobre SQL real
- [x] Reports sobre SQL real
- [ ] Audit logs centralizados
- [ ] Settings con persistencia

### Hardening pendiente

- [ ] Harden write path de Sales (eliminar fallback a Firestore)
- [ ] Harden write path de Clients (eliminar fallback a Firestore)
- [ ] Eliminar doble onSnapshot de tradeIns en AppContext
- [ ] Sincronizar avatarUrl del perfil desde backend

---

## Decisiones vigentes

- Firebase Auth se mantiene por pragmatismo (no migrar a Clerk todavia)
- PostgreSQL es la fuente de verdad del negocio
- Backend propio en Railway es obligatorio para logica sensible
- No dual-write como estrategia permanente
- En modulos migrados: sin fallback silencioso - falla con error visible
- El onboarding bloquea el core hasta tener Store + StoreMember

---

## Riesgos actuales

- Dashboard y Reports en demo pueden generar expectativas falsas en testers
- El origen historico de clients en Firestore estaba vacio (migracion no trajo datos)
- Si un modulo queda a medias en migracion, puede haber mezcla Firestore/Postgres

---

## Handoff para proximos agentes

1. Leer `CLAUDE.md` / `AGENTS.md` (onboarding del proyecto)
2. Leer este archivo para el estado vivo
3. Si tocas codigo, correr `npm run lint` (no build)
4. Actualizar este archivo al cerrar cada iteracion importante
