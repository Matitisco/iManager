## ADDED Requirements

### Requirement: Sesiones y consumo protegidos
La API MUST rechazar sesiones revocadas y limitar intentos por IP y por usuario verificado sin compartir la cuota de usuario entre empleados.

#### Scenario: Sesión revocada
- **WHEN** Firebase informa revocación o usuario deshabilitado
- **THEN** la API devuelve 401 sin contexto de negocio.

#### Scenario: Abuso de rutas sensibles
- **WHEN** se excede la cuota de una operación
- **THEN** la API devuelve 429 con Retry-After antes del trabajo protegido.

#### Scenario: Configuración parcial de Basic Auth
- **WHEN** se configura solo una credencial del gate opcional
- **THEN** el servidor no habilita acceso público silenciosamente.
