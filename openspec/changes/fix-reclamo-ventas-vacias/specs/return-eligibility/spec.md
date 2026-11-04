## ADDED Requirements

### Requirement: Reclamos independientes del cobro
El sistema SHALL ofrecer ventas COMPLETADA y PENDIENTE activas en mobile y desktop, incluyendo importadas/corregidas, USD/ARS, con/sin cliente y empleados con permiso de ventas.

#### Scenario: Corrección administrativa deja diferencia pendiente
- **WHEN** una corrección incrementa el importe sin cobrar la diferencia
- **THEN** la venta sigue disponible para reclamo sin alterar la deuda ni permitir reintegrar dinero no cobrado

### Requirement: Cantidades parciales
El sistema SHALL permitir reclamar unidades enteras hasta el remanente vendido y limitar stock y compensación a las unidades reclamadas.

#### Scenario: Una unidad de cinco
- **WHEN** se devuelve una unidad de una venta de cinco
- **THEN** solo esa unidad vuelve a stock, quedan cuatro reclamables y el reintegro no supera su valor ni el cobro disponible
