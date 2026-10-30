# Filtros de inventario

Todas las columnas de datos tienen embudo: Ingreso, Equipo, IMEI, Cantidad, Costo, Color, Condición, Calidad, Batería, Detalle batería, Precio, Estado y Catálogo. La selección de filas conserva su checkbox.

Ingreso admite desde/hasta inclusivos. Equipo, IMEI y detalle combinan búsqueda y presencia; IMEI usa «Con IMEI»/«Sin IMEI». Cantidad, costo, batería y precio admiten mínimo/máximo; se conservan los accesos rápidos de batería. Catálogo permite selección múltiple. Todo se combina antes de paginar, con los filtros anteriores y el buscador. Cada embudo indica actividad y permite limpiar su columna; «Limpiar filtros» restablece todas. En móvil se muestran los mismos criterios en el borrador, aplicado únicamente con «Aplicar filtros».

Se reutilizaron `ColumnFilter`, `DateRange`, `MoneyRange`, `MoneyFilterInput`, `DatePicker`, `Sheet`, `Field` y las clases reales `thf`, `thpop`, `opts`, `opt`, `range`, `inv-range`, `inv-checks`, `inv-opts`, `wchip` y `chk`. Sin CSS nuevo. La celda Cantidad conserva su componente, clases, ancho y alineación. El costo y su filtro respetan el permiso financiero.

Validación: TypeScript frontend/backend; 82 pruebas relacionadas de filtros, pantalla, color y Escape; 4 recorridos E2E con API real y PostgreSQL local exclusivo (filtros y edición de cantidad a 1440/390); verificación de clases y `git diff --check`. Sin build ni watchers de archivos. Los datos son exclusivamente sintéticos (tres registros, seis unidades), creados para estas pruebas.

Capturas inspeccionadas: escritorio 1440×900 @1x y móvil 390×844 @2x. La tabla conserva su desplazamiento horizontal; la hoja móvil mantiene encabezado/pie fijos y scroll interno.

- [Ingreso](ingreso-1440.png)
- [IMEI](imei-1440.png)
- [Rangos numéricos](rangos-1440.png)
- [Catálogo y columnas finales](catalogo-1440.png)
- [Fechas y texto móvil](filtros-texto-390.png)
- [Cantidad, costo, detalle y catálogo móvil](filtros-rangos-390.png)
- [Resultado móvil con filtros activos](resultado-390.png)
