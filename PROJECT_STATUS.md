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

## Issues conocidos

### 1) Migración histórica de `clients`

- El script existe.
- Se corrigió el acceso al Firestore named database correcto.
- La ejecución actual encontró el origen vacío; si aparece otro origen histórico, habrá que reimportar desde ahí.

### 2) Inventario

- Inventory ya fue migrado como slice backend.
- Sigue siendo un área sensible porque impacta stock, ventas y reportes.
- Falta recién observar el comportamiento en integración con ventas, que todavía no se migró.

### 3) Ventas y canjes todavía dependen de la fase de migración

- Las pantallas fueron saneadas para el tester.
- Falta mover lógica crítica al backend para evitar side effects duplicados.

### 4) UI de auth y sesión

- El login ya quedó funcional, pero la UX de errores fue un punto sensible.
- Conviene mantener mensajes de error claros y separados por provider.

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
- [ ] Migrar `sales`.
- [ ] Migrar `trade-ins`.

### Fase 3 — Operación y reporting

- [ ] Rehacer dashboard y reportes sobre SQL real.
- [ ] Centralizar audit logs.
- [ ] Revisar settings e integraciones.

## Checklist accionable

- [ ] Reintentar `npm run migrate:clients` en `backend/` cuando el deploy actual termine.
- [ ] Bootstrapping adicional si aparece otra cuenta o tienda.
- [ ] Definir el siguiente slice real después de inventory: `sales`.
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
