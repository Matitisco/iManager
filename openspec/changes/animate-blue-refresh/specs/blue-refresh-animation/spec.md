## ADDED Requirements

### Requirement: Animación del ícono de recarga del dólar Blue
El sistema SHALL girar únicamente el ícono del botón de recarga de la barra lateral durante la actualización solicitada por el usuario, conservando la presentación de cotizaciones y los colores del tema.

#### Scenario: Recarga con cotización existente
- **WHEN** el usuario recarga una cotización en caché
- **THEN** el ícono gira mientras la consulta está pendiente y se detiene al terminar con éxito o error

#### Scenario: Movimiento reducido
- **WHEN** el usuario tiene prefers-reduced-motion: reduce
- **THEN** el ícono permanece sin giro durante la consulta en modo claro y oscuro
