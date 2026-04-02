# iManager — Project Status

Documento vivo de coordinación. Actualizar cada vez que se complete un paso relevante o cambie una decisión importante.

## Estado actual

- Auditoría **A** completada: se identificó qué es real, qué era mock y qué necesitaba saneamiento para el primer tester.
- Backend real desplegado en Railway y respondiendo.
- Postgres conectado y con schema de Prisma aplicado.
- Firebase Auth funcionando para Google y email/password.
- Bootstrap inicial de negocio completado para el usuario real del proyecto.
- Sesión de aplicación resuelta vía `/api/me`.
- Módulo `clients` ya migrado como slice real en backend; la migración histórica desde Firestore fue verificada contra la base named y hoy no encontró documentos.
- Módulo `inventory` ya migrado como slice real en backend y conectado al frontend con fallback controlado a Firestore.
- Módulo `sales` ya migrado como slice real transaccional en backend y conectado al frontend con fallback controlado a Firestore.
- Módulo `trade-ins` ya fue implementado como slice real en backend y conectado al frontend con fallback controlado a Firestore.
- Hardening funcional del core en curso: banner de backend con reintento automático, perfil de usuario dinámico y listados con vacíos/estadísticas reales.

## Qué ya está listo

- Frontend principal.
- Backend `imanager-api` en `backend/`.
- Railway project: `efficient-magic`.
- Services activos:
  - `iManager` frontend
  - `backend` API
  - `Postgres`
- Auth bridge frontend → backend.
- Bootstrap owner/store/membership para `matiscornia0@gmail.com`.
- Script de bootstrap de owner.
- Script de migración histórica de clients.
- Script y módulo backend de inventory.
- Script y módulo backend de sales.

## Issues conocidos

### 1) Migración histórica de `clients`

- El script existe.
- Se corrigió el acceso al Firestore named database correcto.
- La ejecución actual encontró el origen vacío; si aparece otro origen histórico, habrá que reimportar desde ahí.

### 2) Inventario

- Inventory ya fue migrado como slice backend.
- Sigue siendo un área sensible porque impacta stock, ventas y reportes.
- Falta recién observar el comportamiento en integración con ventas, que todavía no se migró.

### 3) Canjes

- El slice backend y el fallback frontend ya están implementados.
- Falta validar que Railway tome el cambio y que la tabla nueva quede aplicada en Postgres.

### 4) UI de auth y sesión

- El login ya quedó funcional, pero la UX de errores fue un punto sensible.
- Conviene mantener mensajes de error claros y separados por provider.

### 5) Hardening funcional del core

- El header ya no muestra datos hardcodeados de usuario; ahora usa la identidad autenticada y la membresía real cuando están disponibles.
- La sesión de backend reintenta automáticamente mientras la app está en un estado intermedio, para evitar quedar pegada en un banner por una falla transitoria.
- Clients y trade-ins ya muestran vacíos y métricas derivadas de datos reales, no números demo.
- Falta seguir revisando formularios secundarios y estados de borde antes de dar por cerrado el hardening.

## Roadmap por fases

### Fase 0 — Fundaciones

- [x] Revisar arquitectura real del repo.
- [x] Actualizar README principal.
- [x] Levantar backend en Railway.
- [x] Conectar Postgres.
- [x] Configurar Firebase Auth.

### Fase 1 — Sesión y bootstrap

- [x] Implementar `/api/me`.
- [x] Resolver `User` + `Store` + `StoreMember`.
- [x] Bootstrap owner para usuario real.

### Fase 2 — Migración de dominio

- [x] Migrar `clients` como slice backend.
- [x] Validar migración histórica de `clients` en el Firestore named database actual.
- [x] Migrar `inventory`.
- [x] Migrar `sales`.
- [x] Migrar `trade-ins` como slice real.

### Fase 3 — Operación y reporting

- [ ] Rehacer dashboard y reportes sobre SQL real.
- [ ] Centralizar audit logs.
- [ ] Revisar settings e integraciones.

## Checklist accionable

- [ ] Reintentar `npm run migrate:clients` en `backend/` cuando el deploy actual termine.
- [ ] Bootstrapping adicional si aparece otra cuenta o tienda.
- [x] Definir y aplicar el siguiente slice real después de inventory: `sales`.
- [ ] Seguir con hardening de formularios y listados secundarios en el core migrado.
- [ ] Mantener este archivo actualizado al cerrar cada hito.

## Riesgos actuales

- Mezcla histórica entre Firestore y Postgres si se migra un módulo a medias.
- Dependencia de IDs/usuarios reales de Firebase para bootstrap.
- Inventario y ventas requieren consistencia transaccional, no solo CRUD.
- Reportes podrían mostrar inconsistencias si se consultan fuentes mixtas.

## Decisiones ya tomadas

- Firebase Auth se mantiene por ahora.
- Postgres es la fuente principal del negocio.
- Backend propio en Railway es obligatorio para la lógica sensible.
- No usar dual-write como estrategia permanente.
- El dominio Firestore nombrado correcto del proyecto es el que usa el backend para scripts de migración.

## Handoff para próximos agentes

- Primero leer este archivo.
- Después revisar `backend/README.md` si vas a tocar migraciones o scripts.
- Si una tarea toca auth o sesión, verificar primero el estado de `/api/me`.
- Si una tarea toca datos históricos, revisar qué fuente de verdad corresponde a cada módulo.

## Smoke test guiado del core

### Checklist priorizada

- [x] Login / sesion: Google y email/password levantan, `/api/me` resuelve contexto de app y el backend reintenta cuando queda intermedio.
- [x] Header de usuario: nombre, mail, rol y avatar salen de la identidad autenticada o de la sesion de app; si faltan datos, se recuperan desde backend.
- [x] Clients: CRUD y listado revisados; la migracion historica no encontro documentos en el Firestore named actual.
- [x] Inventory: slice backend operativo; revisar en UI la edicion de custom fields y los estados de borde.
- [x] Sales: transacciones y revert de stock/cliente revisados; falta seguir probando flujos de edicion y borrado manual en UI.
- [x] Trade-ins: slice backend operativo; falta validacion manual completa en UI con datos reales.
- [ ] Notifications: siguen siendo preview/locales; no validar como funcionalidad productiva.
- [ ] Reports: siguen siendo demo; no usar para validar backend en tester.
- [ ] Settings: siguen mezclando preview y placeholders; validar solo como UI, no como negocio final.

### Hallazgos concretos

- El origen historico de `clients` en el Firestore named actual esta vacio, asi que no hay datos que importar desde ahi.
- El header tenia notificaciones fake y ahora se dejo sin datos reales para no engan~ar al tester.
- La sesion de backend puede quedar temporalmente en onboarding o error, por eso el reintento automatico sigue siendo importante.
- El perfil necesitaba sincronizar `avatarUrl` y refrescar metadatos del usuario desde backend para no depender solo del objeto de Firebase Auth.

