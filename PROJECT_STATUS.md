# iManager ? Project Status

Documento vivo de coordinaci?n. Se actualiza cuando cambia una decisi?n importante o se cierra un hito real.

## Estado actual

- Auditor?a A completada: ya sabemos qu? partes eran reales, qu? era demo y qu? necesitaba saneamiento para el primer tester.
- Backend real desplegado en Railway y respondiendo.
- Postgres conectado y con schema de Prisma aplicado.
- Firebase Auth funcionando para Google y email/password.
- Session bridge con `/api/me` resuelto.
- `clients`, `inventory`, `sales` y `trade-ins` ya est?n migrados como slices reales del backend.
- Se elimin? el fallback silencioso de inventario a Firestore cuando el backend est? configurado: ahora se escribe por backend o falla con error visible.
- Se implement? onboarding real de tienda/membres?a para usuarios nuevos sin contexto de negocio.

## Qu? ya est? listo

- Frontend principal.
- Backend `imanager-api` en `backend/`.
- Railway project: `efficient-magic`.
- Services activos:
  - `iManager` frontend
  - `backend` API
  - `Postgres`
- Auth bridge frontend ? backend.
- Bootstrap owner/store/membership para la cuenta real del proyecto.
- Script de bootstrap de owner.
- Script de migraci?n hist?rica de clients.
- Script y m?dulo backend de inventory.
- Script y m?dulo backend de sales.
- Script y m?dulo backend de trade-ins.
- Pantalla real de onboarding de tienda.

## Issues conocidos

### 1) Migraci?n hist?rica de `clients`

- El script existe.
- Se corrigi? el acceso al Firestore named database correcto.
- La ejecuci?n actual no encontr? documentos en el origen configurado; si aparece otro origen hist?rico, habr? que reimportar desde ah?.

### 2) Inventory

- Inventory ya est? migrado y la UI ya no debe caer silenciosamente a Firestore cuando el backend est? configurado.
- Si falla el write path real, ahora corresponde mostrar error visible en vez de ?xito fantasma.
- Falta seguir observando el comportamiento end-to-end con datos reales y revisando si queda alg?n borde en el formulario.

### 3) Sales y trade-ins

- Los slices backend ya existen y est?n conectados.
- Falta seguir validando los flujos con datos reales y confirmando que la experiencia del tester no mezcle estados demo con estados productivos.

### 4) UI de auth y sesi?n

- La UX de login ya qued? funcional.
- El onboarding de tienda resuelve la membres?a faltante para usuarios nuevos.
- Conviene mantener mensajes de error claros y separados por provider o estado de sesi?n.

### 5) Hardening funcional del core

- El header usa la identidad autenticada y la membres?a real cuando existen.
- La sesi?n de backend reintenta autom?ticamente mientras la app est? en estado intermedio.
- Los m?dulos migrados ya deber?an operar con datos reales, no con n?meros demo.
- Falta seguir revisando formularios secundarios y estados de borde antes de dar por cerrado el hardening.

## Roadmap por fases

### Fase 0 ? Fundaciones

- [x] Revisar arquitectura real del repo.
- [x] Actualizar README principal.
- [x] Levantar backend en Railway.
- [x] Conectar Postgres.
- [x] Configurar Firebase Auth.

### Fase 1 ? Sesi?n y bootstrap

- [x] Implementar `/api/me`.
- [x] Resolver `User` + `Store` + `StoreMember`.
- [x] Bootstrap owner para usuario real.
- [x] Implementar onboarding real de tienda/membres?a.

### Fase 2 ? Migraci?n de dominio

- [x] Migrar `clients` como slice backend.
- [x] Validar migraci?n hist?rica de `clients` en el Firestore named database actual.
- [x] Migrar `inventory`.
- [x] Migrar `sales`.
- [x] Migrar `trade-ins` como slice real.
- [x] Bloquear fallback silencioso de inventario a Firestore cuando backend est? activo.

### Fase 3 ? Operaci?n y reporting

- [ ] Rehacer dashboard y reportes sobre SQL real.
- [ ] Centralizar audit logs.
- [ ] Revisar settings e integraciones.

## Checklist accionable

- [ ] Reintentar `npm run migrate:clients` en `backend/` cuando haga falta reimportar desde otro origen hist?rico.
- [ ] Mantener actualizado `PROJECT_STATUS.md` despu?s de cada hito importante.
- [x] Seguir con hardening de formularios y listados secundarios en el core migrado.
- [x] Implementar onboarding real para usuarios sin tienda/membres?a.

## Riesgos actuales

- Mezcla hist?rica entre Firestore y Postgres si se migra un m?dulo a medias.
- Dependencia de IDs/usuarios reales de Firebase para bootstrap.
- Inventory y sales requieren consistencia transaccional, no solo CRUD.
- Reportes podr?an mostrar inconsistencias si se consultan fuentes mixtas.

