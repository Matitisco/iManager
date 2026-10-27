## Approach
Mantener adjust como etapa externa (mapping) y agregar un subpaso de UI. Compartir la resolución de columnas físicas por índice entre tarjetas y resumen.

Las pendientes son columnas sin destino/ignore con datos en el rango activo, o todas las descartadas cuando falta Modelo. Guardar sus índices al entrar a Columnas y al cambiar hoja/encabezado/rango; no actualizar esa lista cuando cambia un destino. Cambiar desde Resumen agrega el índice elegido y lleva foco a su tarjeta.

Reutilizar Sheet con cabecera y pie fijos y scroll interno. Adaptar las clases imp-* de la variante C a tokens desk; una sola columna de tarjetas y ancho desktop 760 px.

## Validation
Tests de componente para navegación, pendientes, edición estable, resumen, campos personalizados, encabezados y varias hojas. TypeScript frontend/backend y suite completa de frontend con máximo dos workers. Sin build, servidor, capturas ni DB.
