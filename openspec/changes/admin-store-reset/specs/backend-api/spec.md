## ADDED Requirements

### Requirement: Scoped sales and inventory reset
El endpoint POST /admin/store-reset SHALL admitir exclusivamente platform admins también en producción, sin bloqueo por entorno ni allowlist de tiendas. SHALL resolver exactamente una tienda por storeEmail de OWNER activo y validar expectStoreName y expectStoreId exactos antes de modificar datos.

#### Scenario: Guardas de identidad
- **WHEN** email, nombre o ID no identifican la misma y única tienda con OWNER activo
- **THEN** responde 409 sin cambios

#### Scenario: Acceso administrativo
- **WHEN** falta autenticación o el token no pertenece a un platform admin con email verificado
- **THEN** responde 401 o 403 respectivamente sin cambios

#### Scenario: Preview Serializable
- **WHEN** un admin solicita dryRun true con guardas válidas
- **THEN** ejecuta el plan completo en Serializable, devuelve willDelete y willKeep por tabla, y revierte todas las mutaciones incluida la auditoría

#### Scenario: Aplicación con conteos exactos
- **WHEN** dryRun false incluye expect idéntico al mapa willDelete recalculado, con Sale e InventoryItem y todas las demás tablas
- **THEN** elimina únicamente ventas, stock, historial operativo de inventario y dependencias seleccionadas; ajusta saldos y registra store.reset dentro de la misma transacción

#### Scenario: Expect inválido o desactualizado
- **WHEN** falta expect o tiene claves/conteos diferentes de willDelete
- **THEN** responde 409 sin persistir cambios

#### Scenario: Preservación de clientes y módulos independientes
- **WHEN** se aplica el reset
- **THEN** conserva tienda, usuarios, miembros/empleados, clientes, configuración, billing, auditoría previa, numeración y datos independientes de reparaciones, gastos, proveedores y caja
- **AND** elimina la deuda de ventas, conserva saldo manual e historial importado del cliente y descuenta solo los movimientos de caja seleccionados

#### Scenario: Fallo de postcondición o auditoría
- **WHEN** cualquier borrado/ajuste causa un cambio en otra tienda, una fila preservada cambia o falla la auditoría
- **THEN** revierte la transacción completa y devuelve un error visible

#### Scenario: Propiedad ambigua o cotización ausente
- **WHEN** un cobro/seña está ligado a venta y reparación simultáneamente o falta una cotización histórica necesaria para separar saldos
- **THEN** responde 409 sin persistir cambios

#### Scenario: Modelos futuros
- **WHEN** un modelo nuevo con storeId o hijo de modelo borrable no tiene clasificación explícita
- **THEN** falla el test del DMMF y un modelo tenant sin clasificar deshabilita el reset
