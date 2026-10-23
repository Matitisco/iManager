## ADDED Requirements

### Requirement: Patrones de devoluciones
El sistema SHALL mostrar los grupos y métricas de GET returns/patterns con acceso a Devoluciones, respetando hot y topReason del backend.

#### Scenario: Agrupar y consultar
- **WHEN** se elige Patrones y Proveedor, Compra o Modelo
- **THEN** se muestran nombre, equipos con problemas, porcentaje y barra, con reclamos expandibles, estado y aviso de motivo cuando existe topReason.

#### Scenario: Navegar desde proveedor
- **WHEN** un usuario con acceso a Devoluciones activa el aviso de problemas de Ver proveedor
- **THEN** se abre Patrones por Proveedor con ese proveedor seleccionado.

#### Scenario: Carga, vacío y permisos
- **WHEN** la consulta está pendiente, vacía o falla
- **THEN** se muestra skeleton pendiente y se omite contenido vacío o fallido sin relleno ni Reintentar; los detalles de proveedor/compra requieren Inventario y sus costos requieren canSeeFinancials.
