# Auditoría de refactor — segunda pasada

Fecha: 2026-10-11. Rama base: `refactor-solid` (HEAD `f215766`, después de los PR #238–#243). No se toca `main`, Railway, la base de producción ni el schema de Prisma.

La primera pasada está en [`auditoria.md`](./auditoria.md) y [`resumen.md`](./resumen.md). Esta auditoría busca lo que quedó afuera.

## Cómo se midió

- **Uso en producción.** Un export cuenta como usado si lo referencia otro archivo que no sea test (`*.test.ts(x)`, `backend/src/test/**`). La primera pasada contó los tests como uso, por eso se le escaparon piezas que solo sostenían los tests.
- **Miembros de `AppContext`.** Para cada clave de `AppState` se buscó la palabra en los archivos que llaman a `useAppContext()`.
- **Duplicación.** `jscpd@4` (mínimo 6 líneas / 60 tokens, sin tests ni CSS): 68 clones, 902 líneas.
- **Dependencias.** `knip@5` con entradas `src/main.tsx`, `e2e/**`, `backend/src/server.ts` y `backend/scripts/*`, contrastado con `rg` a mano.

Punto de partida (`.ts`/`.tsx` en `src/` y `backend/src/`): **42.963 líneas, 294 archivos**. Línea base en verde: lint de los dos paquetes, Vitest frontend 389, backend unitario 145, integración 63 y Playwright 88.

## P0 — Código muerto que la primera pasada no vio

### `AppContext`: 31 miembros que nadie consume

Ningún componente lee estas claves de `useAppContext()`. Las usaban las páginas que se borraron en #239.

| Grupo | Claves |
| --- | --- |
| CRUD de categorías | `createCategory`, `renameCategory`, `deleteCategory`, `bulkMoveCategory`, `reorderCategories` y las mismas cinco para ventas (`*SaleCategory*`), canjes (`*TradeInCategory*`) y clientes (`*ClientCategory*`): 20 funciones |
| Estado que no se lee | `inventoryCategories`, `salesCategories`, `tradeInCategories` |
| Altas del flujo viejo | `addSale`, `addTradeIn`, `applyOperationResult`, `cancelSaleOperation` |
| Columnas custom | `addCustomColumn`, `removeCustomColumn` (`customColumns` sí se lee en Reportes) |
| Tiendas | `createOwnedStore`, `activateStore` |

Al sacarlos también quedan sin uso:

- `useStoreRecords` carga categorías de inventario, ventas y canjes que nadie lee. Las llamadas tragan el error (`.catch(() => [])`), así que sacarlas no cambia nada visible. `clientCategories` se queda: Reportes la usa.
- Clientes HTTP: `create/rename/delete/reorder/bulkMove*CategoryApi` en `inventory-api`, `sales-api`, `trade-ins-api` y `clients-api`, más `fetchCategories`, `fetchSalesCategoriesApi`, `fetchTradeInCategoriesApi`, `createBackendSale`, `createBackendTradeIn`, `fetchInventoryPage`, `fetchInventoryFilteredIds` (estos dos últimos solo los usaba su test), `stores-api.ts` entero y `cancelSaleOperation` del cliente de operaciones.

Los endpoints del backend se quedan. Son contrato de la API y tienen tests de integración; la regla de esta pasada es cero cambios de comportamiento.

### Exports sin ninguna referencia

`refreshBlueQuote`, `isExchangeSource`, `blueSourceLabel`, `quoteFromState`, `saveBlueSource` (`blue-rate.ts`), `formatDayMonth`, `isOpenTrade` (`format.ts`), `asMoneyCurrency` (`money.ts`), `useUnreadCount` (`AccountScreens.tsx`), `isNoticeSection` (`section-notices.ts`), `formatStoredDate` (`ar-date.ts`), `nonNegativeAmount` (`input-limits.ts`), `cn`, `formatCompactNumber`, `formatCurrency`, `getInitials` (`lib/utils.ts`), `isFirebaseBackedAuth` (`auth-adapter.ts`), `previewInvitation`, `InvitationStatus` (`invitations-api.ts`), `updateMemberRole`, `removeMember` (`members-api.ts`), `domainErrorBody` (backend). Se borran si tampoco tienen uso interno; si lo tienen, solo pierden el `export`.

### Dependencias que la primera pasada conservó por error

| Paquete | Evidencia |
| --- | --- |
| `recharts` | Cero imports en `src/`. Los gráficos de Reportes y Dashboard son SVG propios |
| `clsx`, `tailwind-merge` | Solo los importa `cn()` en `src/lib/utils.ts`, que no tiene ningún llamador |

`tailwindcss` y `@tailwindcss/vite` se quedan: Login, Onboarding, `App.tsx` e `ImportModal` usan clases de Tailwind.

### Archivos sueltos

- `old_inv.txt` y `old_inv2.txt` en la raíz: copias en UTF-16 de la página de inventario que se borró. No los lee nada.
- `.env.example` sigue documentando `GEMINI_API_KEY`, que ya no lee nadie desde que se sacó `@google/genai`.
- El alias `@` de `vite.config.ts` no lo usa ningún import.

## P1 — Duplicación con impacto

### Backend: el mapeo de errores de dominio sigue copiado en cada ruta

#240 hizo que `registerApiErrorHandler` responda cualquier `DomainError` con `{ error }` y su status. Pero las rutas siguen envolviendo los servicios en `try/catch` con `getSalesErrorStatus`, `getTradeInsErrorStatus`, `getClientsErrorStatus`, `getInventoryErrorStatus`, `getRepairErrorStatus`, `getReportsErrorStatus` y `getOperationErrorStatus`. Todas hacen lo mismo que el handler: `instanceof XError` y devolver `{ statusCode, message }`. Se borran las siete funciones y los `try/catch`; la respuesta es la misma.

`catalogs.routes.ts` se queda como está: convierte cualquier error en `{ error: message }` y un `ZodError` en "Revisá los nombres", que no es lo que hace el handler.

### Backend: chequeos de `appUser` inalcanzables

En `inventory`, `sales`, `trade-ins`, `clients` y `notifications`, cada handler repite `if (!request.appUser) return reply.code(403)...` aunque el `preHandler` `requireSectionAccess` ya respondió 403 en ese caso. Son ~50 líneas que no pueden ejecutarse. Un helper `sectionMember(request)` devuelve el miembro tipado.

### Backend: helpers de campos custom copiados

`toCustomFields`, `normalizeCustomFields` y `resolveDate` están iguales en `sales`, `trade-ins`, `clients` e `inventory`. Van a `backend/src/lib/custom-fields.ts`.

### Frontend: doce clientes HTTP con el mismo boilerplate

`getAuthHeaders`, `getDeleteHeaders`, `getBaseUrlOrThrow`, `parseJson` y el bloque `if (!response.ok) { body?.error || fallback }` están copiados en `inventory-api`, `sales-api`, `trade-ins-api`, `clients-api`, `operations-api`, `repairs-api`, `catalogs-api`, `settings-api`, `members-api`, `invitations-api` y `onboarding-api`. `authorizedJson` (#242) solo cubre los POST de importación.

Un único `apiRequest(user, path, options)` en `src/services/api-client.ts` arma la URL, el token y el `Content-Type` (solo si hay body, para que Fastify no rechace un DELETE vacío) y lanza `body.error` o el mensaje de respaldo. Cada servicio conserva sus mensajes y su forma de leer el error (`readApiErrorMessage` donde ya se usaba, `OperationRequestError` con status en operaciones). Los tests de cada servicio ya verifican URL, método y mensajes.

### Frontend: `DeskOverlays.tsx` (1.664 líneas)

La primera pasada lo dejó a propósito. Mezcla el switch de overlays con 15 formularios y detalles de cinco dominios. Se parte por dominio en `src/desk/overlays/` (equipo, operación, canje, cliente, cuenta/tienda, importación) sin tocar markup. En el corte salen también:

- `PAYMENTS`, `EQ_STATUS`, `CJ_STATUS` y las etiquetas de rol (`Propietario` / `Socio` / `Empleado`), hoy repetidas entre `DeskOverlays`, `AccountScreens` y `MemberPermissions`.
- El "compartir o copiar" (`navigator.share` con fallback a portapapeles) repetido en el comprobante de venta y en el link de invitación.
- `ImportHost` calcula `sheet={(kind === 'inv' || kind === 'sale' || kind === 'cj' || kind === 'cl') && phone}`: las cuatro opciones son todos los valores posibles, queda `sheet={phone}`.
- `SALE_STATUS` no lo usa nadie.

### Frontend: `RepairOrderDetail` copia la mitad de su JSX

Las ramas escritorio y celular repiten el bloque de presupuesto/seña, los botones sensibles y el diálogo de borrado (jscpd: 50 + 26 + 16 + 12 líneas). Las piezas ya existen como variables en la rama del celular; la rama de escritorio pasa a usarlas.

## P2 — Más chico o a evaluar

- **Encabezados de filtro de columna.** Inventario, Ventas, Canjes y Clientes repiten 27 veces `<th><span className="thf">Título<ColumnFilter open={openColumn === id} onToggle={() => setOpenColumn(...)} …>`. Un `FilterHeader` que reciba el id y el estado del menú abierto saca el toggle repetido.
- **CRUD de categorías del backend.** Cuatro copias casi iguales (inventario, ventas, canjes, clientes) sobre delegates distintos de Prisma. Unificarlas pide tipos genéricos sobre los delegates que hoy no simplifican; además el frontend ya no las llama. No se toca en esta pasada.
- **`ar-date` y `outgoing-difference`** están duplicados entre frontend y backend. Son paquetes separados sin código compartido; un paquete común es más infraestructura que ganancia (YAGNI).
- **Servicios grandes con Prisma directo** (`operations`, `inventory`, `sales`, `trade-ins`, `reports`). La primera pasada ya los evaluó. Sigue sin haber un caso que pida el repository: no se mueven transacciones.
- **`AppContext`** queda con sesión, operaciones y notificaciones después del recorte del P0. Partirlo más no achica nada una vez que se va el código muerto.

## Qué no se hace

- Borrar endpoints de la API, aunque el frontend ya no los llame.
- Cambios de schema Prisma, Railway, `main` o la base de producción.
- Fundir tabla y tarjeta de cada sección: las columnas no coinciden (igual que en la primera pasada).

## Orden de PRs (todos contra `refactor-solid`, squash-merge con `test` en verde)

1. Esta auditoría.
2. `AppContext`: sacar los 31 miembros muertos, las cargas de categorías que nadie lee y sus clientes HTTP.
3. Exports sin uso, `recharts`/`clsx`/`tailwind-merge`, `old_inv*.txt`, `GEMINI_API_KEY` y el alias `@`.
4. Frontend: `apiRequest` único para los servicios.
5. Backend: errores de dominio solo en el handler central, `sectionMember` y `custom-fields.ts`.
6. `DeskOverlays` partido por dominio, con las constantes y el compartir/copiar compartidos.
7. `RepairOrderDetail` sin JSX duplicado y `FilterHeader` para los filtros de columna.
8. `resumen.md` con la sección «Segunda pasada» y el recorrido e2e en 1440×900 y 390×844.
