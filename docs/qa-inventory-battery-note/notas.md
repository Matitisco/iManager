# Detalle batería en Inventario

- Columna visible después de Batería en desktop; línea debajo de batería en las tarjetas mobile. Muestra `batteryNote`, conserva el texto completo en `title` y usa «—» para valores vacíos.
- Reutiliza `dtable`, `dtable-scroll`, `inv-stock-table` e `inv-meta`; CSS aditivo `inv-battery-note` con elipsis y máximo de 180 px en desktop / ancho disponible en mobile. Los anchos y controles existentes se conservan; esta vista no tiene selector de columnas ni redimensionado.
- Capturas del componente real con datos de ejemplo, sin sesión ni datos productivos, a 1440×900 @1x y 390×844 @2x. La nota larga trunca y la página no desborda horizontalmente en ninguno de los dos tamaños.
- Validación: 42 pruebas relacionadas; lint TypeScript frontend/backend; build frontend aprobado (advertencias de chunks existentes).
