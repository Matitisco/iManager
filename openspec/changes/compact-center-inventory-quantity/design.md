# Diseño

Reutilizar `inv-quantity-cell` en encabezado y celdas con un selector acotado a `inv-stock-table` para centrar la columna. `inv-quantity-value` comparte ancho de 48 px, padding vertical de 8 px y horizontal de 4 px, borde de 1 px y texto centrado entre input y valor fijo. Mantener altura mínima de 44 px, fondo gris editable, flechas ocultas y tooltip/bloqueo por IMEI. Actualizar la comprobación geométrica E2E existente para verificar centros y ancho. Capturar antes/después a 1440×900 @1x y 390×844 @2x con datos ficticios.

Conservar los filtros incorporados en #672 durante la entrega. Centrar el texto del encabezado mediante una grilla con columnas laterales simétricas de 22 px: espacio vacío a la izquierda y filtro a la derecha. Verificar también el centro del rótulo Cantidad en Chromium.
