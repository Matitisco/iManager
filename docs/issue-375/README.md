# Issue #375 — filtros y Compras del cliente

## Cambios

- `src/desk/ColumnFilter.tsx`, `desk.css` y los filtros de `SalesScreen`, `InventoryScreen` y `ClientsScreen`: opciones de ancho completo con texto en una línea, elipsis y contador en columna propia. El menú conserva 248 px y se limita al viewport. Canjes comparte los estilos y la colocación.
- `src/desk/client-purchases.ts` y `ClientPurchases.tsx`: IMEI completo, tres filas, filtros y modal superpuesto con lista desplazable; en móvil ocupa la pantalla y permite volver a la ficha. Garantías con fecha completa y umbral inclusivo de 30 días calendario, sin migraciones. Anuladas con fondo rosa, importe tachado y pill; se conservan visibles y se excluyen de importes, contadores y garantías.
- `src/desk/overlays/client.tsx`: carga suplementaria de anuladas y productos archivados mediante servicios existentes; carga vendedores al abrir directamente desde Clientes. Errores visibles. El resto de la ficha conserva su estructura y acciones.
- `backend/src/modules/sales/sales.service.ts`: los agregados excluyen CANCELADA/ANULADA y voidedAt; el alta histórica anulada no incrementa gasto, y cambiar únicamente el estado también recalcula estadísticas.
- Pruebas: `ColumnFilter.test.tsx`, `client-purchases.test.tsx`, `client-purchases-layout.test.tsx`, `client-purchase-history.test.tsx`, `warranty-coverage.test.tsx` y `sales.service.test.ts`.

## Verificación

```bash
npm run lint
npm --prefix backend run lint
npm run test:frontend -- --maxWorkers=4
npm --prefix backend run test:unit
ISSUE_375_SHOTS=docs/issue-375 npm run test:frontend -- src/desk/client-purchases-layout.test.tsx --maxWorkers=2
git diff --check
```

Resultado final: TypeScript/lint frontend y backend aprobados; 1.257 pruebas frontend y 520 unitarias backend aprobadas; `git diff --check` aprobado.

Las pruebas de layout montan los componentes React y verifican su DOM y CSS en Chromium a 390×900 y 1440×900. Capturas `preview-*`, `all-*` y `filter-*` con datos sintéticos; no son capturas de una sesión productiva. No se agregaron pruebas E2E, builds, migraciones ni operaciones contra bases reales.

## Diferencias respecto de las referencias

Los contadores excluyen registros anulados aunque sigan visibles en el historial, conforme a la regla de negocio explícita; las referencias incluyen la anulada en el contador del listado. Se mantienen los tokens actuales y el resto de la ficha existente. No se inventan IMEI para ventas históricas sin equipo asociado.
