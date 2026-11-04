# CI verde: inventario de fallos y resolución

Base: `3660f310` (origin/test). Referencia main terminada: [41658593614](https://github.com/Matitisco/iManager/actions/runs/41658593614), `d86d81aa`. Main actual: [41683000107](https://github.com/Matitisco/iManager/actions/runs/41683000107), misma base `3660f310`, reproduce los 34 E2E y 5 PWA; backend verde. Referencia solicitada de test: [41683448536](https://github.com/Matitisco/iManager/actions/runs/41683448536). Intento previo: [diagnóstico de main-verde](qa-main-verde/diagnostico.md).

La referencia main contiene **34 instancias E2E**, más **5 PWA** y **4 backend**. Las variantes compartidas son casos separados, no se cuentan reintentos como fallos nuevos. El agregador `test` solo refleja esos jobs.

## Los 34 casos E2E

| # | Shard | Test | Causa y corrección |
|---|---|---|---|
| 1 | 4 | e2e/issue-375.spec.ts:239:3 › issue 375 ventas, garantía y ficha en escritorio › filtra por vendedor, ofrece garantía rápida y lista las compras del cliente | Desactualizado: venta anulada excluida del total activo; resumen 2 de 5, mismo importe y filtro. |
| 2 | 4 | e2e/list-sync.spec.ts:7:1 › a section change reflects an external archive, and another page follows a local archive | Desactualizado: archivados fuera de lista activa; comprobar sincronización y consulta de ambos archivados. |
| 3 | 4 | e2e/mobile-clients.spec.ts:98:3 › clients on a phone › lists, creates, filters, edits and collects a client inside the screen | Desactualizado: se retiró contador redundante vacío; conservar estado vacío y recorrido CRUD/cobro. |
| 4 | 4 | e2e/mobile-inventory.spec.ts:76:3 › inventory on a phone › shows cards, filters, empty state and sheets inside the screen | Desactualizado: se retiró contador redundante vacío; conservar estado vacío y recorrido/filtros. |
| 5 | 6 | e2e/operations.spec.ts:254:1 › Inventory and Client-origin drafts can be resumed from their own sections | Desactualizado: Vender está en menú contextual del equipo; usarlo y conservar ambos borradores y confirmaciones. |
| 6 | 1 | e2e/account-lines.spec.ts:27:5 › account lines desktop › keeps one credit, the manual balance, the sale debt and the installment | Desactualizado: el pago ya no es columna desktop; comprobar Pendiente en fila, Sin pago en ficha y deuda/cuotas. |
| 7 | 1 | e2e/bulk-actions.spec.ts:15:5 › bulk actions desktop › selects filtered rows across pages, confirms and persists deletion | Desactualizado: Todos excluye archivados; abrir Archivados y conservar paginación/persistencia. |
| 8 | 1 | e2e/bulk-actions.spec.ts:15:5 › bulk actions mobile-iphone › selects filtered rows across pages, confirms and persists deletion | Desactualizado: Todos excluye archivados; abrir Archivados y conservar paginación/persistencia. |
| 9 | 1 | e2e/delete-cancelled-trade-ins.spec.ts:22:5 › delete cancelled trade-ins desktop › deletes through the row menu and selection and stays gone after reload | Desactualizado: texto de confirmación actualizado; conservar cancelar/confirmar y persistencia. |
| 10 | 5 | e2e/mobile-trade-ins.spec.ts:158:3 › trade-ins on a phone › lists, creates, resumes, edits and cancels a trade-in inside the screen | Desactualizado: se retiró contador redundante vacío; conservar estado vacío y recorrido crear/retomar/editar/anular. |
| 11 | 5 | e2e/modal-actions-layout.spec.ts:185:5 › modal actions desktop-1440x900 › keeps other detail footers and permitted menu actions reachable | Desactualizado: equipo tiene Editar/Archivar directos; verificar sus acciones vigentes. Infra en 1536×640: el centro de la fila coincide con Cantidad (stopPropagation); pulsar celda del modelo para abrir la ficha. |
| 12 | 5 | e2e/modal-actions-layout.spec.ts:185:5 › modal actions desktop-1536x640 › keeps other detail footers and permitted menu actions reachable | Desactualizado: equipo tiene Editar/Archivar directos; verificar sus acciones vigentes. Infra en 1536×640: el centro de la fila coincide con Cantidad (stopPropagation); pulsar celda del modelo para abrir la ficha. |
| 13 | 5 | e2e/modal-actions-layout.spec.ts:185:5 › modal actions mobile-390x844 › keeps other detail footers and permitted menu actions reachable | Desactualizado: equipo tiene Editar/Archivar directos; verificar sus acciones vigentes. Infra en 1536×640: el centro de la fila coincide con Cantidad (stopPropagation); pulsar celda del modelo para abrir la ficha. |
| 14 | 5 | e2e/modal-actions-layout.spec.ts:185:5 › modal actions mobile-320x844 › keeps other detail footers and permitted menu actions reachable | Desactualizado: equipo tiene Editar/Archivar directos; verificar sus acciones vigentes. Infra en 1536×640: el centro de la fila coincide con Cantidad (stopPropagation); pulsar celda del modelo para abrir la ficha. |
| 15 | 5 | e2e/natan1-shots.spec.ts:8:1 › captures archive, history and void screens | Desactualizado: archivados fuera de lista activa; conservar historial, filtro y permisos. |
| 16 | 8 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · usd-in-ars | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 17 | 8 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · ars-in-usd | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 18 | 8 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · trade-deposit | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 19 | 8 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · pending | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 20 | 8 | e2e/install-help-cases.ts:105:7 › install help iphone › shows the first Más card, platform steps and a working alternate accordion | Desactualizado: perfil dentro de mgroup; comparar orden visual de tarjeta y perfil, mantener acordeón/instalación. |
| 21 | 2 | e2e/admin-store-history.spec.ts:5:3 › action history and filters at 1440px | Fixture/infra: mock fijado a :3194, fuera del backend configurado; usar PLAYWRIGHT_API_BASE_URL. |
| 22 | 2 | e2e/admin-store-history.spec.ts:5:3 › action history and filters at 390px | Fixture/infra: mock fijado a :3194, fuera del backend configurado; usar PLAYWRIGHT_API_BASE_URL. |
| 23 | 2 | e2e/archive-history.spec.ts:5:1 › archives a device, shows it in history and restores it | Desactualizado: archivados fuera de lista activa; comprobar ausencia, historial, filtro Archivados y restauración. |
| 24 | 3 | e2e/import-mapping.spec.ts:32:5 › desktop-1440 › importa el excel de ejemplo sin configurar columnas | Desactualizado: se conservan filas antes descartadas; fixture tiene 42 equipos (21/13/8); verificar respuesta y revisión completa. |
| 25 | 3 | e2e/import-mapping.spec.ts:32:5 › tablet-1024 › importa el excel de ejemplo sin configurar columnas | Desactualizado: se conservan filas antes descartadas; fixture tiene 42 equipos (21/13/8); verificar respuesta y revisión completa. |
| 26 | 3 | e2e/import-mapping.spec.ts:32:5 › phone-390 › importa el excel de ejemplo sin configurar columnas | Desactualizado: se conservan filas antes descartadas; fixture tiene 42 equipos (21/13/8); verificar respuesta y revisión completa. |
| 27 | 3 | e2e/import-text-cases.ts:25:3 › pega 24 líneas mixtas, revisa dudas, edita y confirma con persistencia real | Desactualizado: lotes sin IMEI se agrupan; 23 registros con 27 unidades. Conservar precios/monedas/IMEI/serial y persistencia. |
| 28 | 3 | e2e/install-help-cases.ts:105:7 › install help android › shows the first Más card, platform steps and a working alternate accordion | Desactualizado: perfil dentro de mgroup; comparar orden visual de tarjeta y perfil, mantener acordeón/instalación. |
| 29 | 7 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · usd-in-ars | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 30 | 7 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · ars-in-usd | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 31 | 7 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · trade-deposit | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 32 | 7 | e2e/edit-sale-seller.flow.ts:20:5 › seller edit persists and commissions refresh · pending | Desactualizado: no se permite Anular nuevamente una venta cancelada; comprobar ausencia, edición bloqueada y persistencia de vendedor/comisiones. |
| 33 | 7 | e2e/import-text-cases.ts:25:3 › pega 24 líneas mixtas, revisa dudas, edita y confirma con persistencia real | Desactualizado: lotes sin IMEI se agrupan; 23 registros con 27 unidades. Conservar precios/monedas/IMEI/serial y persistencia. |
| 34 | 7 | e2e/service-dollar.spec.ts:20:1 › the sidebar shows the blue dollar and a repair order moves from Recibido to Listo para retirar | Desactualizado: widget compacto sin metadatos; comprobar compra/venta y origen/hora en detalle. |

## PWA y backend

| Casos | Causa y corrección |
|---|---|
| install-help Android e iPhone (2) | Mismo perfil agrupado que E2E: verificar orden visual sin asumir hermanos DOM. |
| mobile update toast Android e iPhone (2) | Importar ventas está deshabilitado; conservar geometría y clic en Registrar venta bajo el aviso de actualización. |
| layout Android (1) | Verificar que Instalar app no tape Registrar venta y que abra el formulario. |
| qa-hunt-purchases import/manual × OWNER/STAFF (4) | Esperaban 204 al anular reclamo compensado; regla de #717 devuelve 409. Ya corregidos por #722 en esta base; se verifica sin modificar ni debilitar el guard. |

## Alcance y validación

Sin cambios en aplicación, permisos (incluido #691), límites de seguridad, Prisma, migraciones, retries, timeouts o sleeps. Sin cuarentenas nuevas: todas las regresiones se conservan. El smoke de PR y la selección de tests relacionados permanecen intactos. No requiere OK de Matias por comportamiento/datos.

PostgreSQL exclusivo `127.0.0.1:39791`, bases `imanager_ci_verde` e `imanager_ci_verde_integration`; API/web en puertos propios efímeros. Identidades/fixtures ficticios; sin producción. Máximo dos workers locales; suite completa solo en Actions.

Validación local: TypeScript frontend/backend; 32 integraciones de proveedores; 25 checks de assets/Basic Auth/headers; 5 casos PWA afectados en Android Chromium/iPhone WebKit. E2E ejecutados por tandas relacionadas, con evidencia en `/tmp/ci-verde-evidence/`. WebKit se habilitó con bibliotecas extraídas en un directorio exclusivo de la tarea, sin modificar la instalación compartida. La ejecución completa de referencia de test reproduce los mismos fallos E2E/PWA y aprueba backend completo. El resultado definitivo de la rama se registra en el PR antes del merge.

Seguimiento local: el caso móvil de borrar canjes estaba bloqueado por el caso desktop dentro de un grupo serial. Al desbloquearlo apareció una pulsación larga cancelada por scroll/layout. El test espera actionability (`click({ trial: true })`) antes del pointerdown; conserva la pulsación larga y las invariantes de stock, clientes, pagos y ventas. Tres repeticiones relacionadas verifican la estabilidad sin sleeps ni timeouts nuevos.

## CI completa y seguimiento de contención

La [CI completa 41686439973](https://github.com/Matitisco/iManager/actions/runs/41686439973) sobre `f8c4ccb8` terminó **success**: ocho shards E2E, tres PWA, ambos frontend, backend, lint y agregador `test`. Frontend: 2.690 pruebas. Backend: 1.161 unitarias + 1.004 integraciones. PWA: 57 aprobadas y 36 omisiones de plataforma existentes. No se agregaron omisiones.

El log verde expuso un flaky adicional, fuera de los 34: `delete-cancelled-sales`, variante mobile-iphone, recibió 409 al preparar una cancelación y pasó con el retry de CI ya existente. PostgreSQL registró conflictos de serialización en ese intervalo; se conservan aislamiento, guardas, 409 y política de reintentos del backend. La tanda local original de ventas/canjes anulados pasó 12/12; no reprodujo el 409. Como reducción de contención del fixture, las dos variantes de ventas se ejecutan secuencialmente en modo `default` (fallos independientes) y la página permanece en `about:blank` durante las mutaciones API, sin lecturas concurrentes de Dashboard/reportes. La aserción también informa el mensaje del 409. Sin retries nuevos, sleeps, omisiones ni cambios de aplicación. La nueva CI completa y el merge se registran en el [PR #735](https://github.com/Matitisco/iManager/pull/735).

[CI rápida inicial](https://github.com/Matitisco/iManager/actions/runs/41686443002): verde, camino de jobs de aproximadamente 3m20s sin contar cola de runners (E2E 2m24s, PWA 1m34s). La cola hizo mayor el tiempo calendario; no se amplió el trabajo del PR. Rebase inicial sobre `origin/test` sin cambios ni conflictos.

Verificación del seguimiento: tanda original con dos workers 12/12. Tanda con aislamiento: 9 aprobados y dos timeouts de transporte HTTP (sin 409), uno no ejecutado por el grupo serial existente de canjes. Repetición focalizada con un worker: 4/4 aprobados en 22,7s; TypeScript frontend/backend aprobado. No se aumentaron límites para absorber esa lentitud local.


## Login HTML del entorno test

En `test.imanager.com.ar`, el servidor estático usa las mismas `BASIC_AUTH_USER` y `BASIC_AUTH_PASS` del gate anterior. Sin ambas variables el gate queda deshabilitado; configurar solo una impide iniciar el servidor. No se agregan variables ni se modifica producción, que no tiene estas credenciales configuradas.

Sin autorización válida, una navegación GET que acepta HTML muestra el formulario español con estado **401**; `GET /__login` explícito devuelve **200**. No se envía `www-authenticate`, por lo que no aparece el diálogo nativo. API, assets, worker, versión y helpers reciben 401 plano; catálogos tampoco se sirven. El formulario funciona sin JavaScript y conserva la CSP del servidor. Las rutas `/__login` y `/__logout` quedan reservadas y nunca devuelven el SPA ni pasan al proxy Firebase; con el gate deshabilitado responden 404.

`POST /__login` acepta `application/x-www-form-urlencoded` hasta 8 KB. Credenciales correctas redirigen con 303 a `next`, limitado a rutas internas con una sola `/` inicial, sin barras inversas ni caracteres de control; destinos inválidos vuelven a `/`. El servidor escapa el HTML y no refleja las credenciales ingresadas. Los errores muestran «Usuario o contraseña incorrectos» con 401. Se mantiene el límite compartido de 30 rechazos por minuto por IP de socket (no se confía en `X-Forwarded-For`); los POST fallidos cuentan y luego reciben 429. Las credenciales válidas siguen entrando aunque otros usuarios de la misma IP agoten el límite.

El acceso exitoso entrega `imanager_test_session` por 30 días (`Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`), por lo que requiere HTTPS. El token contiene un vencimiento en milisegundos y una firma HMAC-SHA256, con clave derivada de ambas credenciales. Se verifican firma y vencimiento; cambiar usuario o contraseña invalida las cookies anteriores. `GET /__logout` borra la cookie y redirige a `/__login`. Todas las respuestas de login, errores del gate y redirecciones llevan `Cache-Control: no-store`. Este acceso es independiente del login Firebase de la aplicación.

CI y scripts conservan `Authorization: Basic` válido sin necesitar cookie. Regresiones locales: `node --test scripts/basic-auth.test.mjs` y `node --test scripts/http-security.test.mjs scripts/pwa.test.mjs`: **42 pruebas aprobadas**; sin build, instalación de dependencias ni suite completa.
