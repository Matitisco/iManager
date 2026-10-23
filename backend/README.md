# iManager API

Backend para iManager con Fastify, Prisma, PostgreSQL y Firebase Admin.

## Requisitos

- `DATABASE_URL`
- `FRONTEND_URL`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIRESTORE_DATABASE_ID`

`FRONTEND_URL` debe apuntar al host real del frontend (por ejemplo `http://localhost:5173` en desarrollo o el dominio público en producción). El módulo de invitaciones usa esa variable para construir el enlace compartible y ahora falla de forma explícita si no está configurada.

## Scripts útiles

- `npm run dev` — arranca el backend en modo desarrollo
- `npm run lint` — chequeo TypeScript sin build
- `npm run bootstrap:owner -- --firebaseUid <uid>` — crea `Store` + `StoreMember` OWNER default para un usuario existente
- `npm run migrate:clients` — migra `clients` históricos desde Firestore a PostgreSQL

## Bootstrap inicial de tienda

El script de bootstrap busca el usuario por `firebaseUid` o por `email` en Firebase Auth y en Postgres.

Ejemplos:

```bash
cd backend
npm run bootstrap:owner -- --firebaseUid abc123 --storeName "iManager Store"
```

```bash
cd backend
npm run bootstrap:owner -- --email usuario@correo.com
```

## Migración histórica de clients

El script lee la colección `clients` de Firestore, resuelve el `authorUid` contra `User.firebaseUid`, busca la `Store` por la membresía `default` y hace `upsert` por `storeId + dni`.

Si no encuentra usuario, membresía o `dni`, registra el caso y saltea el documento.

Ejecutar:

```bash
cd backend
npm run migrate:clients
```

## Contratos Proveedores / Patrones #308 (ronda backend)

Todos los endpoints requieren autenticación y membresía de la tienda activa. Proveedores e
Inventario requieren acceso a `inventory`; Devoluciones y Patrones requieren `sales`, igual
que el módulo de reclamos existente. `canSeeFinancials` usa el permiso de `reports`, no
exclusivamente el rol OWNER. Los costos y totales se omiten por completo sin ese permiso.

### Schema y escrituras

- Migración aditiva `20261022000000_stock_purchase_name`: `StockPurchase.name String? @db.VarChar(120)`, nullable sin backfill ni cambios sobre filas existentes.
- `POST /api/inventory`: al crear con `supplierId`, acepta `purchaseName?: string | null` o el alias `name?: string | null` para la compra nueva. Respuesta existente `201 { inventoryItem }`, ahora con la metadata de compra.
- `POST /api/inventory/import`: acepta los mismos campos al nivel del body, junto con `supplierId` y `rows`; una compra agrupa los equipos nuevos importados. Respuesta existente `{ imported, updated, errors }`. Los equipos actualizados conservan su origen.
- Se aplica trim, máximo 120 caracteres; vacío/null/ausente se guarda como null. `purchaseName` tiene precedencia sobre `name`, incluso si es null. Más de 120 devuelve 400 antes de persistir. No se agregan estos campos a PATCH ni al contrato de carga en serie.

### Lecturas

| Método y ruta | Query | Respuesta |
| --- | --- | --- |
| `GET /api/suppliers` | `archived=1\|true` opcional | `{ suppliers: SupplierListItem[] }` |
| `GET /api/suppliers/:id` | `includeItems=0\|false` opcional; default incluye equipos para compatibilidad | `{ supplier: SupplierDetailView }` |
| `GET /api/suppliers/:id/purchases` | — | `{ purchases: PurchaseSummaryView[] }`, historial completo y liviano, sin equipos |
| `GET /api/suppliers/:id/purchases/:purchaseId` | — | `{ purchase: PurchaseDetailView }` |
| `GET /api/inventory` | `supplierId` opcional, además de los filtros existentes | `{ inventory: InventoryItemResponse[] }` o `{ items, total }` cuando se usa `skip`/`take` |
| `GET /api/inventory/ids` | `supplierId` opcional, además de los filtros existentes | `{ ids: string[] }` |
| `GET /api/inventory/:id` | — | `{ inventoryItem: InventoryItemDetailResponse }` |
| `GET /api/returns` | `archived=1\|true` opcional | `{ returns: ReturnCaseView[] }`, contrato existente con `supplierId` y `supplierName` |
| `GET /api/returns/patterns` | `groupBy=supplier\|purchase\|model`; default `supplier` | `{ patterns: ReturnPatternView[] }` |

IDs inexistentes o ajenos a la tienda devuelven 404 en las lecturas de detalle. La compra
también debe pertenecer al proveedor indicado y no estar eliminada. Un `groupBy` inválido
devuelve 400; falta de autenticación/acceso devuelve 401/403 respectivamente.

### Shapes y tipos exportados

En `src/modules/suppliers/suppliers.service.ts`:

```ts
interface SupplierListItem {
  id: string; name: string; phone: string | null; email: string | null;
  notes: string | null; deletedAt: string | null;
  deviceCount: number; problemCount: number; claimCount: number;
  lastPurchasedAt: string | null; // YYYY-MM-DD, Argentina
}
interface PurchaseSummaryView {
  id: string; name: string | null; purchasedAt: string; notes: string | null;
  devices: number; problemCount: number; claimCount: number;
  // Sólo con canSeeFinancials:
  totalCost?: number | null; currency?: string | null;
  costTotals?: Array<{ currency: string; totalCost: number }>;
}
interface PurchaseItemView {
  id: string; model: string; capacity: string; color: string; imei: string;
  status: string; currency: string | null; createdAt: string;
  problem: boolean; problemLabel: string | null;
  cost?: number; // Sólo con canSeeFinancials
}
interface PurchaseDetailView extends PurchaseSummaryView {
  items: PurchaseItemView[];
  summary: { problems: number; devices: number };
}
interface SupplierDetailView extends SupplierListItem {
  purchases: Array<PurchaseSummaryView & { items?: PurchaseItemView[] }>;
}
```

