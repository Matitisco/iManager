# Cantidad por equipo · #662

Una fila con cantidad 73 crea **un registro con cantidad 73**. Excel/CSV, Pegar listado, archivos .txt y onboarding comparten ese comportamiento. Cantidad ausente/vacía = 1; costo y precio siguen siendo unitarios. Se conservan las inserciones por lotes de 500 y los envíos de series de 200, sin límite de 100 por fila. Se mantienen las salvaguardas existentes de 60.000 unidades por planilla y 2.000 por texto.

Prisma expone `InventoryItem.cantidad` sobre la columna `quantity` existente, sin duplicar stock ni borrar datos. La migración asigna 1 si la columna no existía y conserva cantidades existentes. Cada venta guarda sus unidades; un flag distingue las ventas anteriores, que no descontaban cantidades, para no generar stock ficticio al anularlas. Los equipos identificados por IMEI admiten una unidad disponible (cero al venderse). La API rechaza cantidades mayores a uno con IMEI; la vista previa conserva la cantidad incompatible en notas, deja 1 y marca En revisión.

Inventario muestra Cantidad editable para equipos sin IMEI junto a Equipo y Costo; con IMEI muestra 1 como texto y tooltip. En móvil los valores viven en la tarjeta y la edición en la hoja existente. El costo respeta los permisos financieros. Alta manual usa 1; edición conserva el valor guardado. La venta permite elegir unidades y propone el precio total; con saldo cero marca Vendido y al anular repone solo las unidades de esa venta. Se valida stock con bloqueo transaccional, incluidos intentos simultáneos. Edición y reversión de anulaciones conservan las cantidades. Los borradores de canje guardan las unidades elegidas hasta su confirmación. Dashboard, resumen de onboarding, catálogo, reportes, valuación, margen, comisiones y exportación de stock usan las cantidades correspondientes.

Datos exclusivamente ficticios: las capturas `inventario`, `alta`, `edicion` y `venta` muestran 15 Pro 128GB ×73 (costo USD 450, precio USD 650) y 14 Pro 256GB ×83 (costo USD 350, precio USD 500). El recorrido de escritorio edita inline 73 → 74 antes de vender 3 (quedan 71); móvil vende 3 de 73 (quedan 70). Se confirma que siguen existiendo dos registros. Las capturas `preview` conservadas muestran el caso anterior ×58 + ×83: dos filas, 141 unidades.

Se reutilizan `dtable`, `phone-row`, `Field`, `Sheet`, `sheet-frame`, `sheet-scroll`, `sheet-foot` y `btn2`. El único CSS aditivo es `.inv-quantity`, que usa tokens existentes. Cantidad y Costo van junto a Equipo para quedar visibles al abrir la tabla; las columnas restantes mantienen el desplazamiento horizontal existente. Revisión de PNG reales a 1440×900 @1x y 390×844 @2x: sin desborde de página, acciones fijas y scroll interno de formularios.

Validación local: TypeScript frontend/backend; 227 tests frontend relacionados; 280 unitarios backend relacionados; 41 integraciones PostgreSQL (incluyen migración sobre datos anteriores, 1.001 filas/lotes, rollback, IMEI, ventas parciales, sobreventa concurrente, edición, canjes, anulación y restauración); dos recorridos Chromium con API y PostgreSQL local aislado. Sin build ni watchers.

## Corrección UX de Cantidad con IMEI · #662 (posterior a #668)

Con IMEI, la celda muestra `1` sin input, con tooltip «Equipo con IMEI: siempre 1 unidad». Sin IMEI conserva edición por Enter/blur, admite enteros desde 1 y no impone `max` en la UI. Escape restaura el valor y limpia el error. Los rechazos de validación y persistencia aparecen dentro de la celda, vinculados al input con `aria-invalid`/`aria-describedby`. Un rechazo por IMEI explica: «Este equipo tiene IMEI, así que cuenta como 1 unidad. Para cargar varios, usá equipos sin IMEI.» El guardado bloquea la celda y evita envíos duplicados.

Se reutilizan `dtable`, `inv-quantity`, `ferr` y los tokens de `desk.css`. El único estilo aditivo es `inv-quantity-error`, para envolver y alinear el mensaje dentro de la celda. La tabla mantiene su desplazamiento horizontal; la lista móvil conserva su composición.

| Evidencia | Antes | Después |
| --- | --- | --- |
| Escritorio 1440×900 @1x | [Error global e input con IMEI](imei-antes-1440.png) | [IMEI como texto 1](imei-despues-1440.png) |
| Móvil 390×844 @2x | [Lista anterior](imei-antes-390.png) | [Lista conservada](imei-despues-390.png) |
| Rechazo de cero, escritorio | — | [Mensaje junto a la celda](cantidad-error-despues-1440.png) |

Las cinco capturas usan los mismos datos ficticios: Mayorista ficticio, 15 Pro 128GB con IMEI de prueba y una unidad, 14 Pro 256GB sin IMEI con 73 unidades. Se revisaron todos los PNG: mensaje legible, sin solapamiento ni desborde de página. El tooltip es nativo del navegador; su texto se comprueba en las pruebas.

Validación de este fix: 58 tests de `InventoryScreen` (12 regresiones nuevas, fallaban antes del arreglo); TypeScript frontend/backend; dos recorridos Playwright con API y PostgreSQL local aislado. El recorrido de escritorio rechaza cero, guarda 1.001 unidades sin IMEI y verifica persistencia tras recargar. La prueba de componente verifica ausencia de máximo de UI, valores vacíos/negativos/fraccionarios, errores del servidor, reintento, Escape y bloqueo durante guardado. Sin build ni watchers; máximo dos workers. No se modificaron contratos de API ni almacenamiento.
