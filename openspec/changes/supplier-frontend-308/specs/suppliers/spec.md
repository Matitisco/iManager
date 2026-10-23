## ADDED Requirements

### Requirement: Historial y detalle responsive
El sistema SHALL mostrar cantidad, última compra y problemas por proveedor, tres compras en la ficha y todas mediante una segunda capa si hay más de tres. Los datos faltantes SHALL omitirse.

#### Scenario: Abrir una compra
- **WHEN** el usuario abre una compra
- **THEN** se muestran equipos, IMEI y estado de problema; costos y totales solo con permiso financiero, con regreso a la ficha en móvil.

### Requirement: Carga con origen fijo
El sistema SHALL reutilizar alta e importación de Inventario con proveedor fijo, conservando errores y refrescando la ficha después de persistir.

#### Scenario: Error de guardado
- **WHEN** falla el alta o importación
- **THEN** el formulario conserva el borrador y muestra el error sin cerrar como éxito.
