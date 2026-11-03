# Matriz de autorización — idor-devoluciones-resto

Inventario de `buildApp()` observado el 2026-11-03: **230 combinaciones verbo/ruta**, excluyendo HEAD/OPTIONS. Todos los endpoints protegidos devolvieron **401** sin credenciales en `security-route-auth.integration.test.ts`. No se encontraron rutas de negocio accidentalmente públicas.

**T** = storeId resuelto por `resolveAppUser` desde una membresía activa, nunca desde body/query. Los roles OWNER/MANAGER/STAFF se combinan con permisos de sección. **sensible** = OWNER, o grant explícito; por defecto MANAGER sí y STAFF no. #691 se conserva.

Cada GET incluye su HEAD automático con los mismos controles. Las tres rutas 2FA registradas con `all` incluyen además HEAD y OPTIONS; CORS puede contestar preflight OPTIONS sin exponer datos de negocio. Rutas con/sin barra final son alias.

La revisión profunda de servicios/repositorios y ataques multi-tenant cubre invitaciones, miembros, tiendas, onboarding, clientes, devoluciones/RMA/notas, reportes/dashboard, historial, notificaciones y billing. Las demás filas registran autenticación, permisos y propagación de T en rutas; sus servicios pertenecen a otras áreas de hardening. Esto no certifica la ausencia de toda vulnerabilidad.

