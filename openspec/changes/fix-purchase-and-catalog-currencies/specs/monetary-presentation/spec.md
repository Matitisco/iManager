## ADDED Requirements

### Requirement: Total comprado consistente
El sistema SHALL mostrar el mismo Total comprado en lista y ficha, a partir de las mismas ventas y reparaciones válidas, excluyendo anulaciones y canjes recibidos. El formato SHALL usar la moneda de las operaciones y desglosar monedas distintas sin aplicar la moneda del saldo.

#### Scenario: Cliente con acumulador histórico en otra unidad
- **WHEN** un cliente tiene totalSpent 600, saldo sin moneda y una venta USD 600 con cotización ARS 1565
- **THEN** lista y ficha muestran $ 939.000, independientemente de la moneda del saldo

#### Scenario: Compras en varias monedas
- **WHEN** hay ventas o reparaciones válidas en ARS y USD
- **THEN** ambas vistas muestran subtotales separados por moneda y excluyen operaciones anuladas

### Requirement: Moneda del encabezado de catálogo
El sistema SHALL indicar moneda por equipo con ORIGINAL y la moneda de conversión con ARS/USD explícitos.

#### Scenario: Precio original USD en tienda ARS
- **WHEN** el catálogo conserva monedas originales y contiene un equipo USD
- **THEN** el encabezado indica precios en la moneda indicada en cada equipo y el precio conserva US$
