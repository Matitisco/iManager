## ADDED Requirements

### Requirement: Recuperación al volver del popup de Google

El formulario de Auth MUST liberar la carga visual de Google al recuperar el foco o volver a estar visible, aunque Firebase todavía no haya resuelto el intento. La recuperación MUST funcionar tanto en login como en registro sin alterar el estado real de autenticación.

#### Scenario: Cierre con respuesta diferida
- **WHEN** el usuario vuelve al formulario después de cerrar Google y la promesa del SDK sigue pendiente
- **THEN** el botón de Google deja de cargar y permite reintentar
- **AND** el usuario puede usar el login por correo o crear una cuenta

#### Scenario: Regreso a una pestaña visible
- **WHEN** el formulario vuelve a estar visible mientras la promesa de Google sigue pendiente
- **THEN** el botón de Google recupera su estado normal

### Requirement: Aislamiento de reintentos

El formulario MUST permitir que solo el último intento de Google actualice sus errores y finalice su carga. Al desmontarse MUST limpiar sus listeners e invalidar respuestas pendientes.

#### Scenario: Respuesta tardía de un intento anterior
- **WHEN** el usuario reintenta y Firebase resuelve o rechaza el intento anterior
- **THEN** la respuesta anterior no modifica la carga ni el error del intento nuevo

#### Scenario: Formulario desmontado
- **WHEN** el formulario se desmonta con un intento pendiente
- **THEN** sus listeners se eliminan y las respuestas tardías no actualizan el formulario

### Requirement: Cancelaciones normales y errores reales

El formulario MUST tratar los errores de cierre o cancelación de popup como cancelaciones normales, y MUST continuar mostrando los mensajes de errores reales de Firebase.

#### Scenario: Popup cerrado o reemplazado
- **WHEN** Firebase rechaza con `auth/popup-closed-by-user` o `auth/cancelled-popup-request`
- **THEN** el formulario queda disponible sin presentar la cancelación como un error

#### Scenario: Popup bloqueado o error de red
- **WHEN** Firebase rechaza con un error de bloqueo o conexión
- **THEN** el formulario libera la carga y muestra el mensaje correspondiente
