# iManager - Project Status

Documento vivo. Se actualiza al cerrar cada iteracion importante.
**Ultima actualizacion: 2026-10-15**

## CI — Limpieza de cotizaciones al desmontar — 2026-10-15

- ExchangeProvider cancela las consultas activas e invalida respuestas pendientes al desmontarse, cambiar de configuración o iniciar otra actualización. Conserva la limpieza del intervalo y evita actualizar React después de destruir el entorno de prueba.
- Ambas fuentes reciben la señal de cancelación; las respuestas tardías no guardan caché. Ocho regresiones deterministas cubren desmontaje, cambio a manual, cambio de fuente y StrictMode; las ocho fallan con el código original.
- Validación: lint frontend/backend aprobado y tres ejecuciones completas consecutivas de frontend con 116 archivos y 756 tests aprobados en cada una, sin errores no manejados. Sin build ni push.

## Corrección de producción #307 / #369 — Caja opcional — 2026-10-15

- Ventas, cobros, cancelaciones y correcciones de precio no exigen caja abierta. Sin configuración compatible por moneda/medio no generan movimientos; con configuración sin apertura quedan persistidos sin caja ni sesión. Se prioriza la predeterminada entre cajas compatibles abiertas hoy.
- Las compensaciones van a una caja compatible abierta o quedan sin asignar, incluso si la caja original está archivada. No modifican movimientos originales, saldos cerrados ni conteos; conservan idempotencia e historial de anulación.
- Subir el precio pagado conserva el cargo por diferencia de #305 sin duplicar efectivo. Corregidos «1 equipo» en inventario, dashboard, vista previa de catálogo y auditoría. Prueba de caché de iPhone estabilizada evitando leer cuerpos de respuesta de un documento descartado al recargar.
- Prisma compatible: `registerId` opcional y moneda/medio opcionales, sin nuevas unicidades. `prisma db push` sobre una caja con movimiento y cierre previos conservó importes, relaciones y conteo, sin aceptar pérdida de datos. Sólo bases locales sintéticas.
- Validación final: lint/typecheck frontend/backend, 748 unitarios frontend, 388 unitarios backend, 192 integraciones y 73 E2E relevantes aprobados sin consumir reintentos. Incluye diez E2E nuevos desktop/iPhone y las regresiones de cuenta corriente / cancel-refund de #305. Incidencias transitorias de corridas previas documentadas.
- Documentación: `docs/cash-registers-307.md`; OpenSpec: `fix-cash-register-blocking`. Sin build ni push.

## Issue #307 — Caja diaria por moneda y medio — 2026-10-14

- Cajas ARS/USD y Efectivo/Transferencia independientes: fondo, ingresos/egresos categorizados, ajustes sin resultados, archivo y predeterminada. Cambiar dólar o moneda de tienda no convierte saldos; Convertir fondos guarda la cotización y ambas patas. Anulación compensatoria única e historial con filtros locales y paginación en PostgreSQL.
- Ventas/canjes, pagos mixtos, cuotas, señas y reparaciones impactan caja en la misma transacción. Aplicar señas no duplica cobros. Con cajas configuradas, una caja compatible sin abrir rechaza el cobro completo. Sin backfill histórico. Proveedores: egreso manual categorizado hasta contar con ese módulo.
- Conteo a ciegas por denominaciones o total bancario, nota por diferencia, aprobación/reconteo del dueño, intentos conservados y ajuste de arqueo vinculado a la sesión. Apertura del próximo día solo con cierre aprobado. Permiso «Ver saldo de cajas» separado del acceso para registrar y contar. Layout desktop e iPhone.
- Merge de main resuelto conservando Caja, onboarding y cuenta corriente. Prisma aditivo, SQL corregido y `prisma db push` verificado sobre datos previos sin aceptar pérdida ni agregar unicidades en tablas anteriores.
- Validación: lint/typecheck frontend/backend, 747 unitarios frontend, 380 unitarios backend, 181 integraciones y 23 E2E relevantes aprobados sin retries (incluyen 8 nuevos de Caja desktop/iPhone). Sin build ni push. Documentación: `docs/cash-registers-307.md`; capturas: `docs/pr-shots/issue-307-*.png`; OpenSpec: `daily-cash-registers`.

## Issue #344 — Onboarding y Primeros pasos — 2026-10-14

