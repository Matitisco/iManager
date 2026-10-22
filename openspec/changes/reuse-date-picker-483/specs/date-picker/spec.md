## ADDED Requirements

### Requirement: Selector de fechas compartido
La aplicación SHALL usar el selector existente de Ventas y Reportes en cada campo que solicita una fecha y SHALL conservar los formatos enviados al backend.

#### Scenario: Reclamos y clientes
- **WHEN** se abre Fecha del reclamo o Cumpleaños
- **THEN** aparece el mismo calendario con navegación de mes/año, selección de día, Hoy y Borrar
- **AND** una selección emite YYYY-MM-DD sin conversión horaria

#### Scenario: Otros campos nativos
- **WHEN** se elige fecha de gasto, vigencia, primer vencimiento o Desde/Hasta de Caja
- **THEN** se usa el mismo componente y se conserva el contrato de persistencia

### Requirement: Interacción y validación
El selector SHALL respetar campos opcionales, bloqueo, validación, teclado y límites del viewport.

#### Scenario: Fechas inválidas y vacías
- **WHEN** se escribe una fecha imposible o parcial
- **THEN** no se envía al backend y se muestra un error al confirmar
- **AND** Cumpleaños vacío continúa guardándose como null y filtros vacíos permanecen permitidos

#### Scenario: Calendario en un modal
- **WHEN** se abre el calendario en 1440 o 390 píxeles y se desplaza el formulario
- **THEN** el panel permanece dentro del viewport y anclado al campo
- **AND** Escape cierra primero el calendario y devuelve el foco al campo
