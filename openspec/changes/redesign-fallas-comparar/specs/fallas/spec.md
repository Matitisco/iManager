## ADDED Requirements

### Requirement: Comparación responsive de Fallas
La pantalla SHALL usar datos reales y conservar universo, orden, permisos y navegación actuales.

#### Scenario: Escritorio con reclamos
- **WHEN** hay equipos afectados
- **THEN** muestra cuatro métricas, tres rankings con tres filas y Ver todos cuando corresponda, y dos reclamos recientes con acceso a su ficha.

#### Scenario: Móvil con reclamos
- **WHEN** el viewport es móvil
- **THEN** muestra dos métricas, chips Proveedores/Modelos/Compras y solo el ranking seleccionado, sin reserva de dock por lista.

#### Scenario: Incidencia positiva pequeña
- **WHEN** el backend entrega porcentaje cero con equipos afectados
- **THEN** el resumen, ranking y detalle muestran <1% y conservan el conteo y denominador.

#### Scenario: Vacío y permisos
- **WHEN** no hay equipos afectados o faltan permisos
- **THEN** muestra el vacío breve sin métricas ni rankings, o impide consultar y abrir datos sin autorización respectivamente.
