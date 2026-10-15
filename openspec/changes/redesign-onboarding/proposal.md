## Why
La primera sesión debe mostrar stock valorizado con una sola bienvenida y sin pedir datos innecesarios. Implementa #344 e integra #339 y #340 con los diseños aprobados.

## What Changes
- Nombre de tienda → video opcional → invitación opcional → carga de stock con revisión obligatoria y alternativas existentes.
- Primeros pasos persistentes, invitaciones, instalación y video opcional desde Ayuda.
- Datos de ejemplo marcados por servidor y borrado exclusivo de esos registros.
- Prisma aditivo: fechas nullable de onboarding, preferencias de membresía defaulted y marca nullable de muestras.

## Non-goals
No exportación de filas, nuevo importador, nuevas invitaciones ni cambios al onboarding de cuentas existentes.

## Impact
Onboarding, Inventory, Dashboard, AppContext, Ayuda y backend Fastify/PostgreSQL.