- Recorrido: nombre de tienda → invitación opcional → stock. Solo pregunta el nombre; USD y dólar blue automático quedan plegados. La etapa se guarda en PostgreSQL y se retoma al recargar. Las tiendas existentes conservan su acceso habitual. Ayuda puede volver a mostrar Primeros pasos en el Dashboard.
- Reutiliza el análisis de texto de #338. Si la respuesta llega completa, la pantalla muestra los equipos por tandas antes de la revisión y no se queda en «0 equipos». Las filas sin moneda no entran al total en dólares. Las dudas no bloquean y se guardan como «Para revisar». Un guardado parcial reintenta únicamente lo que falló. Excel, carga manual e invitaciones reutilizan los flujos actuales.
- Primeros pasos muestra solo pendientes. Stock, venta, empleado y catálogo salen de datos reales; el descarte y la instalación se guardan por membresía. La invitación se completa al incorporarse una persona, no al generar el enlace. Los datos de ejemplo también se ofrecen al cargar stock desde el Dashboard.
- Ayuda en Más y Cuenta, con la guía PWA existente y la opción de mostrar de nuevo Primeros pasos.
- Muestras con `sampleBatchId` asignado por servidor; creación/borrado transaccionales y confirmación que conserva equipos reales y otras tiendas. Prisma únicamente aditivo, comprobado con `prisma db push` sin aceptar pérdida de datos. Sin exportaciones de filas.
- Validación: TypeScript frontend/backend, 724 unitarios frontend, 348 unitarios backend, 153 integraciones PostgreSQL, 15 pruebas PWA/worker y builds frontend/backend. E2E general: 173 aprobados y 2 omisiones de plataforma, sin fallos ni retries; los 12 casos nuevos de desktop/iPhone pasan. Capturas en `docs/pr-shots/issue-344-*`. Se excluyen bundles y reportes generados del typecheck. Documentación: `docs/onboarding-344.md`; OpenSpec: `redesign-onboarding`.

## Issue #338 — Inventario desde texto y .txt — 2026-10-14

- Implementación local, sin commit ni push por pedido explícito. ImportModal agrega Excel / Pegar listado / Subir .txt sólo en inventario; comparte vista previa virtualizada desktop y tarjetas iPhone, dudas resaltadas, edición/exclusión por fila y descartes con motivo. Confirmar es la única operación que persiste.
- POST `/api/import/analyze-text`: Firebase/sesión y permisos, GPT 6 Luna vía Responses con schema estricto, Zod, un reintento de JSON inválido y errores visibles en español. Sólo texto aportado e instrucciones estáticas salen al proveedor. Catálogo compartido + modelos de la tienda se aplican localmente, sin enviar inventario ni datos financieros existentes.
- Límites: 100 KB UTF-8, 1000 líneas, 2000 equipos, bloques 40 líneas / 8000 caracteres, tres llamadas simultáneas, 30 s por llamada / 180 s total; un análisis activo y cinco cada 10 minutos por tienda y por instancia (no global entre réplicas). Sin cambios de Prisma ni exportaciones. Monedas por equipo, cantidades expandidas tras revisión, serie en customFields.serial y batería ausente N/A. Cambiar moneda de un IMEI existente respeta permisos sensibles; moneda legacy null usa la moneda de la tienda.
- Corpus de 57 listados sintéticos realistas y 84 filas esperadas, incluido un mixto de 24 líneas. No se suministraron listados privados reales. CI mockea el LLM; los fixtures live existentes quedan fuera de test:unit. `npm --prefix backend run eval:import` evalúa corpus y 500 líneas aparte y guarda precisión cruda/final, campos presentes, IMEIs/precios incorrectos, omisiones, latencia y costo.
- Validación: lint frontend/backend y build solicitado; 608 tests frontend, 312 unitarios backend y 123 integraciones PostgreSQL aprobados. Corridas finales limitan workers y aumentan timeouts por carga del entorno; integración limita el pool a cinco conexiones. E2E general: 148/149 en la corrida completa, el restante (indicador móvil tras resize) pasó en retry y quedó flaky. Los seis nuevos E2E pasan también en corrida aislada, incluido WebKit/iPhone. PWA: 47 aprobados / 36 omisiones, y el único fallo de actualización en iPhone pasó al repetirlo (48 aprobados efectivos). Las suites regeneraron capturas existentes en docs/pr-shots y dos PNG de issue89; no se revirtieron ni commitearon.
- Eval real con `gpt-6-luna` (2026-10-14): **APROBADO**. 58 importaciones sin errores, 584/584 filas (incluye 500 líneas), 100% en todos los campos, 0 IMEIs/precios inventados, 0 filas perdidas/extra; latencia media 4,5 s, costo total ≈ US$ 0,03. Reporte en `docs/evals/issue-338-import-llm.md`; configuración/uso en `docs/inventory-text-import.md`.
## Issue #350 — Chips de filtros y aviso offline — 2026-10-14

