# Equipo y permisos — issue #71

## Comportamiento

- Equipo se abre desde Configuración. Muestra miembros con un resumen de secciones, invitaciones pendientes con copiar link, compartir por WhatsApp y cancelar, y «Sumá a tu equipo» mientras sólo existe el Propietario.
- Roles persistidos: OWNER/Propietario, MANAGER/Socio, STAFF/Empleado. Propietario invita Socios o Empleados; Socio sólo invita y gestiona Empleados ajenos. No edita ni quita otros Socios, a sí mismo o al Propietario. Las protecciones del último Propietario siguen vigentes.
- Invitaciones por link, sin envío de email. El email opcional es una etiqueta; no limita qué cuenta acepta el enlace. Aceptar y cancelar usan el mismo lock de invitación. La aceptación crea la membresía y marca ACCEPTED en una transacción, con control de capacidad y vencimiento luego del lock.
- `/invite/:token` muestra tienda, persona que invitó, rol y vencimiento antes de autenticarse. Reutiliza los flujos Google/email existentes. Los errores técnicos permiten reintentar. Las invitaciones vencidas, usadas, revocadas o inexistentes muestran «Esta invitación ya no sirve».
- Un hash sin acceso conserva su URL y muestra «No tenés acceso», el nombre del propietario y «Volver al Dashboard». Pedir acceso es texto, sin notificación ni operación. Menús siguen ocultando módulos sin acceso. Facturación y Catálogo público siguen reservados al Propietario; «Mis comisiones» sigue disponible para cada persona.

## Decisiones

Los perfiles sólo cambian `sections`, nunca `role` ni `sensitiveAccess`:

| Perfil | Secciones |
| --- | --- |
| Vendedor | Dashboard, Inventario, Ventas, Canjes, Clientes, Cajas, Notificaciones |
| Técnico | Dashboard, Servicio técnico, Clientes, Notificaciones |
| Todo | Todas las secciones, incluyendo administración de Comisiones y saldo de cajas |
| Personalizado | Derivado cuando los switches no coinciden con otro perfil |

Apagar Cajas también apaga saldo de cajas y deshabilita su switch. Acciones sensibles se guarda por separado. Quitar del equipo requiere confirmación y conserva el diálogo ante un error.

Empleado con `sections = null` recibe Dashboard, Inventario, Ventas, Clientes, Canjes, Servicio técnico y Notificaciones. Al aceptar una invitación sin secciones se persiste esa lista explícita. Socio conserva los defaults anteriores (sin saldo de cajas ni administración de Comisiones). Una lista explícita, incluso vacía, se respeta.

Reportes deja de habilitar listas/categorías ajenas. El frontend sólo carga módulos autorizados y sólo ofrece sus reportes. Sin módulos autorizados muestra un estado vacío, sin generar 403 esperados. Catálogos GET y PUT filtran opciones y metadatos por sección; PUT requiere además rol distinto de STAFF. El provider conserva metadatos y opciones por defecto para tipos ausentes.

## API y schema

`GET /api/invitations/preview/:token` es público y devuelve 200 con:

- `{ status: "valid", storeName, role, expiresAt, inviterName }`
- `{ status: "expired" | "used" | "revoked" | "not_found" }`

`StoreInvitation.invitedById String?` guarda el ID de User del creador. Es nullable y no agrega relaciones obligatorias ni unicidades. Si una invitación anterior no tiene creador, o éste no tiene nombre, el preview usa el primer Propietario por fecha de creación. La sesión incorpora sólo `store.ownerDisplayName`, sin exponer el listado del equipo a Empleados.

Migración aditiva: `backend/prisma/migrations/20261017000000_invitation_creator/migration.sql`. Se siguió el mecanismo existente de migraciones SQL y `prisma db push`; `pre-push.sql` no requiere cambios para una columna nullable. `prisma generate` y `db push --skip-generate` se ejecutaron únicamente sobre `127.0.0.1:5432/imanager_test`.

## Validación

- Frontend: TypeScript, 834 tests Vitest y build de Vite aprobados.
- Backend: lint, 449 unitarios y 268 integraciones PostgreSQL aprobados.
- Nueve E2E relevantes aprobados: nuevos a 390 y 1440 px, Configuración, permisos de Reportes, autenticación por invitación y onboarding desktop/WebKit iPhone. Capturas revisadas en `/tmp/issue71-*.png`.
- Sin commit, push, ramas nuevas, PRs ni cambios en Railway. Los mockups se usaron sólo como referencia.
