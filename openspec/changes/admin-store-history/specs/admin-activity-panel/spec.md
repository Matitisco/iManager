## ADDED Requirements

### Requirement: Historial legible y privado
El panel SHALL mostrar acciones recientes primero, fecha/hora de Buenos Aires, usuario y rol, filtros por tipo y fechas y cargar más. SHALL excluir datos de clientes e importes, conservando el acceso admin existente.

#### Scenario: Acceso y lectura
- **WHEN** un admin abre una tienda
- **THEN** ve el historial sin acciones de escritura ni propiedades privadas

#### Scenario: Acceso denegado
- **WHEN** un usuario autenticado sin acceso admin solicita historial
- **THEN** recibe 403 sin datos

### Requirement: Fuentes combinadas
El backend SHALL combinar auditoría/BD y PostHog, deduplicando operaciones coincidentes. La clave SHALL permanecer en backend y no aparecer en logs/respuestas.

#### Scenario: PostHog no disponible
- **WHEN** falta configuración o PostHog falla
- **THEN** se muestran acciones de BD y un aviso discreto

### Requirement: Última acción
La lista SHALL mostrar qué pasó y cuándo en la última acción conocida por tienda.

#### Scenario: Tienda con navegación reciente
- **WHEN** una visita de PostHog es posterior a la última modificación de BD
- **THEN** la última acción refleja esa visita
