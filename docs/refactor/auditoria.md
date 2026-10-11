# Auditoría de refactor — SOLID, código muerto y dependencias

Fecha: 2026-10-11. Rama base: `refactor-solid` (HEAD `273660f`). No se tocó `main` ni el schema de Prisma.

Herramientas: grafo de imports desde `src/main.tsx`, `knip@5` (workspaces frontend/backend), `depcheck@1` y revisión manual de rutas, servicios y pantallas. `ts-prune` no se usó como fuente de verdad: el `tsconfig` de la raíz incluye el backend y marca como muertos exports que sí usan los tests y las rutas. Los exports que knip marcó en el backend se contrastaron a mano.

## Cómo se midió “sin uso”

Un archivo de `src/` está muerto en producción si no es alcanzable desde `src/main.tsx` siguiendo imports estáticos (incluidos imports multilínea). Los tests de Vitest cuentan como uso de test, no como uso de producto. `src/test/setup.ts` queda: lo carga Vitest, no la app.

Líneas de partida (`.ts`/`.tsx` en `src/` y `backend/src/`, sin `node_modules`): **58.479** líneas, **252** archivos frontend y **113** backend.

## P0 — Borrar: no llega a la app

La app autenticada renderiza `DeskApp` (`src/App.tsx`). Login, onboarding y la acción de auth siguen en `src/pages/`. El resto de `src/pages/` y la tabla genérica anterior no tienen ningún import desde ese grafo.

| Pieza | Evidencia | Líneas aprox. |
| --- | --- | --- |
| `src/pages/{Inventory,Sales,Clients,TradeIns,Dashboard,Reports,Settings,Notifications}.tsx` y helpers `dashboard-focus`, `reports-mock`, `settings-access` | Solo se importan entre sí o desde sus tests | ~6.500 |
| `src/components/{Layout,Header,Sidebar,Modal,ConfirmModal,StoreSwitcher,TagField,ImportInventoryModal}.tsx` y `src/components/forms/*` | `Layout` no tiene importadores. El resto solo alimenta esas páginas o sus tests | ~2.500 |
| `src/components/table-engine/**` excepto `components/ImportModal.tsx` y `types.ts` | `DeskOverlays` usa el modal de importación. `TableEngine` solo lo usan las páginas muertas | ~3.000 |
| `src/services/{sales,clients,trade-ins}-table-api.ts`, `reports-api.ts` | Solo los consumen las páginas muertas | — |
| `src/utils/{reports,cell-tags}.ts`, `src/types/reports.ts` | Solo los consumen esas páginas y sus tests | — |

Total de producción inalcanzable, sin contar tests: **54 archivos, ~12.550 líneas**. Los tests que solo cubren esa capa se borran con ella. `utf8-copy.test.ts` e `inventory-columns.test.ts` leen esos archivos por `readFileSync` y hay que redirigir o borrar esas aserciones.

`ImportModal` se queda: es el importador de inventario, ventas, canjes y clientes en el escritorio.

## P0 — Dependencias muertas

`depcheck` y `knip` coinciden. No hay ningún import en el repo.

| Paquete | Dónde | Nota |
| --- | --- | --- |
| `@google/genai` | frontend `dependencies` | Solo queda `process.env.GEMINI_API_KEY` en `vite.config.ts`, sin lectores |
| `better-sqlite3` | frontend `dependencies` | Sin imports. El negocio está en Postgres |
| `autoprefixer` | frontend `devDependencies` | Tailwind 4 entra por `@tailwindcss/vite` y `@import "tailwindcss"` |
| `msw` | frontend `devDependencies` | Sin `setupServer` ni handlers |
| `nodemailer`, `@types/nodemailer` | backend | Sin imports. Las invitaciones no mandan mail por este paquete |

Se conservan `tailwindcss`, `@tailwindcss/vite`, `exceljs`, `firebase`, `lucide-react`, `motion`, `recharts`, `clsx`, `tailwind-merge`. Knip en modo `--production` los marca mal porque no sigue el entry de Vite; el grafo y `depcheck` sí los ven usados.

Falsos positivos a ignorar:

- `playwright` “unlisted” en dos tests de `src/desk/`: importan `@playwright/test`, que ya está declarado.
- `xlsx` en `scripts/generate-tradeins-import-fixtures.mjs`: script suelto, no es dependencia de la app. No se agrega `xlsx` (YAGNI); el runtime usa `exceljs`.
- `prisma` como binario “unlisted” en el backend: está en `devDependencies` y Knip no lo asocia al script.

## P1 — Backend: capas y errores

Hoy cada módulo ya tiene `*.routes.ts` + `*.service.ts`. Las rutas no llaman a Prisma. Zod valida el body en la ruta. `registerApiErrorHandler` (`backend/src/lib/api-error.ts`) unifica Zod y los 500.

Lo que falta, sin cambiar respuestas:

