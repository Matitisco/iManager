## ADDED Requirements

### Requirement: Fallos discretos de consulta
Las consultas secundarias indicadas SHALL omitir avisos rojos, alertas y botones Reintentar, y registrar la causa con console.warn.

#### Scenario: Consulta secundaria fallida
- **WHEN** falla una consulta secundaria de señas, primeros pasos, vendedores o contadores
- **THEN** el resto de la interfaz sigue disponible sin aviso de error local

### Requirement: Contenido principal disponible como vacío
Las consultas de contenido principal SHALL mostrar un vacío neutral ante fallos y SHALL conservar visibles los errores de acciones.

#### Scenario: Fallo de contenido principal
- **WHEN** falla la consulta del catálogo, resumen, selector de vendedores o archivados
- **THEN** se muestra un vacío neutral sin alerta ni reintento manual

#### Scenario: Acción fallida
- **WHEN** falla un guardado, pago, envío o eliminación
- **THEN** se conserva el aviso de error y el formulario abierto
