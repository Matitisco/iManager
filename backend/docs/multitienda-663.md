# Multitienda — backend #663 / alcance #664

La tienda original sigue siendo el tenant y la referencia de facturación. Activar multitienda crea una segunda Store y la agrupa con la original; no transforma datos existentes ni cambia la membresía activa. La creación de Store + OWNER usa la misma rutina que onboarding y el alta de tiendas. Las cajas, categorías/catálogos y contadores siguen inicializándose al usarlos, como antes.

## Decisiones de implementación

- Las transferencias son **a costo**, sin venta, movimiento de caja ni ganancia para el origen. La moneda histórica null se materializa con la moneda del origen para conservar su significado aunque el destino opere en otra moneda.
- El destino recibe `acquiredQuantity = 0`: es una transferencia interna y no una compra nueva. El origen conserva su adquisición histórica. No se copian categorías, proveedores, compras, reservas ni publicación de catálogo. Al reactivar un IMEI se limpian esos datos anteriores y los precios públicos; las listas independientes lo reciben oculto.
- Se copian solamente campos personalizados definidos en ambas tiendas con la misma clave y tipo; no se crean definiciones implícitamente.
- El grupo serializa transferencias y usa el retry Serializable existente, con locks sobre los equipos compartidos con ventas/señas/consignaciones. La clave de idempotencia pertenece al grupo; un replay del mismo origen y destino devuelve la transferencia original. Reutilizarla con otra dirección devuelve 409.
- Los equipos cuyo stock se agota quedan archivados con motivo «Transferido a …». Restaurar ese archivo devuelve 409; para recuperar stock hay que transferir desde la otra tienda. La vuelta del mismo IMEI reactiva su fila original.
- El resumen, bloqueo de escritura, detalle, cotización, checkout, cancelación y actualización de facturación resuelven la tienda primaria. No se inicia un trial secundario ni se modifican planes existentes.
- El balance usa exactamente el cálculo de `getNetProfit`, cargado una vez por tienda, con caché de cotización por configuración durante la consulta. Conserva exclusión de accesorios, cantidades, gastos y reconocimiento de devoluciones. Si falta una cotización necesaria responde 409 visible. Las monedas distintas se informan por separado con `combined: null`.
- Las etiquetas de meses del gráfico se anclan en la zona de la tienda primaria y son estables al cambiar la tienda activa; cada tienda reconoce sus movimientos y el día de corte en su propia zona horaria. No se modifica la contabilidad histórica ni el criterio de costos de Reportes.
- OWNER en ambas tiendas es obligatorio para balances y transferencias. Los empleados reciben solamente su tienda en el grupo y nunca acceso implícito al par. Se conserva `canSeeFinancials` y la política de #691.

## Migración

`prisma/migrations/20261104180000_multi_store_groups/migration.sql` fue generado con `prisma migrate diff` entre el schema anterior y el actual. Solo agrega tres tablas, las columnas nullable `Store.groupId/groupKind`, índices y claves foráneas. El mismo schema se aplica con `prisma db push`; no hay backfill, cambios de datos ni migración de tiendas sueltas.

Validación exclusivamente en `postgresql://postgres:postgres@127.0.0.1:5433/imanager_663`, con datos sintéticos. No se accedió a producción ni se ejecutó build.

## Para incluir en el PR del orquestador

#664 queda cubierto por una tienda minorista completa al cambiar de tienda y su etiqueta. Sigue abierta la definición de si Matías quiere funciones exclusivas de minorista: no se agregaron supuestos. Los clientes y proveedores permanecen por tienda; esta entrega no comparte entidades entre tenants.

## Validación reproducible

Desde `backend/`:

```sh
npm run lint
npx vitest run --config vitest.unit.config.ts src/modules/store-groups src/modules/reports/net-profit.test.ts src/modules/auth/session.service.test.ts src/modules/billing/service.test.ts src/modules/billing/stale-preapproval.test.ts src/modules/stores/sections.test.ts --maxWorkers=1
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/imanager_663 npx vitest run --config vitest.integration.config.ts src/test/store-groups.integration.test.ts --maxWorkers=1
```

Las integraciones cubren alta y doble clic, membresías/sesión, facturación compartida, paridad mensual, monedas mixtas, permisos/IDOR, stock único/parcial, disponibilidad, consignaciones, idempotencia concurrente, conflictos de stock, rollback del lote, auditoría de ambas tiendas, vuelta del IMEI, restauración bloqueada, catálogos y aislamiento de gastos/clientes/inventario.

Resultado final: TypeScript backend OK; 39 unitarias relacionadas OK; 36 integraciones de multitienda OK; 74 integraciones de regresión OK. Las regresiones se ejecutaron con:

```sh
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/imanager_663 npx vitest run --config vitest.integration.config.ts src/test/auth-onboarding.integration.test.ts src/test/team-permissions.integration.test.ts src/test/billing.integration.test.ts src/test/returns-recognition.integration.test.ts --maxWorkers=1
```

Los primeros intentos ampliados tuvieron timeouts de arranque de workers en el entorno compartido; se repitieron satisfactoriamente con un worker. El mock de la prueba nueva de paridad se corrigió antes de la ejecución final. Se verificó además igualdad exacta entre el SQL de `prisma migrate diff` y el archivo de migración, ausencia de operaciones destructivas/de datos, y `git diff --check` sin errores.
