# iManager - Project Status

Documento vivo. Se actualiza al cerrar cada iteracion importante.
**Ultima actualizacion: 2026-04-20**

---

## Estado actual

- Core estable con datos reales en Railway (Postgres + Firebase Auth)
- Inventory es el modulo mas maduro: categorias, import XLSX, inline edit, bulk actions, paginacion, sort
- Trade-ins ya usa TableEngine para el historial, alineado con Inventory, Clients y Sales
- Tests unitarios de frontend + CI con GitHub Actions agregados hoy
- Dashboard sigue siendo demo (Fase 3 pendiente)
- Reports ahora consume SQL real con widgets configurables, rango custom y export local de lo visible
- Frontend y backend ya tienen contrato explicito para separar desarrollo y produccion sin tocar la app estable en `main`

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
| Notifications | Preview local, no persiste |
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
- Frontend Firebase web config movido a variables `VITE_*`
- Backend carga `backend/.env` en desarrollo y exige `FRONTEND_URL`
- Estrategia operativa definida: `main` para produccion, `dev` para desarrollo

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
- Mientras Firebase siga compartido, las cuentas de desarrollo y produccion no deben mezclarse

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