- El catálogo público ya no usa `<select>`. En desktop los filtros son chips con menú (modelo, capacidad, condición, batería y precio). En el teléfono quedan dentro del sheet «Filtrar lista»: chips de selección única, batería mínima con «Cualquiera» y precio desde/hasta. El botón dice «Filtros · N».
- El aviso «No hay conexión» de #347 sólo escuchaba `online` dentro del catálogo, así que en Más (y otras lecturas) el texto quedaba en el estado de React. Ahora una suscripción compartida avisa con `online`, al volver a primer plano y si `navigator.onLine` pasa de falso a verdadero; cada lectura reintenta y el aviso se va sin navegar. Un pago no se reenvía solo.
- «Cargá un WhatsApp válido…» abre el formulario de la tienda con el teléfono enfocado.
- Sin cambios de Prisma ni exportación de filas.
- Validación: lint frontend/backend, build, 665 tests frontend, 245 unitarios backend (20 fixtures externos omitidos), 123 integraciones, 148 E2E (1 omitido) y 57 PWA E2E (36 omisiones por plataforma). El E2E nuevo corta la red y comprueba que el aviso desaparece al reconectar, en la lista pública y en Más, sin cambiar de pantalla.

## Issue #347 — Ajustes del catálogo público — 2026-10-14

- El botón de WhatsApp de `/c/:slug` usa `wa.me` con el texto en UTF-8. Un teléfono argentino local pasa a `549` más 10 dígitos; un internacional explícito conserva su prefijo. Sin un número válido no hay botón, y Catálogo muestra el aviso con enlace a Configuración.
- «Disponibles» cuenta sólo equipos en estado disponible. El encabezado dice «precios en» la moneda del catálogo o la de la tienda. En el teléfono los modelos son chips; en desktop los filtros son pastillas y la lista queda en dos columnas. El aviso «No hay conexión» se limpia y reintenta con el evento `online`.
- Sin cambios de Prisma ni exportación de filas. La respuesta pública suma `store.currency` para el encabezado.

## Issue #341 — Catálogo público de tienda — 2026-10-14

- Diseño v2: sección Catálogo después de Inventario en desktop y primero en Más/Módulos móvil; Resumen/Equipos, selección individual/masiva, reglas de stock/reserva/batería, precio/moneda, enlace compartible, regeneración y desactivación. Inventario sólo incorpora la marca y cantidad efectiva «En catálogo».
- `/c/:slug` abre fuera de la sesión, sin login. Lista por modelo, sin fotos de equipos; filtros/búsqueda, logo/ubicación/horario opcionales y un único WhatsApp general flotante en móvil/desktop. Vista previa privada usa la misma API pública y conversión real.
- API anónima con proyección explícita: no costo, IMEI, serial, proveedor, customFields ni IDs internos. Precio/moneda omitidos al ocultar precios. Rate limit 60/min por IP e instancia, 429/Retry-After, no-store y sin exportaciones. Configuración y selección sólo OWNER, aisladas por tienda, atómicas y auditadas. Slugs con sufijo aleatorio, anterior revocado al regenerar.
- Prisma aditivo: visibilidad default false y StorePublicCatalog. Migración aplicada al schema anterior con equipo existente: importes/IMEI conservados, visibilidad apagada y Prisma diff sin diferencias. PostgreSQL local exclusivo `imanager_issue341_test`, `imanager_issue341_integration_test`, `imanager_issue341_migration_test`; sin operaciones sobre producción.
- SEO/OG en HTML del servidor SPA y PNG 1200×630 generado con nombre/modelos/cantidades públicos. Worker excluye /c/ y API pública. Página abierta revalida al foco y cada 15 segundos; no conserva filas ante revocación/error. Detalles y límites de operación en `docs/api/public-catalog.md`.
- Validación: lint frontend/backend y build solicitado aprobados; 653 tests frontend, 244 unitarios backend locales, 123 integraciones y 17 tests de servidor/worker/SEO. Suite backend completa: 20 fixtures live externos de importación fallan con Decisions/Responses, igual a los fallos previamente documentados; suite local aprobada excluyendo `**/*.live.test.ts`.
- E2E general: 144/145 aprobados en la corrida completa. La prueba restante medía el indicador móvil durante la transición al redimensionar 390→360; ahora espera la geometría estable. Repetición de patrones móvil/desktop y catálogo: 4/4 aprobados. PWA completo: 57 aprobados y 36 omisiones por plataforma, sin fallos; incluye OG antes de JavaScript, navegación pública anónima y revocación con worker real en desktop, iPhone/WebKit y Android.
- Capturas v2 reales: `docs/pr-shots/issue-341-{desktop,iphone}-{public,manage,rules}.png`. Reproducir con `ISSUE_341_SHOTS=docs/pr-shots npm run test:e2e -- e2e/public-catalog.spec.ts --workers=1`, con DB local y puertos libres. Cambios sin commit ni push por pedido explícito.

