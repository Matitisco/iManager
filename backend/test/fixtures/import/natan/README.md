# Regresiones de importación de stock

Todos estos archivos están anonimizados. No agregar planillas ni datos de clientes reales.

Desde la raíz del repo:

```sh
npx tsx scripts/gen-import-fixture-grids.mts
npx vitest run src/utils/parse-workbook.test.ts src/utils/import-limits.test.ts src/services/import-api.test.ts --maxWorkers=2
cd backend
npx vitest run --config vitest.unit.config.ts src/modules/import src/modules/inventory/import-diagnostics.test.ts src/modules/inventory/price-to-define.test.ts --maxWorkers=2
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/imanager_test npx vitest run --config vitest.integration.config.ts src/test/natan-import.integration.test.ts --maxWorkers=1
```

`*.grid.json` se genera usando `parseWorkbook`, la misma utilidad usada para subir XLSX/CSV. La prueba frontend reparsea los archivos originales y exige igualdad con cada grid. `cases.ts` registra expectativas explícitas por columna física, encabezado, filas y motivos de rechazo; no genera sus expectativas desde el analizador.

La réplica 00 contiene 60 filas: 59 aceptadas y la fila 59 rechazada por repetir el IMEI de la 38. Costo está en I (índice 8). La variante 03 inserta columnas vacías y lo mueve a K; 04 cambia el orden y lo mueve a E. 09 contiene importes, modelos y fechas inválidas que deben rechazarse con motivo, conservando los demás equipos.

Reglas verificadas:

- Costo inválido no se transforma en cero. Se rechaza sólo esa fila: el schema actual de costo no admite null. Un costo ausente conserva la regla existente (cero para alta y conservar costo anterior al actualizar). Precio ausente se importa como null/«a definir»; precio inválido se rechaza con explicación.
- Batería ilegible vacía el campo y agrega un aviso; no rechaza el equipo por eso.
- «Fecha compra» se interpreta como ingreso del equipo; «Fecha de compra» conserva el campo histórico purchasedAt.
- Una calidad o «Estado físico» que no cabe en las opciones del sistema se conserva como campo personalizado. Las elecciones manuales prevalecen.
- Costo sin moneda plausible en USD advierte qué moneda se utilizará; no convierte ni inventa USD. Moneda explícita en encabezado/celda y selección manual se respetan.
- Reimportar con IMEI actualiza sin duplicar. Las filas sin IMEI de 08 conservan el comportamiento existente: al repetir se crean de nuevo; la prueba cuenta estas filas por separado.
- Los lotes de 400 guardan secuencialmente. Ante un fallo, el resultado parcial conserva conteos, errores y filas físicas. No se reintenta automáticamente una escritura que podría haber llegado al servidor. La reimportación por IMEI permite recuperar la operación.
