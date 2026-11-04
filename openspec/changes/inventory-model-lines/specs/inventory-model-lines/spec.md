## ADDED Requirements

### Requirement: Vista alternativa por línea

Inventory SHALL mantener la vista individual predeterminada y ofrecer Por línea por tienda, agrupando solo por modelo y capacidad después de aplicar todos los filtros.

#### Scenario: Alternar y filtrar

- **WHEN** se activa Por línea con búsqueda, estado, proveedor o archivados
- **THEN** solo los registros filtrados participan en grupos y en N modelos · M equipos

### Requirement: Orden y resúmenes

El sistema SHALL ordenar iPhone por generación, variante base/Plus-Mini/Pro/Pro Max y capacidad; otras marcas por marca y orden natural; desconocidos al final. SHALL sumar cantidades, contar disponibles, deduplicar colores, mostrar rango de precios conocidos y costo ponderado solo con permiso financiero.

#### Scenario: Precio pendiente y permisos

- **WHEN** un grupo mezcla precios conocidos y pendientes y el miembro no ve finanzas
- **THEN** el rango ignora pendientes y no se renderiza costo

### Requirement: Detalle desplegable

La fila SHALL mostrar tres registros al abrirse y permitir ver todos inline y abrir su detalle. SHALL adaptarse a móvil sin scroll horizontal y a ambos temas.

#### Scenario: Más de tres registros

- **WHEN** se abre un grupo de cinco unidades y se pulsa Ver las 5 unidades
- **THEN** se muestran las cinco con IMEI, color, condición, batería y estado
