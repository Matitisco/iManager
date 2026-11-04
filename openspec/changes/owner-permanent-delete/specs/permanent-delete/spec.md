## ADDED Requirements

### Requirement: Owner-only permanent deletion
El backend SHALL permitir borrar definitivamente ventas, equipos, clientes, canjes y reparaciones solo al OWNER actual de la tienda y solo si el registro ya está anulado o archivado.

#### Scenario: Non-owner request
- **WHEN** STAFF o MANAGER solicita borrado definitivo, incluso con sensitiveAccess
- **THEN** devuelve 403 sin cambios

#### Scenario: Active record
- **WHEN** OWNER solicita borrar un registro activo
- **THEN** devuelve 409 sin cambios

#### Scenario: Previously voided or archived record
- **WHEN** OWNER solicita borrar un registro de su tienda con baja lógica previa
- **THEN** borra físicamente el registro y registra auditoría atómica sin repetir efectos económicos

#### Scenario: Other store
- **WHEN** OWNER solicita borrar un registro ajeno
- **THEN** devuelve 404 sin cambios

### Requirement: Explicit irreversible confirmation
La UI SHALL ofrecer Borrar definitivamente solo al OWNER para registros con baja previa y exigir escribir BORRAR.

#### Scenario: Confirmation
- **WHEN** el dueño abre la acción
- **THEN** muestra nombre/identificador y consecuencias irreversibles, y habilita el botón solo al escribir BORRAR

#### Scenario: Persistence failure
- **WHEN** falla el borrado
- **THEN** conserva el modal abierto y muestra el error sin retirar el registro
