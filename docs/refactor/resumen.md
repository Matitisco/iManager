# Resumen del refactor SOLID

Fecha: 2026-10-11. Base: `refactor-solid` en `273660f`. Nada se mergeó a `main`. No hubo cambios de schema Prisma ni contacto con Railway o la base de producción.

La auditoría está en [`auditoria.md`](./auditoria.md). Cada paso es un PR draft apilado contra `refactor-solid`.

## Qué se borró

La app autenticada entra por `DeskApp`. Las pantallas anteriores a Desk, su layout y el motor de tablas no tenían imports desde `src/main.tsx`.

- Páginas `src/pages/{Inventory,Sales,Clients,TradeIns,Dashboard,Reports,Settings,Notifications}.tsx` y sus helpers.
- `Layout`, `Header`, `Sidebar`, `Modal`, `ConfirmModal`, `StoreSwitcher`, `TagField`, `ImportInventoryModal` y `src/components/forms/*`.
- `src/components/table-engine/**`, salvo el modal de importación, que se movió a `src/components/ImportModal.tsx` porque Inventario, Ventas, Clientes y Canjes lo siguen usando.
- Clientes HTTP que solo alimentaban esas páginas (`*-table-api.ts`, `reports-api.ts`) y los tests que solo las cubrían.

Dependencias sin ningún import:

| Paquete | Dónde |
| --- | --- |
| `@google/genai` | frontend |
| `better-sqlite3` | frontend |
| `autoprefixer` | frontend dev |
| `msw` | frontend dev |
| `nodemailer`, `@types/nodemailer` | backend |

`/api/reports` se dejó: el módulo tiene tests de contrato aunque Desk arme los reportes en el cliente.

## Qué se cambió

Sin cambio de comportamiento. Las respuestas HTTP, el markup visible y la firma de `useAppContext()` siguen igual.

1. **Errores de dominio.** `DomainError` (`backend/src/lib/domain-error.ts`) lo atrapa `registerApiErrorHandler` y responde `{ error: string }` con el status del error. Los servicios dejan de traducir el status en cada ruta.
2. **Repository.** `clients.repository.ts` y `notifications.repository.ts` concentran las queries de Prisma. El service conserva la regla. El resto de los módulos sigue consultando Prisma desde el service: extraerlos todos no achicaba la regla y sí movía transacciones grandes (`operations`, `inventory`, `sales`, `trade-ins`, `reports`).
3. **AppContext.** La carga y la suscripción de productos, ventas, canjes, clientes, reparaciones, columnas y categorías salió a `useStoreRecords` (`src/context/store-records.ts`). El provider sigue exponiendo la misma API.
4. **Escritorio y celular.** `PendingDrafts` es la tarjeta de canjes pendientes en inventario, ventas, clientes y canjes. En el teléfono usa la variante `compact`. La tabla y la card de cada sección no se fundieron: las columnas no coinciden.
5. **Strategy.** `QUOTE_PARSERS` en `src/desk/blue-rate.ts` elige el parser de DolarApi o Bluelytics. El cache y el refresh no cambian. `authorizedJson` es el POST autenticado de los cuatro importadores; el mapeo de columnas sigue en `ImportModal`.
6. **Adapter.** No se agregó un archivo nuevo para `fetchJson`: ya vive en `blue-rate.ts` y un wrapper no saca llamadas de otro lado. Firebase Auth sigue detrás de `auth-adapter.ts`. Firebase Admin ya es un módulo único.

## Métricas

Conteo de `.ts` y `.tsx` en `src/` y `backend/src/`, sin `node_modules`.

| | Antes (`273660f`) | Después |
| --- | ---: | ---: |
| Líneas | 58.479 | 42.963 |
| Archivos | 365 | 294 |

`git diff 273660f..536047f` (auditoría más los cuatro refactors, sin este documento ni el recorrido e2e): **117 archivos, +986 / −17.401**, **77 archivos borrados**.

`AppContext.tsx` pasó de 1.349 a 1.082 líneas. `store-records.ts` suma 317. El provider quedó más chico; el total del estado de tienda es parecido porque la lógica se movió, no se reescribió.

## Flujos

Lint de TypeScript en frontend y backend: en verde.

| Suite | Resultado |
| --- | --- |
| Vitest frontend | 73 archivos, 389 tests |
| Vitest backend unitario | 33 archivos, 145 tests |
| Vitest backend integración | 15 archivos, 63 tests |
| Playwright | 88 tests, incluidos los dos de recorrido |

El recorrido `e2e/refactor-walkthrough.spec.ts` cubre login, onboarding, inventario (filtro e importación), venta con equipo no registrado y canje, canjes, clientes, servicio técnico, reportes, configuración (moneda y dólar), invitación, links y permisos de un empleado. Corre en **1440×900** y **390×844**.

En el escritorio la orden de servicio se arrastra de Recibido a En reparación. En el celular el tablero no es arrastrable: el mismo cambio se hace con **Pasar a En reparación**.

Las capturas quedaron en `/opt/cursor/artifacts/refactor-e2e/` (`desktop-1440-*.png` y `phone-390-*.png`, 42 archivos).

## Riesgos

- Los PR están en draft y apilados. Mergear uno del medio sin los anteriores no aplica.
- Clientes y notificaciones tienen repository. Operaciones, inventario, ventas, canjes y reportes siguen con Prisma en el service. Partirlos es mecánico y no cambia la API; no se hizo para no mover transacciones sin un ganancia clara.
- `DeskOverlays.tsx` sigue concentrando los formularios de venta y de equipo. Sacarlo es el siguiente corte si hace falta, con los mismos tests de operaciones.
- `AppContext` todavía arma la sesión, las operaciones y las notificaciones. El corte de este pase es la carga de registros.
- No hay migración de Prisma. Un deploy de este stack no toca el schema.