Compras ordenadas por `purchasedAt` descendente y después ID descendente. `totalCost` y
`currency` son null si hay más de una moneda; `costTotals` contiene los totales por moneda
sin sumarlas ni convertirlas. La moneda null de un equipo histórico usa la moneda actual
de su tienda para los totales. Para mostrar una compra, usar `name` si existe, de lo
contrario fecha + `notes`. La respuesta legacy del proveedor conserva `items`, sus etiquetas
existentes y el grupo sintético `sin-lote`; este grupo no aparece en el historial liviano
ni en patrones. `includeItems=0` permite cargar el proveedor y todas sus compras sin equipos.

`PurchaseItemView.problemLabel` del nuevo detalle usa `En revisión`, `En RMA`, `Reclamo`
o `En servicio técnico`, con prioridad de estado, reclamo y reparación, respectivamente.

En `src/modules/inventory/inventory.service.ts`, `InventoryItemResponse` agrega
`purchasedAt: string | null` (YYYY-MM-DD, Argentina) y `purchaseName: string | null`,
y conserva `stockPurchaseId`, `supplierId`, `supplierName`. Sin compra, los tres campos
de compra son null. La metadata se devuelve en listas, altas, actualizaciones y restauraciones.
`InventoryItemDetailResponse` agrega `purchaseSummary: { problems: number; devices: number } | null`;
el listado no calcula ni devuelve este resumen. El listado paginado resuelve la metadata
en una consulta adicional para toda la página. El filtro de proveedor está soportado en
el servidor tanto en lista completa como paginada e IDs; la UI actual también dispone
de `supplierId`/`supplierName` para su filtrado local en `inventory-filters`.

`ReturnCaseView` ya devolvía `supplierName: string | null` junto con `supplierId` y
`POST /api/returns` ya heredaba el proveedor del equipo de la venta. Se conserva ese
contrato y queda cubierto por integración de creación y lectura.

En `src/modules/returns/patterns.service.ts`:

```ts
interface ReturnPatternView {
  key: string; label: string; supplierId: string | null; purchaseId: string | null;
  devices: number; problems: number; claims: number; percent: number; hot: boolean;
  topReason: { family: string; label: string; claims: number } | null;
  claimsDetail: Array<{
    id: string; caseNumber: string; // RMA-0001, etc.
    deviceLabel: string; imei: string; reason: string; status: string;
    rmaStatus: string | null; // Para mostrar, por ejemplo, Enviado.
    openedAt: string; clientName: string; // openedAt es ISO timestamp
  }>;
  claimsTruncated: boolean;
}
```

`key` es el ID de proveedor/compra, o el tuple JSON `[modelo, capacidad]` para modelo.
Las etiquetas son nombre del proveedor, proveedor · nombre/fecha-nota de compra o
modelo · capacidad. Los campos de ID que no apliquen son null; en modelo ambos son null
porque puede reunir varios proveedores/compras. Sin proveedor no participa en supplier;
sin compra no participa en purchase. Las compras eliminadas quedan fuera de purchase.
Modelo incluye equipos sin origen. No hay datos monetarios en patrones.

### Reglas de agregación

- Sólo equipos con `archivedAt=null`. Un equipo cuenta una sola vez como problema si tiene estado `EN_REVISION`/`EN_RMA`, algún reclamo vigente o reparación abierta por IMEI en la misma tienda. Las reparaciones archivadas, entregadas, canceladas o anuladas no cuentan.
- Reclamo vigente: `deletedAt=null` y estado distinto de `ANULADO`, consistente con el módulo actual, incluidos los resueltos. Se enlaza por `inventoryItemId` o por `supplierId` + IMEI no vacío. Ambas coincidencias no duplican un reclamo ni un equipo.
- `SupplierListItem.claimCount` incluye reclamos vigentes asignados al proveedor aunque ya no tengan equipo activo, más los enlazados por equipo; compras/patrones cuentan los reclamos de los equipos activos del grupo.
- `percent = round(problems / devices * 100)` (0 sin equipos). `hot` con al menos 3 problemas o proporción real ≥40%. Orden por problemas desc, porcentaje desc y clave estable.
- `claimsDetail` devuelve los 50 más recientes por `openedAt`/número. `claims`, `topReason` y demás métricas usan todos los reclamos, incluso cuando `claimsTruncated=true`.
- Detección simple sobre `reason` libre, sin categorías persistidas: minúsculas y sin acentos. Familias estables `bateria`, `pantalla`, `carga`, `camara`, `audio`, `face-id`, `conectividad`, `botones-tactil`, `agua`. `topReason` requiere al menos dos reclamos; cada reclamo suma como máximo una vez por familia. Empates en ese orden de familias.
- Agregación compartida en `src/modules/suppliers/problems.ts`, con consultas por tienda y sin consultas por cada fila. No se cambia el origen de datos ni se usan fallbacks.

### Validación local de esta ronda

Usar exclusivamente `imanager_308_test` para integración (los fixtures truncan tablas),
nunca `imanager_308`. No se requiere build ni E2E backend.

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/imanager_308_test npm run test:integration -- src/test/supplier-patterns.integration.test.ts src/test/suppliers-expenses.integration.test.ts src/test/returns.integration.test.ts
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/imanager_308_test npm run test:unit -- src/modules/returns/patterns-math.test.ts src/modules/suppliers/problems.test.ts src/modules/inventory/inventory.test.ts
npm run lint
```
