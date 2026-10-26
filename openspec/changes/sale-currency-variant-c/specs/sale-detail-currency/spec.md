## ADDED Requirements

### Requirement: Importes coherentes en el detalle de venta
El detalle SHALL usar selector de moneda para todos sus importes, con el equivalente secundario cuando corresponde y hasta dos decimales.

#### Scenario: Venta USD en tienda ARS
- **WHEN** se abre una venta de US$ 100 con US$ 70 pendientes y cuotas residuales de US$ 20 y US$ 50
- **THEN** precio, deuda y cuotas comparten moneda principal y la misma cotización actual de la tienda

#### Scenario: Cotización no disponible
- **WHEN** no hay una cotización válida para convertir
- **THEN** se conserva cada importe en su moneda original y se informa que no hay equivalente disponible