| Verbo y ruta | Auth requerida | Rol/permiso | Filtro de tienda/identidad |
| --- | --- | --- | --- |
| `GET /api/catalog` | Firebase + membresía activa | publicCatalog | T |
| `PATCH /api/catalog` | Firebase + membresía activa | publicCatalog; cambiar active solo OWNER | T |
| `POST /api/catalog/regenerate` | Firebase + membresía activa | publicCatalog + OWNER | T |
| `PATCH /api/catalog/items` | Firebase + membresía activa | publicCatalog | T |
| `GET /api/public/catalog/:slug/preview.png` | pública | enlace opaco; catálogo activo + rate limit | slug → tienda; campos públicos |
| `GET /api/public/catalog/:slug` | pública | enlace opaco; catálogo activo + rate limit | slug → tienda; campos públicos |
| `GET /api/billing` | Firebase + membresía activa | OWNER | T + checkout validado por id/storeId |
| `POST /api/billing/quote` | Firebase + membresía activa | OWNER | T + checkout validado por id/storeId |
| `POST /api/billing/checkout` | Firebase + membresía activa | OWNER | T + checkout validado por id/storeId |
| `POST /api/billing/cancel` | Firebase + membresía activa | OWNER | T + checkout validado por id/storeId |
| `POST /api/billing/refresh` | Firebase + membresía activa | OWNER | T + checkout validado por id/storeId |
| `POST /webhooks/mercadopago` | firma MP | firma obligatoria | suscripción remota vinculada a checkout/tienda; sin storeId del navegador |
| `GET /api/section-views` | Firebase + membresía activa | secciones visibles; POST requiere :section | T + userId; IDs/versiones dentro de T |
| `POST /api/section-views/:section` | Firebase + membresía activa | secciones visibles; POST requiere :section | T + userId; IDs/versiones dentro de T |
| `GET /api/health` | pública | — | sin datos de negocio |
| `GET /api/me/admin` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `GET /api/me` | Firebase | cuenta (puede necesitar onboarding) | UID → User; membresías activas del usuario |
| `POST /api/events` | Firebase | cuenta; cuotas por usuario | eventos: userId/storeId de sesión; TAC global sin lectura de datos de tienda |
| `POST /api/imei-tac-misses` | Firebase | cuenta; cuotas por usuario | eventos: userId/storeId de sesión; TAC global sin lectura de datos de tienda |
| `GET /api/onboarding/progress` | Firebase + membresía activa | miembro; PATCH complete/stage solo OWNER | T; preferencias por T + userId |
| `PATCH /api/onboarding/progress` | Firebase + membresía activa | miembro; PATCH complete/stage solo OWNER | T; preferencias por T + userId |
| `POST /api/onboarding/samples` | Firebase + membresía activa | OWNER + inventory | T; preferencias por T + userId |
| `DELETE /api/onboarding/samples` | Firebase + membresía activa | OWNER/MANAGER + inventory | T; preferencias por T + userId |
| `POST /api/onboarding` | Firebase | cuenta; crea su propia tienda/OWNER o activa membresía propia | userId autenticado; sin acceso a tiendas ajenas |
| `GET /api/clients/:clientId/deposits` | Firebase + membresía activa | clients/sales/service | T + clientId; depósito validado por tienda/cliente |
| `POST /api/clients/:clientId/deposits` | Firebase + membresía activa | clients | T + clientId; depósito validado por tienda/cliente |
| `POST /api/clients/:clientId/deposits/:id/cancel` | Firebase + membresía activa | clients + sensible | T + clientId; depósito validado por tienda/cliente |
| `POST /api/clients/:clientId/deposits/:id/repair` | Firebase + membresía activa | service | T + clientId; depósito validado por tienda/cliente |
| `GET /api/cash` | Firebase + membresía activa | cash | T |
| `POST /api/cash` | Firebase + membresía activa | cash + OWNER | T |
| `PATCH /api/cash/:id` | Firebase + membresía activa | cash + OWNER | T |
| `POST /api/cash/:id/open` | Firebase + membresía activa | cash | T |
| `GET /api/cash/:id/movements` | Firebase + membresía activa | cash + cashBalances | T |
| `GET /api/cash/:id/sessions` | Firebase + membresía activa | cash + cashBalances | T |
| `POST /api/cash/movements` | Firebase + membresía activa | cash; AJUSTE solo OWNER | T |
| `POST /api/cash/transfers` | Firebase + membresía activa | cash | T |
| `POST /api/cash/movements/:id/void` | Firebase + membresía activa | cash + OWNER | T |
| `PATCH /api/cash/movements/:id/category` | Firebase + membresía activa | cash + OWNER | T |
| `POST /api/cash/sessions/:id/count` | Firebase + membresía activa | cash | T |
| `POST /api/cash/sessions/:id/review` | Firebase + membresía activa | cash + OWNER | T |
| `GET /api/accounts/debtors` | Firebase + membresía activa | clients o sales | T |
| `GET /api/accounts/follow-ups` | Firebase + membresía activa | clients o sales | T |
| `GET /api/accounts/follow-ups/settings` | Firebase + membresía activa | clients o sales | T |
| `PATCH /api/accounts/follow-ups/settings` | Firebase + membresía activa | clients o sales | T |
| `GET /api/accounts/sales/:saleId` | Firebase + membresía activa | clients o sales | T |
| `POST /api/accounts/clients/:clientId/movements` | Firebase + membresía activa | clients o sales | T |
| `POST /api/accounts/collections` | Firebase + membresía activa | clients o sales | T |
| `GET /api/clients` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `POST /api/clients` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `PATCH /api/clients/:id` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `GET /api/clients/:id/sales` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `GET /api/clients/:id/payments` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `POST /api/clients/:id/payments` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `POST /api/clients/import` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `DELETE /api/clients/:id` | Firebase + membresía activa | clients + sensible | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `POST /api/clients/:id/restore` | Firebase + membresía activa | clients + sensible | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `GET /api/clients/categories` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `POST /api/clients/categories` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `PATCH /api/clients/categories/reorder` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `PATCH /api/clients/categories/bulk-move` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `PATCH /api/clients/categories/:id` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `DELETE /api/clients/categories/:id` | Firebase + membresía activa | clients | T; cliente/categoría por id + T; historial/pagos por T + clientId |
| `GET /api/custom-field-definitions` | Firebase + membresía activa | inventory | T |
| `POST /api/custom-field-definitions` | Firebase + membresía activa | inventory | T |
| `PATCH /api/custom-field-definitions/:id` | Firebase + membresía activa | inventory | T |
| `DELETE /api/custom-field-definitions/:id` | Firebase + membresía activa | inventory | T |
| `GET /api/inventory` | Firebase + membresía activa | inventory | T |
| `GET /api/inventory/ids` | Firebase + membresía activa | inventory | T |
| `GET /api/inventory/:id` | Firebase + membresía activa | inventory | T |
| `POST /api/inventory` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `POST /api/inventory/batch` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `PATCH /api/inventory/:id` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `POST /api/inventory/import` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `DELETE /api/inventory/:id` | Firebase + membresía activa | inventory + sensible | T |
| `POST /api/inventory/:id/restore` | Firebase + membresía activa | inventory + sensible | T |
| `GET /api/inventory/categories` | Firebase + membresía activa | inventory | T |
| `POST /api/inventory/categories` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `PATCH /api/inventory/categories/reorder` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `PATCH /api/inventory/categories/:id` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `DELETE /api/inventory/categories/:id` | Firebase + membresía activa | inventory | T |
| `POST /api/inventory/bulk-move` | Firebase + membresía activa | inventory; mutaciones validan precio/costo | T |
| `GET /api/stock-counts` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `GET /api/stock-counts/preview` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `GET /api/stock-counts/current` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `POST /api/stock-counts` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `GET /api/stock-counts/:id` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `POST /api/stock-counts/:id/scans` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `POST /api/stock-counts/:id/close` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `POST /api/stock-counts/:id/resolve` | Firebase + membresía activa | inventory; iniciar/preview/cerrar/resolver OWNER/MANAGER; escaneo por participante | T |
| `GET /api/commissions` | Firebase + membresía activa | commissions | T |
| `GET /api/commissions/exchange-rate` | Firebase + membresía activa | miembro; mine usa su userId | T |
| `GET /api/commissions/sellers` | Firebase + membresía activa | miembro; mine usa su userId | T |
| `GET /api/commissions/mine` | Firebase + membresía activa | miembro; mine usa su userId | T |
| `GET /api/commissions/members/:id` | Firebase + membresía activa | commissions | T |
| `GET /api/commissions/rules` | Firebase + membresía activa | commissions | T |
| `POST /api/commissions/rules` | Firebase + membresía activa | commissions | T |
| `PATCH /api/commissions/rules/:id` | Firebase + membresía activa | commissions | T |
| `DELETE /api/commissions/rules/:id` | Firebase + membresía activa | commissions | T |
| `GET /api/commissions/payments` | Firebase + membresía activa | commissions | T |
| `POST /api/commissions/payments` | Firebase + membresía activa | commissions | T |
| `POST /api/commissions/payments/:id/void` | Firebase + membresía activa | commissions | T |
| `PATCH /api/commissions/sales/seller` | Firebase + membresía activa | commissions | T |
| `GET /api/reports/periodic-summary` | Firebase + membresía activa | reports; detalle sales/inventory según permisos | T en todos los agregados/lecturas; comparaciones también T |
| `GET /api/reports/commissions` | Firebase + membresía activa | reports + commissions | T en todos los agregados/lecturas; comparaciones también T |
| `GET /api/reports/overview` | Firebase + membresía activa | canSeeFinancials: OWNER, MANAGER con reports, STAFF (#691) | T en todos los agregados/lecturas; comparaciones también T |
| `GET /api/reports/net-profit` | Firebase + membresía activa | OWNER | T en todos los agregados/lecturas; comparaciones también T |
| `GET /api/suppliers` | Firebase + membresía activa | inventory | T |
| `GET /api/suppliers/:id` | Firebase + membresía activa | inventory | T |
| `GET /api/suppliers/:id/purchases` | Firebase + membresía activa | inventory | T |
| `GET /api/suppliers/:id/purchases/:purchaseId` | Firebase + membresía activa | inventory | T |
| `POST /api/suppliers` | Firebase + membresía activa | inventory | T |
| `PATCH /api/suppliers/:id` | Firebase + membresía activa | inventory | T |
| `DELETE /api/suppliers/:id` | Firebase + membresía activa | inventory | T |
| `POST /api/suppliers/:id/restore` | Firebase + membresía activa | inventory | T |
| `GET /api/expenses` | Firebase + membresía activa | OWNER | T |
| `POST /api/expenses` | Firebase + membresía activa | OWNER | T |
| `PATCH /api/expenses/:id` | Firebase + membresía activa | OWNER | T |
| `DELETE /api/expenses/:id` | Firebase + membresía activa | OWNER | T |
| `POST /api/expenses/:id/restore` | Firebase + membresía activa | OWNER | T |
| `GET /api/returns/eligible-sales` | Firebase + membresía activa | sales | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `GET /api/returns/patterns` | Firebase + membresía activa | sales | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `GET /api/returns/credit-notes` | Firebase + membresía activa | sales | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `GET /api/returns` | Firebase + membresía activa | sales | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `POST /api/returns` | Firebase + membresía activa | sales | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `PATCH /api/returns/:id` | Firebase + membresía activa | sales | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `POST /api/returns/:id/resolve` | Firebase + membresía activa | sales + sensible | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `POST /api/returns/:id/rma` | Firebase + membresía activa | sales + sensible | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `DELETE /api/returns/:id` | Firebase + membresía activa | sales + sensible | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `POST /api/returns/:id/restore` | Firebase + membresía activa | sales + sensible | T; claim/sale por id + T; notas por T y cliente; eventos ligados al claim |
| `POST /api/sales/:id/restore` | Firebase + membresía activa | sales + sensible | T |
| `POST /api/sales/import` | Firebase + membresía activa | sales | T |
| `GET /api/sales/categories` | Firebase + membresía activa | sales | T |
| `POST /api/sales/categories` | Firebase + membresía activa | sales | T |
| `PATCH /api/sales/categories/reorder` | Firebase + membresía activa | sales | T |
| `PATCH /api/sales/categories/bulk-move` | Firebase + membresía activa | sales | T |
| `PATCH /api/sales/categories/:id` | Firebase + membresía activa | sales | T |
| `DELETE /api/sales/categories/:id` | Firebase + membresía activa | sales | T |
| `GET /api/sales` | Firebase + membresía activa | sales | T |
| `POST /api/sales` | Firebase + membresía activa | sales | T |
| `PATCH /api/sales/:id` | Firebase + membresía activa | sales; cancelar exige sensible | T |
| `DELETE /api/sales/:id` | Firebase + membresía activa | sales + sensible | T |
| `POST /api/trade-ins/import` | Firebase + membresía activa | tradeins | T |
| `GET /api/trade-ins` | Firebase + membresía activa | tradeins | T |
| `POST /api/trade-ins` | Firebase + membresía activa | tradeins | T |
| `PATCH /api/trade-ins/:id` | Firebase + membresía activa | tradeins | T |
| `DELETE /api/trade-ins/:id` | Firebase + membresía activa | tradeins + sensible | T |
| `GET /api/trade-ins/categories` | Firebase + membresía activa | tradeins | T |
| `POST /api/trade-ins/categories` | Firebase + membresía activa | tradeins | T |
| `PATCH /api/trade-ins/categories/reorder` | Firebase + membresía activa | tradeins | T |
| `PATCH /api/trade-ins/categories/bulk-move` | Firebase + membresía activa | tradeins | T |
| `PATCH /api/trade-ins/categories/:id` | Firebase + membresía activa | tradeins | T |
| `DELETE /api/trade-ins/categories/:id` | Firebase + membresía activa | tradeins | T |
| `GET /api/stores` | Firebase | cuenta; crea su propia tienda/OWNER o activa membresía propia | userId autenticado; sin acceso a tiendas ajenas |
| `POST /api/stores` | Firebase | cuenta; crea su propia tienda/OWNER o activa membresía propia | userId autenticado; sin acceso a tiendas ajenas |
| `POST /api/stores/active` | Firebase | cuenta; crea su propia tienda/OWNER o activa membresía propia | userId autenticado; sin acceso a tiendas ajenas |
| `PATCH /api/stores/current` | Firebase + membresía activa | OWNER/MANAGER | T |
| `GET /api/stores/:storeId/members` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo STAFF ajenos; último OWNER protegido | storeId de URL == T; miembro buscado por id + T |
| `PATCH /api/stores/:storeId/members/:memberId` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo STAFF ajenos; último OWNER protegido | storeId de URL == T; miembro buscado por id + T |
| `PATCH /api/stores/:storeId/members/:memberId/sections` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo STAFF ajenos; último OWNER protegido | storeId de URL == T; miembro buscado por id + T |
| `DELETE /api/stores/:storeId/members/:memberId` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo STAFF ajenos; último OWNER protegido | storeId de URL == T; miembro buscado por id + T |
| `GET /api/stores/current/periodic-report` | Firebase + membresía activa | OWNER | T |
| `PUT /api/stores/current/periodic-report` | Firebase + membresía activa | OWNER | T |
| `POST /api/stores/current/periodic-report/test` | Firebase + membresía activa | OWNER | T |
| `PATCH /api/users/me` | Firebase | cuenta (puede necesitar onboarding) | UID → User; membresías activas del usuario |
| `GET /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `TRACE /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `DELETE /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `PATCH /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `PUT /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `POST /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `QUERY /api/security/2fa` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `GET /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `TRACE /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `DELETE /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `PATCH /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `PUT /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `POST /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `QUERY /api/security/2fa/send` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `GET /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `TRACE /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `DELETE /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `PATCH /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `PUT /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `POST /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `QUERY /api/security/2fa/verify` | Firebase | cualquier cuenta; siempre 410 tras auth | sin datos de negocio |
| `GET /api/invitations` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo enlaces STAFF | T; id + T al revocar; PENDING/vencimiento al listar |
| `POST /api/invitations` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo enlaces STAFF | T; id + T al revocar; PENDING/vencimiento al listar |
| `DELETE /api/invitations/:id` | Firebase + membresía activa | OWNER/MANAGER; MANAGER solo enlaces STAFF | T; id + T al revocar; PENDING/vencimiento al listar |
| `GET /api/invitations/preview/:token` | pública | enlace opaco de invitación | token → metadatos mínimos; sin email destinatario |
| `POST /api/invitations/accept` | Firebase | cuenta autenticada + enlace válido, no miembro activo | token → tienda; locks; rol/secciones del enlace vigente |
| `GET /api/catalogs` | Firebase + membresía activa | sección según kind; PUT además OWNER/MANAGER | T + opciones de secciones autorizadas |
| `PUT /api/catalogs/:kind` | Firebase + membresía activa | sección según kind; PUT además OWNER/MANAGER | T + opciones de secciones autorizadas |
| `GET /api/operations/:source/options` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `GET /api/operations/:source/drafts` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `POST /api/operations/:source` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `GET /api/operations/:source/sales/:id` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `GET /api/operations/:source/trades/:id` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `POST /api/operations/:source/trades/:id/confirm` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `PATCH /api/operations/:source/sales/:id` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `PATCH /api/operations/:source/trades/:id` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) | T pasado al servicio; fuente/ID validados en operación |
| `POST /api/operations/:source/trades/:id/cancel` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) + sensible | T pasado al servicio; fuente/ID validados en operación |
| `POST /api/operations/:source/sales/:id/cancel` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) + sensible | T pasado al servicio; fuente/ID validados en operación |
| `POST /api/operations/:source/trades/:id/void` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) + sensible | T pasado al servicio; fuente/ID validados en operación |
| `POST /api/operations/:source/sales/:id/void` | Firebase + membresía activa | sección :source (inventory/sales/tradeins/clients) + sensible | T pasado al servicio; fuente/ID validados en operación |
| `GET /api/notifications` | Firebase + membresía activa | notifications + secciones visibles | T + sección; lecturas por userId autenticado |
| `POST /api/notifications/read-all` | Firebase + membresía activa | notifications + secciones visibles | T + sección; lecturas por userId autenticado |
| `POST /api/notifications/:id/read` | Firebase + membresía activa | notifications + secciones visibles | T + sección; lecturas por userId autenticado |
| `GET /api/repairs` | Firebase + membresía activa | service | T |
| `GET /api/repairs/:id` | Firebase + membresía activa | service | T |
| `POST /api/repairs` | Firebase + membresía activa | service | T |
| `PATCH /api/repairs/:id` | Firebase + membresía activa | service; cambios sensibles controlados | T |
| `POST /api/repairs/:id/status` | Firebase + membresía activa | service | T |
| `DELETE /api/repairs/:id` | Firebase + membresía activa | service + sensible | T |
| `POST /api/repairs/:id/restore` | Firebase + membresía activa | service + sensible | T |
| `POST /api/import/analyze-text` | Firebase + membresía activa | inventory | T para moneda/modelos/revisión; análisis sin lecturas multi-tenant |
| `POST /api/import/analyze` | Firebase + membresía activa | sección del payload (inventory/sales/clients/tradeins) | T para moneda/modelos/revisión; análisis sin lecturas multi-tenant |
| `POST /api/import/apply` | Firebase + membresía activa | sección del payload (inventory/sales/clients/tradeins) | T para moneda/modelos/revisión; análisis sin lecturas multi-tenant |
| `GET /api/history` | Firebase + membresía activa | history | T en auditoría, historial de reparación y contexto de entidades; filtros no sustituyen T |
| `GET /api/history/actors` | Firebase + membresía activa | history | T en auditoría, historial de reparación y contexto de entidades; filtros no sustituyen T |
| `GET /admin/inventory-duplicates` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `POST /admin/inventory-duplicates/apply` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `POST /admin/inventory-duplicates/restore` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `POST /admin/inventory-import` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `POST /admin/sale-corrections` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `POST /admin/store-reset` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `GET /admin/imei-tac-misses` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `GET /admin/funnel` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `GET /admin/stores/:id/history` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `GET /admin/stores/:id/timeline` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
| `GET /admin/store-activity` | Firebase | admin de plataforma (email verificado + allowlist) | global explícito; ID de tienda autorizado por admin |
