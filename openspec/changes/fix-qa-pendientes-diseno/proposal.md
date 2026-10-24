## Why
QA detectó subtítulos/ayudas redundantes en Stock, cinco filas en el resumen del conteo y un error de cotización fuera del viewport móvil en onboarding.

## What Changes
- Quitar subtítulos de reglas de catálogo, detalle de equipo y carga en serie, y ayudas redundantes de las reglas.
- Mostrar tres filas antes de «Ver los N», conservando la expansión existente.
- Al enviar onboarding con cotización inválida, abrir los campos, enfocar el campo correspondiente y mostrar el error dentro del viewport.

## Impact
Solo frontend y pruebas relacionadas. Sin nuevos diseños, estilos, backend, Prisma ni AppContext. Validación en API 3560/web 4560 con DB ficticia y capturas 1440/390.
