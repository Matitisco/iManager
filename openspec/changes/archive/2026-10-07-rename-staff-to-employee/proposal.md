## Why

El issue #85 pide que el rol actualmente mostrado como Agente se llame Empleado en toda la interfaz. Algunas pantallas todavía muestran Vendedor para el mismo rol, lo que también debe quedar consistente.

## What Changes

- Mostrar Empleado para STAFF en invitaciones, equipo, perfil, navegación y selección de tienda.
- Actualizar la ayuda de invitaciones y las referencias visibles al empleado en la búsqueda de ventas.
- Aplicar el cambio en `hifi-desk`, según la indicación del usuario.

## Capabilities

### New Capabilities

- `staff-role-labels`: nombre visible consistente del rol STAFF.

## Impact

- Frontend: shell, Configuración, invitaciones, login, onboarding y selector de tienda.
- No requiere cambios de schema Prisma ni migraciones.

## Non-goals

- Cambiar identificadores de roles, permisos o lógica de negocio.
- Modificar el backend o los roles Propietario y Socio.
