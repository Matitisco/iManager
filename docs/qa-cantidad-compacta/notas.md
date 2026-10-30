# Inventario · Cantidad compacta y centrada · #662

Base inicial `test`, commit `682a388` (incluye #670); integrada la actualización `75d5997` (#672) antes de completar la entrega. Las capturas antes/después usan esta última base y conservan los filtros nuevos.

El control editable pasa de 72 a 48 px y de 8 a 4 px de padding horizontal. `inv-quantity-value` conserva tipografía, altura mínima de 44 px y borde compartidos entre input y valor fijo; ahora centra el número. `inv-quantity` conserva fondo gris, radio y flechas ocultas. Se reutiliza `inv-quantity-cell` en el encabezado; el selector aditivo `.inv-stock-table .inv-quantity-cell` centra encabezado y celdas en el mismo eje. El `.thf` del encabezado usa una grilla con espacio simétrico de 22 px a ambos lados del texto para conservar el botón de filtro a la derecha sin desplazar el rótulo Cantidad. Se conserva el tooltip «Este equipo tiene IMEI, así que cuenta como 1 unidad.» y el valor fijo no editable.

| Vista | Antes | Después |
| --- | --- | --- |
| 1440×900 @1x | [Antes](antes-1440.png) | [Después](despues-1440.png) |
| 390×844 @2x | [Antes](antes-390.png) | [Después](despues-390.png) |

Capturas de la app con API real y PostgreSQL local aislado. Datos exclusivamente ficticios: Mayorista ficticio, 14 Pro 256GB sin IMEI con 73 unidades, 15 Pro 128GB con IMEI de prueba y una unidad. Móvil conserva las tarjetas existentes. Capturas revisadas sin desborde de página; la tabla conserva su scroll interno para las demás columnas. Animaciones desactivadas al tomar las capturas para evitar estados intermedios de navegación.

Validación: TypeScript frontend/backend; 78 tests relacionados aprobados, máximo dos workers; recorridos Chromium a 1440/390. El E2E existente verifica ancho de 48 px, padding lateral de 4 px, texto centrado y coincidencia de los centros de encabezado, input y valor fijo. También conserva las comprobaciones de IMEI visible y formateado, bloqueo/tooltip, rechazo de cero y persistencia de 1.001 unidades tras recarga. Sin build ni watchers.
