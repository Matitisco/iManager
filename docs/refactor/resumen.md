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

---

## Segunda pasada

Base: `refactor-solid` en `f215766` (fin de la primera pasada). Código medido en `38bff78`, último refactor mergeado. Nada se mergeó a `main`. Sin cambios de schema Prisma, sin Railway, sin base de producción. La auditoría está en [`auditoria-2.md`](./auditoria-2.md).

Cada paso fue un PR contra `refactor-solid`, mergeado con squash y con `test` en verde.

| PR | Qué |
| --- | --- |
| [#244](https://github.com/Matitisco/iManager/pull/244) | Auditoría de la segunda pasada |
| [#245](https://github.com/Matitisco/iManager/pull/245) | `AppContext` sin sus 31 miembros muertos, sin las cargas de categorías que nadie leía y sin sus clientes HTTP |
| [#246](https://github.com/Matitisco/iManager/pull/246) | Exports sin uso, `recharts`, `clsx`, `tailwind-merge`, `old_inv*.txt`, `GEMINI_API_KEY` y el alias `@` |
| [#247](https://github.com/Matitisco/iManager/pull/247) | Backend: el handler central mapea los errores de dominio, `requireMember` y `custom-fields.ts` |
| [#248](https://github.com/Matitisco/iManager/pull/248) | Frontend: todos los servicios pasan por `apiRequest` |
| [#249](https://github.com/Matitisco/iManager/pull/249) | `RepairOrderDetail` comparte el presupuesto, los botones sensibles y el borrado entre escritorio y celular |
| [#250](https://github.com/Matitisco/iManager/pull/250) | `DeskOverlays` partido por dominio y etiquetas de rol compartidas |
| [#251](https://github.com/Matitisco/iManager/pull/251) | Menú, input de monto y rangos compartidos en los filtros de columna |

### Qué se borró

- **`AppContext`.** 31 claves que ningún componente leía: el CRUD de categorías de inventario, ventas, canjes y clientes (20 funciones), `inventoryCategories`, `salesCategories`, `tradeInCategories`, `addSale`, `addTradeIn`, `applyOperationResult`, `cancelSaleOperation`, `addCustomColumn`, `removeCustomColumn`, `createOwnedStore` y `activateStore`. `useStoreRecords` deja de pedir las categorías que nadie mostraba. `AppContext.tsx` pasó de 1.082 a 721 líneas.
- **Clientes HTTP.** `stores-api.ts` entero, los `*CategoryApi`, `createBackendSale`, `createBackendTradeIn`, `fetchInventoryPage` y `fetchInventoryFilteredIds`. Los endpoints del backend se quedan: son contrato y tienen tests de integración.
- **Exports sin referencias.** 22, entre ellos las funciones viejas de varias fuentes de `blue-rate.ts`, `cn` y los helpers de `lib/utils.ts`, `previewInvitation`, `updateMemberRole`, `removeMember` y `domainErrorBody`.
- **Dependencias.** `recharts`, `clsx` y `tailwind-merge`. La primera pasada las conservó porque contó los tests como uso.
- **Backend.** Las siete funciones `get*ErrorStatus` y los `try/catch` que las usaban en cada ruta: el handler central ya respondía igual. Los `if (!request.appUser)` que el `preHandler` hacía inalcanzables pasan a `requireMember(request)`.
- **Sueltos.** `old_inv.txt`, `old_inv2.txt`, `GEMINI_API_KEY` en `.env.example`, el alias `@` de Vite y `SALE_STATUS`.

### Qué se cambió

Sin cambio de comportamiento: mismas respuestas HTTP, mismo markup, mismos textos.

1. **`apiRequest`** (`src/services/api-client.ts`). Arma la URL, el token, el timeout y el `Content-Type` solo cuando hay body. Lanza `ApiError` con el status. Once servicios copiaban `getAuthHeaders`, `getBaseUrlOrThrow` y el manejo de `!response.ok`. Cada uno conserva sus mensajes: `errorFrom` elige entre el `error` del backend, el mensaje amigable de `readApiErrorMessage` o solo el de respaldo. Los cuatro importadores quedaron en `import-api.ts`.
2. **`DeskOverlays.tsx`** pasó de 1.664 a 124 líneas. Solo decide qué overlay abrir. Los formularios y detalles están en `src/desk/overlays/` por dominio: `equipment`, `operation`, `trade`, `client`, `account`, `import` y `shared` (constantes de pago y estados, `ConfirmOperationDialog`, `AuditLine` y `shareOrCopy`, que antes estaba escrito dos veces).
3. **Roles.** `ROLE_LABEL` en `src/lib/roles.ts` reemplaza cinco copias de Propietario / Socio / Empleado.
4. **Filtros de columna.** `useColumnMenu` reemplaza 27 toggles escritos a mano. `MoneyFilterInput` reemplaza 22 copias del input de monto (tabla y hojas de filtros del celular). `MoneyRange` y `DateRange` son los pares Mínimo/Máximo y Desde/Hasta. La auditoría proponía un `FilterHeader` que envolviera el `<th>`. No se hizo: en Inventario los encabezados de Color y Calidad tienen el botón de ordenar adentro, y un wrapper tenía que aceptar esas variantes sin sacar más código que el hook.
5. **`RepairOrderDetail`.** Las ramas escritorio y celular usan los mismos bloques de presupuesto/seña, botones sensibles y diálogo de borrado.
6. **Backend.** `normalizeCustomFields` vive en `backend/src/lib/custom-fields.ts` y `parseArDateOr` en `ar-date.ts`. Antes estaban copiados en ventas, canjes, clientes e inventario.

### Qué no se hizo

- **CRUD de categorías del backend.** Son cuatro copias sobre delegates distintos de Prisma. Unificarlas pide genéricos que no simplifican, y el frontend ya no las llama.
- **`ar-date` y `outgoing-difference` compartidos entre frontend y backend.** Son paquetes separados. Un paquete común es más infraestructura que ganancia.
- **Repository para `operations`, `inventory`, `sales`, `trade-ins` y `reports`.** Sigue sin haber un caso que lo pida, y moverlo toca transacciones.

### Métricas

Archivos `.ts` y `.tsx` en `src/` y `backend/src/`.

| | `f215766` | `38bff78` |
| --- | ---: | ---: |
| Líneas | 42.963 | 41.024 |
| Líneas sin tests | 27.391 | 25.646 |
| Archivos | 294 | 299 |
| Duplicación (jscpd, 6 líneas / 60 tokens, sin tests) | 68 clones, 902 líneas (3,14 %) | 34 clones, 393 líneas (1,27 %) |
| Dependencias frontend (prod / dev) | 11 / 14 | 8 / 14 |
| Dependencias backend (prod / dev) | 6 / 6 | 6 / 6 |

`git diff f215766..38bff78 -- src backend/src`: **95 archivos, +2.565 / −4.504**.

Hay cinco archivos más porque `DeskOverlays` se partió en siete y se sumaron `api-client.ts`, `roles.ts`, `custom-fields.ts` y sus tests. Se borraron `stores-api.ts`, `authorized-json.ts` y los cuatro importadores con sus tests.

### Flujos

Corridos sobre `38bff78`. Lint de TypeScript en frontend y backend en verde.

| Suite | `f215766` | `38bff78` |
| --- | --- | --- |
| Vitest frontend | 73 archivos, 389 tests | 71 archivos, 384 tests |
| Vitest backend unitario | 33 archivos, 145 tests | 35 archivos, 148 tests |
| Vitest backend integración | 15 archivos, 63 tests | 15 archivos, 63 tests |
| Playwright | 88 tests | 88 tests |

Los tests de frontend que faltan cubrían código borrado (`fetchInventoryPage`, `fetchInventoryFilteredIds`) o se fundieron (los cuatro tests de importadores en `import-api.test.ts`). Se sumaron `api-client.test.ts`, `custom-fields.test.ts` y `section-access.test.ts`.

El recorrido `e2e/refactor-walkthrough.spec.ts` volvió a pasar en **1440×900** y **390×844**: login, onboarding, inventario (filtro e importación), venta con equipo no registrado y con canje, canjes, clientes, servicio técnico, reportes, configuración (moneda y dólar), invitación y permisos de un empleado. Las capturas quedaron en `/opt/cursor/artifacts/refactor-e2e/` (`desktop-1440-*.png` y `phone-390-*.png`, 42 archivos).

### Riesgos

- `apiRequest` cambió un detalle de red: los GET y DELETE ya no mandan `Content-Type: application/json`. El backend no lo exige sin body (Fastify rechaza justamente un body vacío con ese header). Los tests de cada servicio fijan los headers nuevos.
- Los errores de operaciones ahora son `ApiError` en lugar de `OperationRequestError`. Conservan el `status`, que es lo único que leía `draftLoadNotice`.
- Los overlays se movieron sin tocar el JSX, pero los imports cambiaron de archivo. Los cubren los tests de operaciones y el recorrido e2e.
- Siguen sin repository `operations`, `inventory`, `sales`, `trade-ins` y `reports`, y siguen copiados el CRUD de categorías del backend y `ar-date` entre paquetes (ver «Qué no se hizo»).