1. **Repository.** Los servicios importan el singleton `prisma` y mezclan reglas con queries. Los más grandes: `operations.service.ts` (1.283), `inventory.service.ts` (825), `reports.service.ts` (779), `sales.service.ts` (644), `trade-ins.service.ts` (612), `clients.service.ts` (486). Extraer `*.repository.ts` que reciba el cliente Prisma (incluido el de una transacción) y dejar la regla en el service.
2. **Errores de dominio repetidos.** Cada ruta traduce `getXErrorStatus` con `reply.code(...).send({ error })`. Un error de dominio con `statusCode` que el handler central ya sepa responder saca ese `try/catch` de las rutas. El cuerpo tiene que seguir siendo `{ error: string }` en los 4xx actuales: el handler genérico no manda esa forma hoy.
3. **Inyección.** El singleton impide testear el service sin la base. El repository se inyecta; el default sigue siendo `prisma` para no tocar los tests de integración.

No hace falta un factory/builder de entidades: los `create` ya son funciones y un builder no achicaría nada.

### Endpoints

No hay rutas huérfanas obvias: el frontend vivo llama inventario, ventas, canjes, clientes, operaciones, reparaciones, tiendas, invitaciones, catálogos, notificaciones y onboarding.

`/api/reports` no lo llama `DeskApp` (los reportes se arman en el cliente con `report-breakdown.ts`). El módulo tiene tests de contrato. Borrarlo cambia la API aunque la UI no lo note. Se deja.

`backend/scripts/seed-reports-demo.ts` no está en `package.json`. Es un script manual contra una base real. No se borra en este pase.

Exports que Knip marca y que no se reexportan: `optionalCurrency`, `CATALOG_KINDS`, `serializeInventoryItem`, `DEVICE_QUALITIES`, `QUALITY_ERROR`, `OperationError`, `cancelSaleOperation`, `RepairError`, `normalizeRepairStatusLabel`, `formatPaymentMethodLabel`, `parseReportsDate`, `normalizeInstagram`, `getFirestoreClient`. Varios se usan dentro del mismo archivo. Solo se borra un export si queda sin ninguna referencia, incluida la interna.

## P1 — Frontend: AppContext y pantallas

`src/context/AppContext.tsx` tiene **1.349** líneas y un solo contexto con sesión, inventario, ventas, canjes, clientes, reparaciones, categorías, operaciones y notificaciones. Los consumidores usan `useAppContext()`. Partirlo en hooks por dominio, compuestos por el mismo provider, mantiene esa firma y el orden de los efectos.

Pantallas grandes que siguen vivas:

| Archivo | Líneas |
| --- | --- |
| `src/desk/DeskOverlays.tsx` | 1.664 |
| `src/pages/Login.tsx` | 584 |
| `src/desk/screens/ReportsScreen.tsx` | 611 |
| `src/desk/screens/InventoryScreen.tsx` | 592 |
| `src/pages/Onboarding.tsx` | 518 |
| `src/desk/RepairForms.tsx` | 507 |

`DeskOverlays` mezcla el switch de overlays con los formularios de venta y cliente. Esos formularios pueden salir a archivos propios sin cambiar el markup.

## P2 — Escritorio y celular

`ScreenTitle`, `MobileDock` y `PhoneRecord` ya unifican el marco. Cada pantalla (`Inventory`, `Sales`, `Clients`, `TradeIns`) repite el bloque de borradores, la barra de chips y el `if (phone)` entre cards y tabla. Unificar el marco repetido (borradores + dock) achica las pantallas. Fundir la tabla y la card en un solo componente genérico no conviene: las columnas no son las mismas.

## P2 — Patrones que sí simplifican

**Strategy, cotización.** `parseBlueQuote` en `src/desk/blue-rate.ts` bifurca DolarApi y Bluelytics. Las casas blue/oficial/MEP comparten el formato DolarApi. Un mapa `id → parse` deja el `if` afuera. El cache y el refresh no cambian. Ya hay `blue-rate.test.ts`.

**Strategy, importadores.** `inventory-import-api`, `sales-import-api`, `clients-import-api` y `trade-ins-import-api` repiten el POST autenticado (token, timeout, error `body.error`). Un solo helper con el path y el tipo de resultado. El mapeo de columnas sigue en `ImportModal`.

**Adapter, servicios externos.** `src/services/auth-adapter.ts` ya aísla Firebase Auth del modo e2e. Falta el mismo borde para:

- HTTP de cotización (`fetchJson` en `blue-rate.ts`)
- Firebase Admin (`backend/src/plugins/firebase-admin.ts`), que ya es un módulo único; alcanza con tipar la superficie que usan auth y los scripts

No se agrega un adapter por cada llamada a la API propia: `fetch-with-timeout.ts` ya es ese borde.

## Qué no se hace

- Cambios de schema Prisma, ni aditivos, en este plan. No hay un campo que el refactor necesite.
- Railway, variables y base de producción.
- Reescribir `operations.service.ts` “de cero”. El repository sale moviendo queries, con las mismas transacciones.
- Borrar `/api/reports` ni el script de seed.
- Un design system nuevo. Solo se extrae lo que ya está copiado.

## Orden de PRs (todos contra `refactor-solid`)

1. Esta auditoría.
2. Código y dependencias muertas del P0.
3. Backend: repository + error de dominio en el handler, Zod sigue en la ruta.
4. Partir `AppContext` y sacar los formularios de `DeskOverlays`.
5. Marco compartido de pantallas escritorio/celular.
6. Strategy de cotización e importadores, y el adapter de cotización HTTP.

Cada paso tiene que dejar lint, unitarios, integración y e2e en verde, sin cambio de comportamiento.
