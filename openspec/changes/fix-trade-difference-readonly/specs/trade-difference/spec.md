## ADDED Requirements

### Requirement: Diferencia como resultado de solo lectura
El modal Nuevo canje SHALL mostrar Diferencia como texto calculado, sin input, borde ni fondo de campo editable, tanto en desktop como en mobile, conservando el cálculo y las validaciones existentes.

#### Scenario: Falta precio de salida
- **WHEN** todavía no hay precio de salida para calcular la diferencia
- **THEN** Diferencia muestra «Se calcula con el precio completo de salida» y no es un input

#### Scenario: Diferencia disponible
- **WHEN** el precio de salida y el valor tomado permiten calcular la diferencia
- **THEN** Diferencia muestra el mismo importe formateado que antes, incluyendo cero, y se actualiza al editar los precios