## Decisiones ya tomadas

- Firebase Auth se mantiene por ahora.
- Postgres es la fuente principal del negocio.
- Backend propio en Railway es obligatorio para la l?gica sensible.
- No usar dual-write como estrategia permanente.
- Los m?dulos ya migrados no deben esconder fallas con fallback silencioso a Firestore.
- El usuario nuevo debe pasar por onboarding de tienda/membres?a antes de usar el core.

## Handoff para pr?ximos agentes

- Primero leer este archivo.
- Despu?s revisar `AGENTS.md` si vas a tocar migraciones o contexto operativo.
- Si una tarea toca auth o sesi?n, verificar primero el estado de `/api/me`.
- Si una tarea toca datos hist?ricos, revisar qu? fuente de verdad corresponde a cada m?dulo.

## Smoke test guiado del core

### Checklist priorizada

- [x] Login / sesi?n: Google y email/password levantan, `/api/me` resuelve contexto de app y el backend reintenta cuando queda intermedio.
- [x] Onboarding: usuarios sin tienda/membres?a pasan por onboarding real y crean `Store` + `StoreMember` OWNER.
- [x] Header de usuario: nombre, mail, rol y avatar salen de la identidad autenticada o de la sesi?n de app.
- [x] Clients: CRUD y listado revisados; la migraci?n hist?rica no encontr? documentos en el Firestore named actual.
- [x] Inventory: slice backend operativo; se elimin? el fallback fantasma para writes cuando backend est? activo.
- [x] Sales: transacciones y revert de stock/cliente revisados; falta seguir probando flujos de edici?n y borrado manual en UI.
- [x] Trade-ins: slice backend operativo; falta validaci?n manual completa en UI con datos reales.
- [ ] Notifications: siguen siendo preview/locales; no validar como funcionalidad productiva.
- [ ] Reports: siguen siendo demo; no usar para validar backend en tester.
- [ ] Settings: siguen mezclando preview y placeholders; validar solo como UI, no como negocio final.

### Hallazgos concretos

- El origen hist?rico de `clients` en el Firestore named actual est? vac?o, as? que no hay datos que importar desde ah?.
- El header ya no debe mostrar notificaciones fake si no hay datos reales.
- La sesi?n de backend puede quedar temporalmente en onboarding o error, por eso el reintento autom?tico sigue siendo importante.
- El perfil necesita sincronizar `avatarUrl` y refrescar metadatos del usuario desde backend para no depender solo del objeto de Firebase Auth.
- Los formularios de alta estaban cerrando antes de esperar el resultado async, lo que ocultaba errores y daba la sensaci?n de que "no funcionaba" el alta.
- Ventas y canjes ahora pueden crear un cliente inline dentro del mismo formulario, sin exigir un cliente precargado.
- Inventario, ventas y canjes ahora muestran errores de validaci?n y deshabilitan el submit mientras guardan, reduciendo submits inv?lidos o duplicados.
- El flujo de alta pod?a quedar colgado si un request backend nunca resolv?a porque no exist?a timeout de fetch; ahora hay timeout de 15s en los helpers HTTP.
- En m?dulos ya migrados, fallback silencioso a Firestore puede producir ?xito fantasma; inventario ya no debe usarlo cuando backend est? configurado.
- El onboarding de tienda resuelve el problema de usuarios autenticados sin membres?a, que antes romp?a el uso del core.

## Update 2026-04-02 ? Inventario / persistencia

- Se detect? un bug de consistencia en inventario: con backend configurado, un fallo o estado intermedio pod?a caer a Firestore y dar una falsa sensaci?n de guardado exitoso.
- Decisi?n tomada: para inventario, si el backend est? configurado, las altas/ediciones/bajas deben pasar por backend o fallar con error visible; Firestore queda solo para modo local sin backend configurado.
- Esto evita cierres de modal con 'guardado fantasma' que luego no aparece persistido en Postgres.

## Update 2026-04-02 ? Onboarding de tienda

- Se implement? una pantalla real de onboarding para usuarios que ya iniciaron sesi?n pero todav?a no tienen `Store` ni `StoreMember`.
- El backend expone un flujo para completar onboarding creando `Store` + `StoreMember` OWNER y devolviendo la nueva sesi?n de app.
- La app ahora bloquea el acceso al core hasta completar este paso, en vez de dejar que el usuario choque con errores de membres?a faltante.
- Este flujo es la forma correcta de materializar contexto de negocio para cuentas nuevas en iManager.

## Documentation convention for future agents
- Use `docs/agent-context/README.md` as the first entry point for new feature chats.
- Keep feature handoffs short and point back to `PROJECT_STATUS.md` and `ARCHITECTURE_DECISIONS_2026-04-02.md`.
- Avoid duplicating history in new feature docs; prefer pointers and a small map.
