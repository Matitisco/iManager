## ADDED Requirements

### Requirement: Total de equipos y desglose por estado
El resumen de Inventario SHALL mostrar «Equipos» con el total no archivado de todos los estados y debajo un desglose pequeño sin estados en cero, también en móvil. SHALL conservar los cálculos financieros existentes.

#### Scenario: Importación de 59 equipos
- **WHEN** existen 23 disponibles, 30 en revisión y 6 vendidos sin archivar
- **THEN** la tarjeta muestra 59 y «23 disponibles · 30 en revisión · 6 vendidos», coincidiendo con «59 de 59» en Todos

#### Scenario: Archivados, filtros y paginación
- **WHEN** se archivan equipos o se cambia búsqueda, filtro o página
- **THEN** el KPI excluye archivados y mantiene el total global no archivado independientemente de la vista

#### Scenario: Estados y vacío
- **WHEN** hay reservados, estados personalizados, estados vacíos o inventario vacío
- **THEN** cada equipo no archivado cuenta una vez, el estado vacío cuenta como disponible, se conservan estados personalizados y no se muestran estados con cero
