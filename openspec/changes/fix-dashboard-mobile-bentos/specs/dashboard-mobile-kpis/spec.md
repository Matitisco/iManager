## ADDED Requirements

### Requirement: KPIs móviles alineados
El Dashboard SHALL mostrar los cuatro KPIs en dos columnas con igual altura y filas internas alineadas entre 360 y 480 px, sin separar moneda y monto ni agregar etiquetas.

#### Scenario: Montos grandes
- **WHEN** se muestran US$ 22,78M, US$ 651.280 y cantidades de cinco dígitos
- **THEN** los valores caben en una línea, etiqueta arriba y variación o progreso abajo, con el porcentaje del margen junto a la variación

#### Scenario: Escritorio y carga
- **WHEN** se abre el Dashboard en escritorio o se resuelven sus datos
- **THEN** se conserva el diseño de escritorio y se reserva la geometría móvil sin textos de carga nuevos
