## ADDED Requirements

### Requirement: Catálogo administrado por propietario
La tienda SHALL disponer de Catálogo tras Inventario en desktop y primero en Más/Módulos móvil, con Resumen/Equipos. OWNER MUST elegir visibilidad, reglas, precio/moneda, activar/desactivar y regenerar link sin exportar filas.

#### Scenario: Ocultar equipo
- **WHEN** OWNER oculta un equipo individualmente o en lote
- **THEN** las lecturas públicas siguientes no incluyen ese equipo.

### Requirement: Lista pública segura
/c/:slug SHALL funcionar sin login con nombre/logo/contacto/ubicación, lista sin fotos, búsqueda/filtros y un único WhatsApp general flotante. La API MUST aplicar rate limit, no-store y proyectar sólo modelo/capacidad/color/condición/calidad/batería y precio opcional.

#### Scenario: Lectura anónima
- **WHEN** un lead abre un enlace activo
- **THEN** puede consultar sin sesión y no recibe costo, IMEI, serial, proveedor, customFields ni IDs internos.

#### Scenario: Revocación
- **WHEN** OWNER desactiva o regenera
- **THEN** el link desactivado no devuelve equipos y el link antiguo regenerado deja de resolver.

#### Scenario: Abuso
- **WHEN** una IP supera el límite de solicitudes
- **THEN** recibe 429 con Retry-After.
