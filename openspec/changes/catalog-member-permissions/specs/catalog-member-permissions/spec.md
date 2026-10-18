## ADDED Requirements

### Requirement: Catálogo por miembro
El sistema MUST permitir acceso al catálogo al propietario y a miembros con publicCatalog guardado explícitamente.

#### Scenario: Acceso explícito y navegación
- **WHEN** un empleado o gerente tiene publicCatalog en sections
- **THEN** puede abrir y editar el catálogo y verlo primero en Más, sin incluirlo en la barra inferior

#### Scenario: Acceso denegado por defecto
- **WHEN** un miembro sin permiso guardado abre #catalogo
- **THEN** ve No tenés acceso sin redirección y la API responde 403

### Requirement: Acciones exclusivas del propietario
El sistema MUST reservar regeneración del enlace y cambios del estado activo al propietario, permitiendo crear un catálogo inexistente.

#### Scenario: Empleado con permiso
- **WHEN** un empleado con permiso edita reglas o visibilidad
- **THEN** puede guardar sin enviar active y no ve acciones para regenerar o desactivar

#### Scenario: Restricción en API
- **WHEN** un miembro intenta regenerar o cambiar active de un catálogo existente
- **THEN** la API responde 403 y conserva el catálogo
