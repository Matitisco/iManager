## Why

iManager solo soporta un usuario por tienda. Dueños de tiendas necesitan que socios, administradores y vendedores accedan a la misma data sin compartir credenciales. El modelo `StoreMember` ya existe en el schema, solo falta el flujo de invitación y la gestión de equipo.

## What Changes

- **Nuevo modelo `StoreInvitation`** en Prisma: token único, email invitado, rol asignado, expiración (7 días), estado (PENDING/ACCEPTED/REVOKED).
- **Nuevo módulo backend `/api/invitations`**: crear invitación, listar pendientes, revocar, aceptar por token.
- **Modificación del flujo Onboarding**: si la URL contiene un token de invitación válido, el usuario se une a la tienda invitada en lugar de crear una nueva.
- **Nueva pestaña "Equipo" en Settings**: lista de miembros con roles, lista de invitaciones pendientes, modal de invitación, gestión de roles.
- **Roles con nombres visibles en español**: OWNER → Propietario, ADMIN → Socio, SELLER → Vendedor.
- **Gestión de roles**: Owner y Admin pueden cambiar el rol de otros miembros (con restricciones: no puede haber 0 Propietarios, no se puede degradar al único Owner).

## Capabilities

### New Capabilities

- `store-invitations`: Crear y gestionar invitaciones de acceso a una tienda mediante token. Incluye crear, listar, revocar y aceptar invitaciones.
- `team-management`: Ver y gestionar los miembros del equipo de una tienda — listar, cambiar roles, remover miembros.
- `invite-onboarding`: Flujo alternativo de Onboarding donde el usuario acepta una invitación existente en lugar de crear una nueva tienda.

### Modified Capabilities

- `onboarding`: El flujo de Onboarding detecta un token de invitación en la URL y lo acepta en lugar de crear una nueva Store.

## Impact

- **Schema Prisma**: nuevo modelo `StoreInvitation`. Requiere migración.
- **Backend**: nuevo módulo `invitations/` con 4 endpoints + middleware de autorización por rol.
- **Frontend**: `src/pages/Settings.tsx` (nueva pestaña), `src/pages/Onboarding.tsx` (detección de token), nuevo `src/services/invitations-api.ts`, `AppContext.tsx` (rol del usuario en sesión para condicionar UI).
- **Non-goals**: notificaciones por email (SMTP), gestión de múltiples tiendas por usuario en la UI (el schema lo soporta pero la UI no lo expone), permisos granulares por módulo (los roles son globales por tienda).
