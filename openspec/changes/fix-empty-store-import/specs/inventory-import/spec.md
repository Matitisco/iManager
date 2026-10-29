## ADDED Requirements

### Requirement: Conservación de calidad libre en planes manuales
El sistema SHALL conservar calidad y condición de texto libre como campos personalizados al aplicar planes manuales, con sus definiciones sugeridas, sin descartar equipos por esos valores. Los valores reconocidos SHALL conservar sus destinos nativos.

#### Scenario: Reasignación de calidad en tienda vacía
- **WHEN** se aplica el plan del fixture Natan 00 con la columna G asignada a grade o condition
- **THEN** se preparan y persisten los 59 equipos aceptables y se crea la definición de origen correspondiente

### Requirement: Confirmación de campos personalizados desde onboarding
El onboarding SHALL usar el mismo armado de filas de inventario que ImportHost y enviar las definiciones personalizadas recibidas del modal.

#### Scenario: Primer Excel con calidad personalizada
- **WHEN** se confirma un Excel con una columna custom:calidad_origen desde una tienda vacía
- **THEN** el payload contiene customFields.calidad_origen y su definición
