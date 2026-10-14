## ADDED Requirements

### Requirement: Mensajes de error de solicitudes en español
El frontend SHALL mostrar errores de solicitudes comprensibles en español en todas las vistas desktop y móviles, sin texto técnico del navegador.

#### Scenario: Sin conexión
- **WHEN** fetch falla por red en Chrome, Safari o Firefox, o el navegador está offline
- **THEN** muestra exactamente «No hay conexión. Revisá tu internet y probá de nuevo.»

#### Scenario: Timeout
- **WHEN** vence el plazo de una solicitud
- **THEN** muestra exactamente «La solicitud tardó demasiado. Probá de nuevo.»

#### Scenario: Error de servidor
- **WHEN** una respuesta HTTP tiene status 5xx
- **THEN** muestra exactamente «Ocurrió un error en el servidor. Probá de nuevo en unos minutos.»

#### Scenario: Validación del backend
- **WHEN** una respuesta HTTP 4xx incluye un mensaje en español
- **THEN** conserva ese mensaje y el status de la respuesta

#### Scenario: Persistencia fallida
- **WHEN** falla la eliminación de un canje
- **THEN** el diálogo permanece abierto con el error traducido y permite reintentar
