# iManager — Project Status

Documento vivo. Se actualiza al cerrar cada iteración importante.
**Última actualización: 2026-04-04**

---

## Estado actual

- Core estable con datos reales en Railway (Postgres + Firebase Auth)
- Inventory es el módulo más maduro: categorías, import XLSX, inline edit, bulk actions, paginación, sort
- Tests unitarios de frontend + CI con GitHub Actions agregados hoy
- Dashboard y Reports siguen siendo demo (Fase 3 pendiente)

---

## Módulos: estado detallado

### ✅ Producción

| Módulo     | Notas                                                                           |
|------------|---------------------------------------------------------------------------------|
| Auth       | Google + email/password, `/api/me`, retry automático cada 15s                   |
| Onboarding | Pantalla real para usuarios sin Store/StoreMember; crea contexto antes del core  |
| Inventory  | Categorías con tabs, inline edit (dbl-click), bulk select (shift+click), delete, import CSV/XLSX con mapeo de columnas, paginación (20/pág), sort, columnas custom |
| Clients    | CRUD real en backend                                                             |
| Sales      | Transaccional; muta status de inventario y totalSpent del cliente               |
| Trade-ins  | CRUD real filtrado por storeId; write path hardened (no fallback silencioso)     |

### ⏳ Demo / pendiente

| Módulo        | Estado                                           |
|---------------|--------------------------------------------------|
| Dashboard     | No consulta SQL real; KPIs hardcodeados          |
| Reports       | Placeholder; gráficos con datos falsos           |
| Notifications | Preview local, no persiste                       |
| Settings      | UI presente; sin persistencia real por ahora     |

---

## Issues conocidos

### Activos

- `AppContext.tsx` línea ~179: hay un `onSnapshot` a `tradeIns` en Firestore que corre siempre, incluso cuando el backend está activo. Es redundante con el useEffect de `backendTradeInsEnabled`.
- Sales y clients aún tienen fallback silencioso a Firestore en sus write paths (a diferencia de inventory y trade-ins que ya fueron hardened).

### Resueltos

- Inventory: eliminado fallback fantasma a Firestore cuando backend está activo ✅
- Trade-ins: hardened write path ✅
- Formularios: ya no cierran el modal antes de esperar resultado async ✅
- Timeout de fetch: 15s en helpers HTTP ✅
- `batteryHealth`: migrado a `string` para soportar rangos como "83-85%" ✅
- Import XLSX: normalización de decimales (0.84 → "84%") ✅

---

## Roadmap

### Fase 0 — Fundaciones ✅
- Stack real: Firebase Auth + Postgres + Railway backend

### Fase 1 — Sesión y bootstrap ✅
- `/api/me`, onboarding real, retry automático de sesión

### Fase 2 — Migración de dominio ✅
- Clients, Inventory, Sales, Trade-ins → PostgreSQL
- Inventory: categorías, import, inline edit, bulk actions, paginación

### Fase 3 — Operación y reporting ⏳
- [ ] Dashboard sobre SQL real
- [ ] Reports sobre SQL real
- [ ] Audit logs centralizados
- [ ] Settings con persistencia

### Hardening pendiente
- [ ] Harden write path de Sales (eliminar fallback a Firestore)
- [ ] Harden write path de Clients (eliminar fallback a Firestore)
- [ ] Eliminar doble onSnapshot de tradeIns en AppContext
- [ ] Sincronizar avatarUrl del perfil desde backend

---

## Decisiones vigentes

- Firebase Auth se mantiene por pragmatismo (no migrar a Clerk todavía)
- PostgreSQL es la fuente de verdad del negocio
- Backend propio en Railway es obligatorio para lógica sensible
- No dual-write como estrategia permanente
- En módulos migrados: sin fallback silencioso — falla con error visible
- El onboarding bloquea el core hasta tener Store + StoreMember

---

## Riesgos actuales

- Dashboard y Reports en demo pueden generar expectativas falsas en testers
- El origen histórico de clients en Firestore estaba vacío (migración no trajo datos)
- Si un módulo queda a medias en migración, puede haber mezcla Firestore/Postgres

---

## Handoff para próximos agentes

1. Leer `CLAUDE.md` / `AGENTS.md` (onboarding del proyecto)
2. Leer este archivo para el estado vivo
3. Si tocás código, correr `npm run lint` (no build)
4. Actualizar este archivo al cerrar cada iteración importante
