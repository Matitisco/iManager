## Decisions
La fase del proveedor permanece ready durante las recargas con caché. Exponer la promesa existente de refresh permite al botón mantener un estado local durante la consulta sin cambiar esa fase ni otros consumidores.

El manejador activa el giro antes de esperar refresh y lo desactiva en finally. Conserva el comportamiento de clics sucesivos: solo la última solicitud puede detener el giro. Solo el SVG recibe la clase de animación. Una media query prefers-reduced-motion: no-preference habilita la rotación; los colores actuales se heredan en ambos temas.

## Validation
Pruebas con ExchangeProvider real y fetch controlado cubren inicio, respuesta exitosa, error y reintento con caché. Chromium verifica animación del SVG, ausencia de animación del botón y movimiento reducido en modo claro y oscuro. Lint frontend/backend y pruebas relacionadas, sin build ni acceso a bases de datos.
