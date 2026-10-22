## Why
El dueño necesita auditar quién hizo qué, cuándo y sobre qué registro. #372 aprueba las cuatro referencias desktop/mobile y solicita implementar ese alcance.

## What Changes
- Separar persona, acción, registro e identificador, y hora; apilar en móvil.
- Fechas completas por día, período inicial de 30 días y filtros con valor visible.
- Detalle responsive con diferencias únicamente estructuradas y acceso real al registro.
- Incorporar IMEI completo desde inventario existente, sin cambios de Prisma.

## Capabilities
### New Capabilities
- `history-audit`: presentación y consulta del historial aprobado #372.

## Impact
Historial frontend, servicio de auditoría backend y tests. Sin cambios de AppContext ni escrituras de negocio.

## Non-goals
Control de stock #318, rediseñar navegación global, exportar auditorías, fabricar datos históricos o cambiar permisos. Commit en rama actual y sin push por instrucción del pedido.
