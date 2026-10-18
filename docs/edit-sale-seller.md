# Edición del vendedor de una venta

Causa confirmada: el detalle y el menú contextual ofrecían Editar para ventas CANCELADA. La API rechazaba correctamente el PATCH con 409, pero el aviso quedaba arriba del formulario, fuera del área visible al guardar.

El detalle y el menú ocultan Editar para esas ventas. Un formulario abierto con una venta cancelada muestra «Esta venta está cancelada y no se puede editar.» y bloquea el guardado. Los errores de guardado se desplazan a la vista mediante scrollIntoView, conservando los componentes y estilos existentes.

Cambiar solo vendedor conserva los importes y monedas originales mediante commitGroup, incluso con moneda de visualización diferente. El backend mantiene el 409 de canceladas y compara los importes de ventas con señas a centavos. También conserva la diferencia bruta del canje: editar una venta con canje y seña ya no resta la seña del campo differencePaid, evitando descontarla otra vez en el detalle o al calcular deuda.

Las regresiones cubren asignación, cambio y eliminación del vendedor; auditoría sale.seller.changed; reemplazo/anulación de comisiones; ventas integradas, legacy, pendientes, con canje y/o seña; ARS y USD; errores visibles y bloqueo de canceladas. Playwright verifica listado y detalle antes y después de recargar, comisión con regla, eliminación del vendedor y ausencia de Editar en detalle/menú de canceladas, a 1440×900 y 390×844 en Chromium.

## Entorno y reproducción

Solo se utilizó PostgreSQL local `127.0.0.1:5432/imanager_test_vendedor`. No hubo cambios de Prisma ni acceso a datos productivos. `prisma migrate deploy` falló en una base vacía porque las migraciones existentes presuponen la tabla Sale; la base se preparó con `prisma db push --skip-generate`, sin aceptar pérdida de datos. Playwright utiliza el mismo procedimiento en su setup existente.

Con DATABASE_URL apuntando a esa base local:

```sh
npm run lint
npm --prefix backend run lint
npm run test:frontend
npm --prefix backend run test:unit
npm --prefix backend run test:integration
npm run build
npm --prefix backend run build
```

Los scripts lint ejecutan TypeScript con `tsc --noEmit`.

```sh
source /workspace/wt-395/.qa395/env.sh
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/imanager_test_vendedor
export PLAYWRIGHT_APP_BASE_URL=http://127.0.0.1:5274
export PLAYWRIGHT_API_BASE_URL=http://127.0.0.1:4274
npx playwright test e2e/edit-sale-seller.spec.ts e2e/edit-sale-seller-iphone.spec.ts --workers=1 --retries=0
```

No ejecutar integración y Playwright simultáneamente contra la misma base: la integración trunca las tablas entre casos.

## Validación

- TypeScript frontend/backend: aprobado (`npm run lint` en ambos).
- Frontend: 132 archivos, 965 tests aprobados, incluidos 16 nuevos.
- Backend unitarios: 64 archivos, 460 tests aprobados.
- Backend integración: 33 archivos, 305 tests aprobados, incluidos 19 nuevos.
- Builds frontend y backend: aprobados. Frontend mantiene el aviso de tamaño de chunks.
- E2E Chromium desktop/iPhone: ocho escenarios aprobados sin retries (54,9 s), con verificación explícita del saldo luego de quitar vendedor.

Durante el setup E2E apareció un log P2002 en GET /api/catalogs; no afectó los ocho escenarios y ese módulo no se modificó.

Cambios conservados en el working tree, sin commit, push, rama nueva ni PR.

## Archivos

- `src/desk/overlays/operation.tsx`: guardia de canceladas, aviso, botones y scroll de errores.
- `src/desk/DeskOverlays.tsx`: Editar condicionado al estado en el menú contextual.
- `backend/src/modules/operations/operations.service.ts`: comparación a centavos y conservación de diferencia del canje.
- `src/desk/edit-sale-seller.test.tsx`: 16 pruebas de frontend.
- `backend/src/test/edit-sale-seller.integration.test.ts`: 19 integraciones de vendedor y comisiones.
- `e2e/edit-sale-seller.flow.ts`, `e2e/edit-sale-seller.spec.ts`, `e2e/edit-sale-seller-iphone.spec.ts`: ocho escenarios de navegador.
- `PROJECT_STATUS.md`, este documento y los cuatro artefactos de `openspec/changes/fix-edit-sale-seller/`: contexto, decisiones y validación.
