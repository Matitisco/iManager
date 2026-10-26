## MODIFIED Requirements

### Requirement: Agrupaciones completas y resumen histórico
El análisis SHALL incluir equipos sin proveedor o compra en grupos `none`, con etiquetas explícitas e IDs de origen nulos, y SHALL contar reclamos abiertos sin incluir resueltos/cerrados.

#### Scenario: Reclamo resuelto sin origen
- **WHEN** hay 268 equipos y un reclamo resuelto sin proveedor ni compra
- **THEN** cada agrupación contabiliza el equipo, el resumen informa un reclamo y cero abiertos y no ofrece ver un origen inexistente.

## ADDED Requirements

### Requirement: Vacío ilustrado V2
Las tarjetas SHALL estirar a la misma altura, conservar contenido arriba y centrar el vacío sin borde con ícono de 24 px, título «Sin reclamos» y explicación breve. Las barras positivas SHALL ser visibles y los motivos SHALL conservar su escritura.

#### Scenario: Agrupación vacía
- **WHEN** una agrupación no contiene equipos con reclamos
- **THEN** muestra el vacío ilustrado sin caja anidada en escritorio y móvil.
