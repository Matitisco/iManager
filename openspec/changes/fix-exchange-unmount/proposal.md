## Why
CI registra un rechazo no manejado cuando una cotización termina después de desmontar DeskApp e intenta actualizar el estado de React con el entorno ya destruido.

## What Changes
- Cancelar consultas de cotización e invalidar respuestas pendientes al desmontar o cambiar la configuración.
- Cubrir respuestas tardías y cambios de configuración con regresiones deterministas.
- Repetir la suite completa de frontend y crear un commit en español, sin push.

## Capabilities
### New Capabilities
- `exchange-lifecycle`: limpieza de consultas y temporizadores de cotización.

## Impact
Proveedor de cotización, consulta de fuentes externas y pruebas de frontend. Sin cambios visuales ni de persistencia del negocio.

## Non-goals
No modificar módulos de ventas/caja ni el schema Prisma. No ejecutar build ni publicar cambios remotos.
