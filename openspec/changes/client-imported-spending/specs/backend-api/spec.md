## MODIFIED Requirements

### Requirement: Importación de clientes
El sistema SHALL conservar el importe histórico y su moneda separados de ventas registradas.

#### Scenario: Reimportación
- **WHEN** se importa dos veces el mismo cliente con histórico 2400 USD y existe una venta de 750 USD
- **THEN** el histórico permanece en 2400 USD y los comprobantes registrados suman 750 USD, sin incrementar deuda ni cantidad de compras

#### Scenario: Moneda inválida
- **WHEN** el importe histórico carece de moneda ARS/USD explícita
- **THEN** la fila informa un error y no se persiste como éxito
