## ADDED Requirements

### Requirement: Invitaciones ligadas a email verificado
El backend SHALL aceptar invitaciones con email solo cuando auth.emailVerified es true y auth.email coincide tras trim + lowercase. SHALL conservar +tags, puntos y dominios sin equivalencias especiales. SHALL rechazar de forma genérica sin revelar destinatarios ni existencia de cuentas y sin consumir la invitación. SHALL conservar expiración y uso único. Los enlaces sin email SHALL conservar su comportamiento existente hasta decisión explícita.

#### Scenario: Coincidencia verificada
- **WHEN** el token contiene email verificado coincidente, incluso con mayúsculas o espacios externos
- **THEN** se crea la membresía y se consume la invitación una sola vez

#### Scenario: Identidad no habilitada
- **WHEN** el token tiene otro email, falta email o falta verificación
- **THEN** responde el mismo 403 genérico y no crea membresía ni consume la invitación

#### Scenario: Recuperación en frontend
- **WHEN** el servidor rechaza la identidad
- **THEN** la UI explica que la invitación requiere el email invitado y verificado, conserva el enlace y permite cambiar de cuenta

#### Scenario: Enlace sin email
- **WHEN** una invitación no tiene email
- **THEN** conserva aceptación por posesión del enlace, expiración y consumo único
