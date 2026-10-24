## Why
El QA visual de Cuenta encontró que «Copiar link de invitación» omite la validación de email de «Crear link»: envía datos inválidos y recibe HTTP 400. Equipo también conserva avatares azules/rosas incompatibles con los tokens aprobados.

## What Changes
- Unificar validación de email opcional antes de crear o copiar una invitación, con error asociado al campo.
- Usar superficies y texto neutros existentes para avatares del equipo.
- Conservar roles, permisos, payload, persistencia y demás pantallas.

## Capabilities
### New Capabilities
- `account-invitations`: validación consistente de las acciones de invitación.
### Modified Capabilities
Ninguna.

## Non-goals
No rediseño general, migración de selects de onboarding, backend, Prisma ni cambios de fuentes de datos.

## Impact
Solo `src/desk/overlays/account.tsx`, pruebas de invitaciones y `src/desk/screens/team.css`. Sin backend, schema ni componentes compartidos.
