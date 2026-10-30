# Inventario · alineación de Cantidad e IMEI · #662

Base `test`, commit `2b7676e` (incluye #669). La tabla no incluía encabezado ni celda IMEI: no había una preferencia de columnas que activar. Se agregó después de Equipo, visible desde el inicio, con el formato y la máscara de privacidad existentes; sin IMEI se muestra «—».

Cantidad fija y editable comparten 72 px de ancho, padding de 8 px, borde de 1 px y alineación derecha. El valor fijo usa borde transparente; el input conserva fondo gris y borde existentes. Se ocultan las flechas nativas para igualar el espacio del contenido. Tooltip y rechazo por IMEI dicen exactamente «Este equipo tiene IMEI, así que cuenta como 1 unidad.».

Se reutilizan `dtable`, `r`, `inv-quantity`, `formatImei` y `data-ph-mask`. CSS aditivo: `inv-imei-col` evita el salto del IMEI; `inv-quantity-value` comparte geometría entre texto e input. No se agregan colores ni se cambia el flujo móvil.

| Vista | Antes | Después |
| --- | --- | --- |
| 1440×900 @1x | [Antes](antes-1440.png) | [Después](despues-1440.png) |
| 390×844 @2x | [Antes](antes-390.png) | [Después](despues-390.png) |

Capturas revisadas: IMEI y Cantidad visibles en escritorio sin desplazar la tabla; cantidades alineadas; sin desborde de página. La tabla conserva su scroll horizontal para las demás columnas. Móvil conserva las tarjetas. Datos ficticios en PostgreSQL local aislado: Mayorista ficticio, 15 Pro 128GB con IMEI de prueba y una unidad; 14 Pro 256GB sin IMEI con 73 unidades. El tooltip nativo se comprueba por su atributo exacto.

Validación: TypeScript frontend/backend sin errores; 61 tests relacionados de Inventario aprobados, máximo dos workers; dos recorridos Chromium (1440/390) con API real y DB local aislada. El recorrido verifica orden y visibilidad inicial del IMEI, vacío «—», mismo ancho y borde derecho del contenido de Cantidad, alineación derecha, ausencia de flechas, rechazo de cero y persistencia de 1.001 unidades tras recarga. Sin build ni watchers.
