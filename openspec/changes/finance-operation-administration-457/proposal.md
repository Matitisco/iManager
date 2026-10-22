## Why
Issue #457: Cajas mezcla operación y administración; Gastos no explica el paso a Caja; Proveedores prioriza acciones sobre origen y contacto.

## What Changes
Separar las acciones diarias de administración del dueño, presentar sesiones reales y fechas locales, resumen mensual de Gastos y ficha adaptable de Proveedores. Ocultar Finanzas al empleado sin revocar rutas autorizadas. Ampliar lecturas de sesiones y última compra mediante datos existentes.

## Capabilities
- finance-presentation: jerarquía, explicaciones contables y datos de lectura.
- desk-navigation: visibilidad de Finanzas por rol y aliases preservados.

## Impact
React desk, servicios cash/suppliers, tests y evidencia sintética. Sin cambios Prisma, migraciones, dependencias ni fórmulas.

## Non-goals
No vínculo gasto–egreso, escritura conjunta, estados de pago inferidos, apertura obligatoria para ventas, reasignaciones históricas ni cambios a cierres/compensaciones. Sin build, commit, push ni despliegue.
