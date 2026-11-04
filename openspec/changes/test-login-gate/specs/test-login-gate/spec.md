## ADDED Requirements

### Requirement: Gate opcional y compatible con Basic
El servidor SHALL deshabilitar el gate sin ambas variables, fallar cerrado con configuración parcial y admitir Authorization Basic válido.

#### Scenario: Producción sin variables
- **WHEN** BASIC_AUTH_USER y BASIC_AUTH_PASS están ausentes
- **THEN** el sitio conserva su acceso habitual sin gate

### Requirement: Login y sesión firmada
El gate SHALL mostrar login español sin scripts ni www-authenticate para navegación HTML, aceptar POST urlencoded hasta 8 KB y emitir cookie firmada de 30 días con atributos seguros. SHALL sanear next, rechazar firmas inválidas o vencidas y conservar throttling por socket.

#### Scenario: Login correcto
- **WHEN** POST /__login contiene credenciales válidas
- **THEN** responde 303 al next interno y entrega cookie HttpOnly Secure SameSite=Lax

#### Scenario: Acceso sin sesión
- **WHEN** falta autorización válida
- **THEN** GET /__login responde 200 HTML, otras navegaciones HTML 401 y recursos/API/helpers 401 plano, siempre sin cache

#### Scenario: Fallos o logout
- **WHEN** la cookie fue manipulada, venció o cambió la clave
- **THEN** no se sirve contenido protegido

#### Scenario: Cierre de sesión
- **WHEN** se solicita GET /__logout
- **THEN** se borra la cookie y se redirige sin cache a /__login
