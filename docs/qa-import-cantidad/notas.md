# Cantidades en importación

Datos ficticios: 15 Pro 128GB ×58 (costo USD 450, precio USD 650) y 14 Pro 256GB ×83 (costo USD 350, precio USD 500).

La vista previa conserva dos filas y muestra 141 equipos. Cantidad usa el selector de columnas existente; se puede reasignar o descartar. En móvil se desplazó horizontalmente para mostrar Cantidad con Modelo fijo.

Reutiliza `imp-review`, `imp-table-title`, `imp-preview-table`, `imp-pinned`, `sheet-frame`, `sheet-foot` y `btn2 p`. Sin CSS nuevo. Capturas del componente real en Chromium: 1440×900 @1x y 390×844 @2x. Hoja y botón dentro del viewport, sin desborde de página.

Verificación: TypeScript frontend/backend, tests relacionados de importación/inventario, flujo compartido con onboarding, API de series de 1.001 equipos y PostgreSQL local aislado. Persistencia de 141 y 1.001 equipos, costo/precio unitarios, compra/proveedor, valores por defecto y rollback de lotes anteriores ante una falla posterior. Sin build ni watchers.

Se mantienen las salvaguardas de tamaño del importador: hasta 60.000 equipos por confirmación de planilla y 2.000 por listado de texto. Se retira el máximo de 100 por cantidad y el de 200 por serie; las series se envían en lotes de 200 y los nuevos equipos de importaciones grandes se insertan en lotes de 500 dentro de una transacción.
