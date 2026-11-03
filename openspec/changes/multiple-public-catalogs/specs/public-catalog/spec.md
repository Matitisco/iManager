## ADDED Requirements

### Requirement: Catálogos por tienda
El sistema SHALL admitir hasta 10 catálogos por tienda con reglas y precios independientes.

#### Scenario: Catálogo previo
- **WHEN** existe StorePublicCatalog
- **THEN** su link y reglas se conservan en Clientes finales y no se permite borrar ese catálogo

### Requirement: Reglas de precio seguras
El sistema SHALL calcular porcentajes de lista, porcentajes de costo o precios manuales sin exponer costos.

#### Scenario: Precio manual ausente
- **WHEN** un equipo no tiene precio manual
- **THEN** se usa su precio de lista

#### Scenario: Sin permiso financiero
- **WHEN** canSeeFinancials es falso
- **THEN** no se permite consultar ni enviar configuración sobre costo, pero sí ver el precio resultante
