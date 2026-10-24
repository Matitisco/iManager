## ADDED Requirements

### Requirement: Análisis de Fallas
El sistema SHALL mostrar Fallas en Análisis y canonicalizar la ruta anterior conservando parámetros. SHALL calcular el porcentaje con equipos distintos con reclamos activos sobre todos los equipos no archivados y mostrar el motivo global más frecuente sin truncamiento ni duplicados.

#### Scenario: Rankings
- **WHEN** el usuario consulta Fallas
- **THEN** ve resumen y top 5 de proveedores, compras y modelos por porcentaje, cantidad y motivo, con Ver todos cuando hay más.

#### Scenario: Detalle
- **WHEN** activa una fila
- **THEN** se abre una hoja con hasta tres reclamos y acceso a la lista completa sin superar dos hojas simultáneas; en móvil el detalle se ajusta al contenido.

#### Scenario: Vacío y errores
- **WHEN** no hay datos o falla una consulta
- **THEN** ve una línea de vacío o error visible conservando resultados previos durante revalidación y aislando sesiones.
