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
- **THEN** conserva el modal abierto y muestra según status: 404 «No encontramos este registro: puede que ya se haya borrado. Actualizá la pantalla.»; 403 «Solo el dueño de la tienda puede borrar definitivamente.»; 409 «Primero anulá o archivá el registro para poder borrarlo.»; red/otro «No se pudo borrar. Revisá tu conexión y reintentá.»
- **AND** solo en 404 retira el registro de la lista y caché local de la tienda actual, conservando su identidad y el error en el modal

#### Scenario: Pending deletion
- **WHEN** el borrado está en curso
- **THEN** muestra «Borrando…», deshabilita el botón principal, Cancelar y el input, impide cerrar y no permite enviar una segunda petición

#### Scenario: Permanent deletion URL
- **WHEN** solicita el borrado de cualquiera de las cinco entidades
- **THEN** envía DELETE a `${API_BASE}/api/<entidad>/<id>/permanent`, con el identificador codificado
