## ADDED Requirements

### Requirement: Selector visible con cualquier cantidad de tiendas

El shell SHALL mostrar la tarjeta D1 y permitir abrir el selector con una o varias tiendas.

#### Scenario: Una tienda en cualquier viewport o tema

- **WHEN** un usuario tiene una tienda y abre el selector
- **THEN** ve su tienda actual seleccionada con el mismo diseño D1 disponible en multitienda
- **AND** si kind es null el avatar es neutro y no hay pill de tipo

### Requirement: Acceso a activación de multitienda

El selector SHALL ofrecer Agregar tienda solo al OWNER que puede activar multitienda.

#### Scenario: Owner con tienda sin grupo

- **WHEN** selecciona Agregar tienda
- **THEN** abre Cuenta/Configuración y el formulario de tienda desplaza y enfoca EnableStoreGroupCard

#### Scenario: Empleado o grupo existente

- **WHEN** un empleado abre el selector o un owner tiene un grupo configurado
- **THEN** no aparece la acción de activación
- **AND** las opciones existentes de tienda y Balance conservan su comportamiento
