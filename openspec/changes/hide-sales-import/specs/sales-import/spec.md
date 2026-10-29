## ADDED Requirements

### Requirement: Sales import frontend flag
El frontend SHALL ocultar toda entrada a importar ventas con `IMPORT_SALES_ENABLED=false` y conservar el código del importador.

#### Scenario: Disabled sales import
- **WHEN** el flag está desactivado en desktop o mobile
- **THEN** no se ofrece la acción ni se renderiza su overlay, tampoco desde aperturas programáticas

#### Scenario: Reenable sales import
- **WHEN** el flag se cambia a true
- **THEN** los accesos y el modal vuelven a estar disponibles

#### Scenario: Other imports
- **WHEN** el flag está desactivado
- **THEN** clientes e inventario conservan sus importadores
