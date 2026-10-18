## ADDED Requirements

### Requirement: Dashboard compartido
El dashboard de cuenta nueva SHALL usar el encabezado, flujo sugerido, métricas y listados del dashboard actual, con datos reales y los estados vacíos aprobados.

#### Scenario: Cuenta sin operaciones
- **WHEN** una cuenta nueva abre Dashboard sin ventas ni canjes
- **THEN** ve «¿Qué hay para hoy?», el flujo, cuatro métricas y cajas vacías con acciones para registrar venta y nuevo canje

### Requirement: Isla responsive y cierre persistente
La isla SHALL conservar sus capas y offsets, usar panel desktop de 360px, anillo móvil de 52px con nombre accesible y progreso amarillo.

#### Scenario: Completar los pasos
- **WHEN** el progreso pasa de incompleto a 5/5 durante la sesión
- **THEN** muestra «Listo · 5/5» cuatro segundos y permanece oculta incluso al recargar

#### Scenario: Progreso completo al cargar
- **WHEN** el progreso ya es 5/5 al cargar
- **THEN** no aparece la isla