## Issue #342 — Errores de solicitudes en español — 2026-10-14

- `toUserMessage` centraliza los mensajes exactos de conexión, timeout y servidor. `fetchWithTimeout` distingue el vencimiento del timer y conserva nombres de error para los reintentos de invitaciones; el cliente HTTP conserva status y validaciones 4xx en español y oculta diagnósticos 5xx incluso con respuestas HTML.
- Diálogos, formularios, comisiones, toasts, importación, sesión y pantalla de error global usan la traducción compartida. El diálogo de eliminar canje permanece abierto ante un fallo y permite reintentar sin anunciar éxito.
- Validación: lint frontend/backend, build solicitado, 644 unitarios frontend y 143 E2E generales aprobados. PWA: 53 aprobados, 1 flaky de actualización iPhone aprobado en el reintento y 36 omisiones por plataforma. Los tres fallos iniciales de navegación iPhone pasaron al repetirlos; un timeout aislado de filtros de inventario pasó al repetir los unitarios con dos workers. Las seis regresiones PWA nuevas cubren offline real con service worker, 5xx y 4xx en desktop, iPhone y Android.
- Base local exclusiva `imanager_issue342_e2e_test`, API 3342 y frontend 4342; sin cambios de Prisma ni operaciones sobre producción. Cambios en el working tree, sin commit ni push, según el pedido explícito.

## Issue #334 — Ajustes de comisiones — 2026-10-14

- Causa raíz: `getCommissionPeriod` conservaba el crédito completo del snapshot anulado cuando existía `adjustmentPeriod`, sumándolo a ganado y pendiente hasta el siguiente mes. El detalle anulaba la línea individual pero los agregados, incluida la API de Reportes/CSV, seguían contando el crédito. DELETE ya conservaba el snapshot y su anulación previa, por lo que borrar físicamente Sale no retiraba ese crédito del cálculo.
- Las bajas aportan cero ganado/conteo inmediatamente. Pagos efectivos se asignan por orden de venta, persona y moneda de liquidación, sólo antes de la baja y hasta el monto del snapshot. El ajuste del siguiente mes contiene sólo lo pagado; reclasifica el débito del saldo anterior sin descontarlo dos veces. Borrar tras cancelar conserva fecha y período y marca DELETED. Anular un pago lo excluye también de asignaciones/ajustes.
- Reglas: `active` y `deletedAt`; activar/desactivar y borrado lógico sólo afectan nuevas aplicaciones. Pagos: `voidedAt`/`voidedBy`, registro histórico y endpoint idempotente. Guards OWNER/commissions y writeAudit en transacciones, independientes del permiso de acciones sensibles. Migración SQL aditiva probada sobre el schema previo con reglas y pagos existentes, importes conservados y Prisma diff sin diferencias.
- Desktop y móvil comparten acciones confirmadas en reglas/pagos, conservan errores de persistencia y bloquean doble envío. El selector incluye el próximo mes para revisar A descontar. Corregidos icono Reglas, venta/ventas y Propietario. La búsqueda de equipos sin Estado fallaba en `getOperationOptions` y en la validación al crear la venta; ambos aceptan Estado vacío conservando exclusiones de vendidos, reservados y archivados.
- Validación: lint frontend/backend, build solicitado, 580 tests frontend, 229 unitarios backend (20 fixtures externos de importación omitidos tras confirmar los fallos previamente documentados), 114 integraciones PostgreSQL y 14 pruebas de worker. PWA: 48 aprobados, 36 omisiones por plataforma/offline WebKit. Suite E2E general: 139 aprobados con un worker, sin retries ni fallos en la corrida final.
- Evidencia en `docs/pr-shots/issue-334-{mobile,desktop}-*.png`, reproducible con `npm run test:e2e -- e2e/commissions-qa.spec.ts e2e/commissions-qa-iphone.spec.ts --workers=1`. PostgreSQL local exclusivo `imanager_issue334_test`, `imanager_issue334_e2e_test` y `imanager_issue334_migration_test`; puertos 3334/4334 y PWA 4434. Exportación sólo en Reportes. Commit en `fix/comisiones-qa`, sin push, según el pedido específico; sin operaciones sobre producción.

