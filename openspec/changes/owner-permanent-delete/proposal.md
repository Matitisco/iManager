## Why
El issue #703 requiere separar la baja lógica existente del borrado irreversible y reservar este último al dueño de la tienda.

## What Changes
- Agregar borrado definitivo para ventas, equipos, clientes, canjes y reparaciones ya anulados/archivados.
- Validar OWNER, pertenencia a la tienda y estado en backend; conservar los permisos y flujos actuales de baja lógica.
- Mostrar acción solo al dueño y pedir confirmación escrita BORRAR con identificación y consecuencias.
- Reutilizar auditoría transaccional; sin schema ni migraciones.

## Impact
Backend de cinco módulos, servicios HTTP, AppContext, detalles y menús Desk. Pruebas con PostgreSQL local exclusivo y datos ficticios; commit en rama actual sin push.

## Non-goals
Cambiar los permisos vigentes de baja lógica, eliminar datos mediante migraciones, modificar schema Prisma, ejecutar builds, desplegar o pushear.
