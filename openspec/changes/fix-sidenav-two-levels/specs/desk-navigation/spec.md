## ADDED Requirements

### Requirement: Navegación de dos niveles
El escritorio SHALL mostrar grupos y destinos sin un tercer nivel, respetando permisos.

#### Scenario: Comercial y Análisis
- **WHEN** el dueño despliega los grupos
- **THEN** Comercial contiene exactamente Ventas, Canjes y Devoluciones; Patrones y Resumen periódico son destinos hermanos de Reportes en Análisis.

### Requirement: Patrones como pantalla independiente
Patrones SHALL abrir con título propio, permiso Ventas y agrupación Proveedor/Compra/Modelo dentro de la pantalla.

#### Scenario: Sin problemas o error
- **WHEN** la consulta no contiene grupos con problemas o falla
- **THEN** muestra un vacío corto o un error visible, respectivamente, sin contenido en blanco ni texto de carga.

### Requirement: Compatibilidad de enlaces
La navegación SHALL canonicalizar los enlaces antiguos conservando filtros y estado de historial.

#### Scenario: Enlace anterior a Patrones
- **WHEN** se abre returns?view=patterns con proveedor y agrupación
- **THEN** abre analisis/patrones con esos filtros y su destino activo.

### Requirement: Catálogo móvil unificado
Catálogo SHALL mostrar Equipos y Resumen dentro de una sola pantalla sin destinos anidados.

#### Scenario: URL anterior de Catálogo
- **WHEN** se abre Catálogo con view=items o view=summary
- **THEN** se muestra el contenido unificado.
