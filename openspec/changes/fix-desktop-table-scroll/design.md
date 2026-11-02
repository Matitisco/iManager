# Diseño

Reutilizar `dtable-scroll` con una clase explícita `desktop-table-scroll` en las cuatro ramas de presentación de escritorio. Encerrar únicamente la tabla para conservar encabezado y paginador fuera del desplazamiento. Dar al contenedor ancho máximo del 100%, overflow horizontal automático y desplazamiento táctil WebKit. Usar un mínimo de 980 px en las tablas, conservando width: 100% en pantallas amplias. La clase explícita prevalece sobre los resets de CSS bajo 760 px cuando se solicita escritorio en un viewport angosto; las ramas móviles no la renderizan.

Validar geometría y desplazamiento real con navegador y datos ficticios: escritorio forzado a 470 px, escritorio normal y móvil real. Correr TypeScript frontend/backend y pruebas relacionadas, sin build. Entregar en fix/ventas-scroll-x mediante PR contra test; no tocar main.
