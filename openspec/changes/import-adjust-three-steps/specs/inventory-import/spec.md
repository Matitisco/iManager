## ADDED Requirements

### Requirement: Ajuste progresivo de inventario
El sistema SHALL presentar Archivo, Columnas y Resumen dentro de Ajustar importación, conservando la etapa externa mapping y la importación existente.

#### Scenario: Navegación y configuración
- **WHEN** se abre Ajustar importación
- **THEN** Archivo permite seleccionar hojas y encabezado y Siguiente abre Columnas; Resumen ofrece Anterior e Importar con las validaciones existentes.

### Requirement: Pendientes estables y corrección de destinos
El sistema SHALL mostrar en Columnas las descartadas con datos en el rango activo y todas las descartadas mientras falte Modelo, conservando las tarjetas visibles hasta salir del paso.

#### Scenario: Revisión sin saltos
- **WHEN** se asigna una pendiente a un campo existente, personalizado o Descartar
- **THEN** la tarjeta sigue visible con su destino actualizado y conserva tres muestras y validaciones de campos nuevos.

#### Scenario: Resumen editable
- **WHEN** se abre Resumen
- **THEN** agrupa columnas de la hoja activa en Campos existentes, Campos nuevos y Descartadas con contador e indicación de datos, y cada fila permite volver a Columnas con esa columna visible.

#### Scenario: Modelo faltante
- **WHEN** falta Modelo
- **THEN** se muestra el aviso y se bloquea Importar; el acceso al campo obligatorio abre Columnas y enfoca una candidata.
