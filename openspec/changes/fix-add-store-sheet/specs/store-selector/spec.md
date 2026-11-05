## MODIFIED Requirements

### Requirement: Acceso a activación de multitienda
El selector SHALL ofrecer Agregar tienda solo al OWNER que puede activar multitienda.

#### Scenario: Owner con tienda sin grupo
- **WHEN** selecciona Agregar tienda desde desktop o móvil
- **THEN** abre un sheet dedicado vacío con nombre requerido (máximo 120), tipo requerido para la nueva tienda, dirección e Instagram opcionales
- **AND** explica que la tienda actual quedará con el tipo opuesto
- **AND** no abre Configuración ni muestra sus campos

#### Scenario: Alta y selección
- **WHEN** confirma datos válidos
- **THEN** crea la otra tienda con currentKind opuesto al tipo elegido y contacto normalizado
- **AND** selecciona la nueva tienda, aplica su sesión, muestra un toast, navega a dashboard y cierra el sheet

#### Scenario: Error de validación o persistencia
- **WHEN** falta nombre o tipo, Instagram es inválido o falla la API
- **THEN** muestra un error y conserva el formulario abierto
- **AND** si el alta ya se guardó pero falla activar, permite reintentar la selección sin crear otra tienda

#### Scenario: Empleado o grupo existente
- **WHEN** un empleado abre el selector o un owner tiene un grupo configurado
- **THEN** no aparece la acción de activación
- **AND** la tarjeta secundaria de Cuenta y las opciones existentes de tienda y Balance conservan su comportamiento
