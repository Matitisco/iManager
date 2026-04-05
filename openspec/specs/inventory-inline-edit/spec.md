### Requirement: Edición inline de celdas con doble click
La tabla de inventario SHALL permitir editar el valor de una celda haciendo doble click sobre ella, sin abrir el panel lateral.

#### Scenario: Activar edición inline
- **WHEN** el usuario hace doble click en una celda editable
- **THEN** aparece un input inline sobre la celda con el valor actual; la celda muestra un indicador de edición (borde redondeado)

#### Scenario: Guardar al confirmar
- **WHEN** el usuario presiona Enter o hace click fuera de la celda
- **THEN** el valor se guarda via PATCH al backend; el input se cierra después de que el API responde

#### Scenario: Cancelar con Escape
- **WHEN** el usuario presiona Escape mientras edita una celda
- **THEN** el input se cierra sin guardar; la celda vuelve al valor anterior

### Requirement: Actualización optimista sin flash visual
El sistema SHALL mostrar el nuevo valor inmediatamente al guardar, sin un flash del valor anterior mientras el API responde.

#### Scenario: Guardado con latencia de red
- **WHEN** el usuario guarda una celda y el backend tarda 500ms en responder
- **THEN** la celda muestra el nuevo valor desde el momento en que el usuario confirma; no se muestra el valor anterior durante la espera

### Requirement: Límite de 30 caracteres en campos de texto inline
Los inputs de edición inline de celdas de texto y nombres de columna SHALL tener un límite máximo de 30 caracteres.

#### Scenario: Input en límite
- **WHEN** el usuario escribe más de 30 caracteres en un input inline
- **THEN** el input no acepta más caracteres después del carácter 30
