## ADDED Requirements

### Requirement: Historial móvil con navegación de retorno
El sistema SHALL abrir los historiales de registros y reclamos en una pantalla completa con flecha de volver en móvil y una segunda hoja en escritorio.

#### Scenario: Volver al registro en móvil
- **WHEN** el usuario abre el historial a 390×844 y pulsa volver
- **THEN** el historial ocupa el viewport y al volver se conserva la hoja del registro y su estado

### Requirement: Identificar al comprador de una venta
El selector de ventas de nuevo reclamo SHALL mostrar el comprador asociado cuando la venta no incluye un nombre histórico.

#### Scenario: Venta con cliente vinculado
- **WHEN** una venta tiene clientId válido y clientName vacío
- **THEN** el selector muestra el nombre del cliente y conserva equipo y fecha
