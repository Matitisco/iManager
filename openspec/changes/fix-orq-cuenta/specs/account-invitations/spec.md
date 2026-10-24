## ADDED Requirements

### Requirement: Validación consistente de email opcional
El formulario SHALL validar el email antes de crear o copiar una invitación y SHALL asociar el error al campo sin cerrar la hoja ni llamar al backend ante un email inválido.

#### Scenario: Email inválido en cualquier acción
- **WHEN** se solicita crear o copiar una invitación con un email inválido
- **THEN** se muestra «Ingresá un email válido.» en el campo y no se crea ni copia un link

#### Scenario: Email opcional o corregido
- **WHEN** el usuario deja el email vacío o corrige el valor inválido
- **THEN** ambas acciones permiten crear el link con el rol y permisos seleccionados

### Requirement: Avatares neutros del equipo
La lista de equipo SHALL usar los tokens neutros existentes para sus avatares.

#### Scenario: Lista de integrantes
- **WHEN** se muestra Configuración o Equipo
- **THEN** los avatares conservan iniciales y geometría sobre superficie neutra con texto principal
