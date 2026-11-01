## Why
Las tiendas de pruebas necesitan reiniciar sus datos de negocio sin perder cuentas, miembros ni configuración.

## What Changes
Agregar POST /admin/store-reset para platform admins, con rechazo de production (también con NODE_ENV=production si no hay nombre de Railway) y allowlist obligatoria STORE_RESET_ALLOWED_STORE_IDS. Validar tienda, OWNER y nombre exacto; exigir preview, confirmación y conteos actuales para aplicar. Borrar datos de Inventory, Sales, Clients, caja, reparaciones y módulos relacionados en una transacción serializable con postcondiciones y auditoría.

## Non-goals
Sin UI, cambios de schema Prisma, acceso a producción ni borrado de cuentas/configuración. Entrega exclusivamente contra test.

## Impact
Backend admin y tests de integración; sin nuevas dependencias; allowlist configurada fuera del repo exclusivamente en el deploy de test.