## Issue #330 — Comisiones, parte 1: datos y API — 2026-10-13

- Migración aditiva: vendedor opcional (StoreMember, SetNull), registrador y cotización en Sale; reglas por equipo/persona y pagos parciales sin unique. CommissionAccrual congela la regla/cálculo y conserva bajas tras borrar físicamente la venta. Vendedor sin default en altas, edición e importación; blue vendedor actual o cotización explícita.
- Backend: períodos en zona horaria de tienda, tres bases (ganancia resta costo y valor tomado), comisión en moneda de venta, saldos separados ARS/USD, pagos cruzados a la cotización del pago y ajustes «A descontar» en el mes siguiente a la baja pagada. Auditoría en reglas, pagos y cambios de vendedor, incluida asignación masiva atómica.
- Comisiones por defecto solo Dueño. Socio/Empleado necesitan permiso explícito; mine filtra por el miembro de sesión y nunca devuelve costos/ganancia. Detalle financiero requiere Reportes también. Datos del reporte requieren ambos permisos. Endpoints y contratos en `docs/api/commissions.md`; cliente HTTP y tipos listos para las partes 2/3. Sin pantallas ni exportaciones.
- Validación: 556 tests frontend, 229 unitarios backend y 105 integraciones PostgreSQL; ambos typechecks/lint. Los 20 fixtures live opcionales de importación fallan con el servicio externo (igual que en #328); suite local ejecutada con `npm --prefix backend run test:unit -- --exclude '**/*.live.test.ts'`. Migración SQL aplicada al schema anterior con venta existente, importes conservados y campos nuevos null; Prisma diff sin diferencias. Bases locales exclusivas `imanager_issue330_test` y `imanager_issue330_migration_test`; sin build ni cambios en Railway.
- Commit en `feat/330-comisiones-backend`, sin push por pedido explícito. Partes 2/3 de interfaz y consumo en Reportes pendientes.

## Issue #328 — Eliminar ventas canceladas — 2026-10-12

- Causa: AppContext y DELETE volvían a cancelar cualquier venta integrada, aun si estaba cancelada; el servicio bloqueaba ventas vinculadas y la selección masiva excluía canceladas.
- Las ventas `CANCELADA` se borran con auditoría `sale.deleted`, sin restaurar stock ni recalcular cliente, canje o pagos. Las ventas activas conservan su comportamiento previo, permisos sensibles y aislamiento por tienda. Sin cambios de Prisma.
- Desktop y hoja móvil comparten confirmación de eliminación real. Seleccionar solo canceladas ofrece «Eliminar selección»; las activas mantienen «Cancelar ventas» y las selecciones mixtas indican que deben separarse.
- Validación: 552 unitarios frontend, 216 unitarios backend y 81 integraciones PostgreSQL aprobados; 20 fixtures externos de importación omitidos con la opción existente, después de fallar en la corrida con servicio externo. Ambos typechecks aprobados. Los dos E2E nuevos pasan en desktop e iPhone/WebKit; las cuatro regresiones existentes de selección y menú también pasan.
- Regresiones comprueban cancelar y eliminar ventas pendientes/cobradas, con/sin canje, pagos y devoluciones conservados, stock vendido nuevamente intacto, permisos, auditoría y persistencia tras recargar. PostgreSQL local exclusivo: `imanager_issue328_integration_test` y `imanager_issue328_test`.
- Seis capturas en `docs/pr-shots/issue-328-{desktop,mobile-iphone}-{delete,bulk,deleted}.png`. Regenerar con `ISSUE_328_SHOTS=docs/pr-shots npm run test:e2e -- e2e/delete-cancelled-sales.spec.ts --workers=1`, usando la DB de pruebas y puertos libres. Commit en la rama del issue, sin push, según el pedido específico.

## Issue #303 — Selección móvil explícita y retiro de exportaciones por tabla — 2026-10-12

- Restaurado `usePress` desde `bf8318a`, previo a PR #295: toque largo de 480 ms abre la hoja Editar/Eliminar sin seleccionar; movimiento de más de 8 px, scroll y cancelación abortan el gesto, y el clic posterior se suprime por 700 ms. Se conserva limpieza del timer al desmontar.
- Inventario, Ventas, Canjes y Clientes muestran «Seleccionar» sobre la lista móvil. Los checkboxes solo aparecen en modo selección; la hoja suma «Seleccionar varios» con esa fila seleccionada. Barra inferior con cantidad, acción destructiva confirmada y «Listo», incluso con cero seleccionados. Desktop conserva selección visible, rango con Shift y barra existente, sin exportar.
- Retirados CSV de selección, campos destinados a exportación y Lista de precios/copia de filas. Eliminados sus tests; CSV compartido y exportaciones de Reportes se conservan. No había endpoints de exportación de tablas en el backend actual. Permisos sensibles, aislamiento por tienda y auditoría se verifican con los tres tests de integración existentes, en PG local exclusivo `imanager_issue303_security_test`.
- `skipWaiting()` se solicita al comenzar `install`, independiente del precache. Test unitario mantiene precache pendiente; regresión de producción usa dos pestañas, recarga y actualización y comprueba la versión del worker que controla ambas mediante un mensaje disponible solo en el servidor de QA. No queda worker en espera en Chromium/WebKit.
- Se conservan padding de Canjes, layout de Clientes y nowrap en Ventas. Las regresiones verifican filas normales sobre el dock y checkboxes seleccionables sobre la barra móvil. Las capturas de tests de layout se guardan en `test-results` por defecto para conservar evidencia histórica.
- Evidencia revisada: `docs/pr-shots/issue-303-mobile-list.png`, `issue-303-mobile-longpress-sheet.png`, `issue-303-mobile-selection.png`, `issue-303-desktop.png`. Regenerar con `ISSUE_303_SHOTS=docs/pr-shots npm run test:e2e -- e2e/bulk-actions.spec.ts --workers=1` usando PG local y puertos libres.
- Validación final: lint frontend/backend, build solicitado, 548 unitarios frontend, 14 pruebas de worker, 132 E2E y 48 PWA E2E aprobados (36 omisiones por plataforma/offline WebKit), sin retries ni fallos en las corridas finales. También 212 unitarios backend (20 fixtures de IA en vivo omitidos sin API key) y tres integraciones de permisos/auditoría aprobados. E2E completo usa un worker, PG local exclusivo `imanager_issue303_final_test` y puertos 3304/4304; PWA de producción usa 4395. Commit en `feat/bulk-redo-303`, sin push, según el pedido específico.

## Issue #300/#299 — Correcciones de QA móvil — 2026-10-12

- El toast de actualización móvil se ubica arriba con `safe-area-inset-top`, dejando libres Registrar venta, Importar y las barras inferiores. Desktop conserva su ubicación. Los tests de producción comprueban recarga automática sin tocar Actualizar al cerrar y después de terminar un guardado; la respuesta POST se retiene más que el debounce para verificar que no interrumpe la persistencia.
- Más resuelve la visibilidad de Instalar app con un snapshot síncrono de instalación/media query. Las regresiones comprueban la tarjeta antes del primer paint, la posición estable del perfil y el tap inmediato. El callback de cierre de la guía es estable para conservar foco e inert ante cambios del instalador.
- La X y el backdrop de la guía consumen la secuencia pointerdown/pointerup y el clic posterior. La hoja cierra con un solo tap en Chromium/WebKit, conserva teclado, restaura foco y permite scroll propio; un gesto cancelado del backdrop no cierra.
- Android sin `beforeinstallprompt` muestra el banner oscuro a los 30 s elegibles en Dashboard. Al salir se desmonta también el contenedor de `AnimatePresence`: el test anterior recargaba antes de comprobar la ausencia y ocultaba la retención de la animación. Ahora verifica Inventario, Ventas, Reportes y Más sin recargar, además de descarte/standalone.
- Evidencia QA: `docs/pr-shots/issue-300-qa-{toast-mobile,mas,sheet-iphone,android-banner,desktop}.png`. Regenerar con `ISSUE_300_QA_SHOTS=docs/pr-shots PLAYWRIGHT_PWA_PORT=4393 npm run test:pwa:e2e -- --workers=1`. La prueba del POST diferido bloquea el worker solo en ese contexto para que WebKit entregue la petición al router de Playwright; los demás casos de actualización prueban el worker real y el bundle de producción.
- Validación final: `lint` frontend/backend, `build`, `test` (549 unitarios), `test:pwa` (13), `test:e2e` (132) y `test:pwa:e2e` (45 aprobados, 36 omisiones por plataforma/offline WebKit), sin fallos ni retries. E2E general usa exclusivamente PG local `imanager_issue300_qa_test` y puertos 3301/4301; PWA de producción usa 4393. Commit en `fix/install-help-qa-300`, sin push, según el pedido específico.

## Issue #300 — Ayuda para instalar la app — 2026-10-12

- Android sin `beforeinstallprompt`, incluido fuera de Chrome, recibe una tarjeta oscura al inicio del Dashboard después de los mismos 30 s elegibles. Conserva icono, menú amarillo, instrucciones, descarte persistente por plataforma y exclusión de standalone. El evento nativo tardío reemplaza la guía por «Instalar app».
- Más incorpora como primera tarjeta «Instalar app», amarilla y disponible incluso después del descarte automático. Comparte el consumo de un solo uso del prompt con el banner; sin prompt abre la hoja ilustrada. No agrega Comisiones ni módulos, y no modifica backend, Prisma o AppContext.
- Hoja «Instalá iManager» con tres beneficios, cuatro pasos por plataforma, «Tu celular» primero y la otra guía colapsada. Safari → Compartir → Agregar a inicio → Agregar para iPhone; Chrome → ⋮ → Instalar app/Agregar a pantalla principal → Instalar para Android. Foco contenido/restaurado, fondo inert, scroll propio y safe areas; entradas ocultas en standalone y después de `appinstalled`.
- Validación completada: lint frontend/backend, build solicitado, 545 unitarios frontend y 13 pruebas PWA/worker. Suite PWA de producción: 36 casos aprobados (27 omisiones por plataforma/limitación offline WebKit ya existente), sin fallos. Doce unitarios y siete escenarios de navegador nuevos, compartidos entre Vite y la PWA de producción.
- Suite E2E general final: 128 casos aprobados con un worker, sin utilizar retries. Todos los comandos solicitados (`lint`, `build`, `test`, `test:pwa`, `test:e2e`, `test:pwa:e2e`) completados. Commit en `feat/install-help-300`, sin push, según la instrucción específica del issue.
- El test existente de Clientes ahora espera el saldo actualizado antes de editar: esperar un toast oculto podía adelantarse al pago async y sobrescribir el saldo con el valor anterior. Pasó tres repeticiones consecutivas. Un timeout previo del toast en el detalle de venta pasó al repetir el caso sin modificar su lógica.
- Cinco capturas generadas e inspeccionadas en `docs/pr-shots/issue-300-{android-banner,mas,sheet-android,sheet-iphone,desktop}.png`: Android/Más 412×852, iPhone 393×852, desktop 1440×900. Regenerar con `ISSUE_300_SHOTS=docs/pr-shots npm run test:e2e -- e2e/install-help.spec.ts e2e/install-help-iphone.spec.ts --workers=1`. DB local exclusiva `imanager_issue300_test`; puertos 3300/4300 y PWA 4392, configurables sin tocar otros checkouts.

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
