## ADDED Requirements

### Requirement: Detalle definitivo del reclamo
El sistema SHALL mostrar la variante 2 aprobada con datos guardados del reclamo en todas las entradas y entornos, sin flags de QA ni variantes alternativas.

#### Scenario: Consulta de un reclamo
- **WHEN** se abre un reclamo desde Reclamos o Fallas
- **THEN** se muestra equipo/cliente junto al reloj de historial, estado compacto, fecha, IMEI y proveedor cuando existen, motivo y diagnóstico/resolución guardados cuando existen
- **AND** la hoja conserva encabezado y pie visibles a 1440 y 390 con scroll interno, sin editor ni seguimiento en línea

#### Scenario: Historial y edición
- **WHEN** se pulsa el reloj
- **THEN** se abre una segunda hoja por encima del detalle, pantalla completa con flecha en móvil, y al cerrar se devuelve el foco al reloj
- **WHEN** se elige Cambiar estado o Agregar nota
- **THEN** se abre el editor existente en la misma hoja, manteniendo permisos, borradores, persistencia y errores visibles

#### Scenario: Reclamo anulado o archivado
- **WHEN** se abre un reclamo anulado
- **THEN** se muestra el estado Anulado y solo la acción Cerrar
- **AND** los archivos históricos restaurables conservan Restaurar según los permisos existentes
