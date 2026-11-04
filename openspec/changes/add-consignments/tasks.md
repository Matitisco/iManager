# Tasks

- [x] Schema y migración estrictamente aditiva.
- [x] Servicio y rutas con aislamiento por tienda, bloqueo de stock y cierre atómico.
- [x] API frontend y AppContext con aislamiento de sesión.
- [x] Navegación Comercial, tarjetas, alta y cobro en ambos temas.
- [x] Unitarias, integración PostgreSQL, frontend, lint y TypeScript.

Validación completada: TypeScript frontend/backend, Oxlint sin errores (advertencias preexistentes), 1.368 unitarias backend, 1.265 integraciones PostgreSQL, 3.094 pruebas frontend y 4 E2E Chromium (1440/390, claro/oscuro). El formato de precio argentino tiene cobertura adicional de formulario y E2E. La migración se ejecutó sobre esquema previo con filas sintéticas de tienda, cliente, equipo y venta, conservadas sin modificaciones. Sin build, commit, push ni acceso a producción.
