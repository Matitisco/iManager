## Context

Cada `InventoryItem` conserva su identidad e IMEI. La cantidad representa las unidades de esa fila y el usuario la edita manualmente. Inventario hi-fi se carga desde AppContext con el listado completo; el backend también expone un listado paginado mediante SQL.

## Goals / Non-Goals

**Goals:** columna y edición con persistencia real; valor inicial 1 para datos existentes y altas que no especifican cantidad; rechazo de valores inválidos.

**Non-Goals:** agrupar registros o cambiar la transacción de Sales.

## Decisions

- Agregar `quantity Int @default(1)` sin eliminar columnas. Validar enteros de 1 a 2147483647 en API y formulario, acorde al tipo PostgreSQL.
- Aceptar cantidad opcional en requests por compatibilidad. En PATCH omitir el campo conserva el valor existente; en creación se aplica el default. El frontend soporta respuestas antiguas con `quantity ?? 1` durante despliegues escalonados.
- Incluir cantidad en ambos serializadores y el SELECT paginado. Importar cantidad opcional y conservarla al reimportar un ítem si la columna no viene informada.
- Usar el formulario hi-fi existente y su flujo async: solo cerrar después de persistir. El detalle y la tabla muestran el mismo dato.
- Verificar la migración sobre una fila anterior y probar el API real contra PostgreSQL local aislado.

## Risks / Trade-offs

- Frontend y API pueden desplegarse en momentos distintos → compatibilidad con cantidad ausente y verificar el backend de hi-fi antes de entregar.
- Una importación parcial puede borrar una cantidad ya editada → el update omite `quantity` cuando la fila no la informa.

## Migration Plan

`prisma db push` agrega la columna con default y genera el cliente. Validar localmente en `imanager_quantity_test`; Railway aplica el schema al iniciar el backend. Publicar a `hifi-desk`.

## Open Questions

Ninguna para #82: el usuario eligió cantidad editable por fila e inicialmente 1.
