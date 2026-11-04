## ADDED Requirements

### Requirement: Presentación de centavos USD
El sistema SHALL mostrar los importes USD con hasta dos decimales en Ventas, Dashboard y detalle, completando dos cifras cuando el valor tenga fracción, sin modificar el importe original ni su cálculo.

#### Scenario: Accesorios con centavos
- **WHEN** una venta contiene USD 25,8, 1,5 o 1,6
- **THEN** la presentación muestra US$ 25,80, US$ 1,50 o US$ 1,60 respectivamente

#### Scenario: Enteros y pesos
- **WHEN** se muestra un importe USD entero o un importe ARS
- **THEN** los enteros USD conservan su estilo sin ceros decimales y ARS conserva su formato actual
