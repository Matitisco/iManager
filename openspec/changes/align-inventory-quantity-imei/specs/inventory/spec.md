## ADDED Requirements

### Requirement: Cantidad alineada e IMEI visible
La tabla de Inventario SHALL mostrar IMEI después de Equipo sin configuración previa. Cantidad fija y editable MUST compartir ancho y posición horizontal del contenido. El mensaje para equipos con IMEI SHALL ser exactamente «Este equipo tiene IMEI, así que cuenta como 1 unidad.».

#### Scenario: Inventario de equipos mixtos
- **WHEN** se abre Inventario con equipos con y sin IMEI
- **THEN** IMEI aparece después de Equipo, con «—» cuando falta, y las cantidades comparten ancho y alineación derecha, con el mismo espacio interior

#### Scenario: Cantidad fija por IMEI
- **WHEN** un equipo tiene IMEI
- **THEN** Cantidad muestra 1 sin input y el tooltip dice exactamente «Este equipo tiene IMEI, así que cuenta como 1 unidad.»
