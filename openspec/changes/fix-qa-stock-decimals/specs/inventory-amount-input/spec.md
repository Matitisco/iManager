## ADDED Requirements

### Requirement: Importes manuales fieles
El sistema MUST interpretar importes de equipos en formato AR y US sin eliminar decimales.

#### Scenario: Alta y edición con centavos
- **WHEN** se ingresa costo 450,25 y precio 600,50, o sus equivalentes con punto decimal
- **THEN** MUST guardar 450.25 y 600.50 en la moneda activa

#### Scenario: Agrupación de miles
- **WHEN** se ingresa 1.200,50 o 1,200.50
- **THEN** MUST guardar 1200.50

#### Scenario: Cambio ajeno a importes
- **WHEN** se cambia solo color en un equipo de otra moneda
- **THEN** MUST conservar exactamente monto y moneda originales
