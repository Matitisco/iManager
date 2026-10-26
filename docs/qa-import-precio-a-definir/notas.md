# Importación con precio a definir

El flujo aprobado usa aviso compacto con acceso directo a Precio, mapeo tabular, obligatorios sin asignar resaltados y resultado con filtro. El proveedor se crea y selecciona dentro del formulario después de confirmar el guardado. Inventario se abre en `/#/stock/equipos`.

Precio es opcional al importar: los equipos reconocibles se conservan con `price: null` y muestran «A definir». Reimportar un IMEI sin precio conserva el valor guardado. Modelo sigue siendo obligatorio y vender exige un importe positivo. Los ceros históricos mantienen «Sin precio».

Se conservan los motivos de descarte de `diagnostics`, los campos faltantes, los eventos de importación con sus filtros de privacidad y la separación entre costo y precio de venta.

Se reutilizan Sheet, SheetActions, DeskSelect, Field, btn2 y wlink, con los tokens de desk.css. CSS específico conservado: import-guidance, import-field-missing, import-field-price y eq-supplier-editor.

QA exclusivamente con PostgreSQL privado local y datos ficticios: tres equipos del CSV de reproducción sin precio de venta, una tienda, un equipo con precio y proveedores de ejemplo. Sin respuestas de API sustituidas. El recorrido verifica aviso, asignación de Precio, Modelo sin mapear, cero filas, resultado, filtro y selección/creación/guardado del proveedor a 1440×900 @1x y 390×844 @2x.

La entrega final contiene nueve pasos con los nombres `01-sin-precio` a `09-proveedor-seleccionado`, cada uno con sufijos `-1440.png` y `-390.png`, más un reporte con commits, resultados de verificación y comparación contra la referencia aprobada.

PR draft: https://github.com/Matitisco/iManager/pull/614. Sin merge ni build.

Validación final: TypeScript frontend/backend; 2190 pruebas frontend en 236 archivos, 686 unitarias backend y 472 integraciones backend aprobadas, más verificar-clases sin faltantes. Frontend completado por archivos tras una interrupción y un timeout de arranque de worker, resuelto con el reintento aislado del archivo pendiente. Capturas finales: 18/18; ocho pasos sin diferencias relevantes y el paso de cero filas conserva los motivos y el error de Modelo de #613.
