# Tasks

## Frontend
- [x] Capturar main a 1440/390 y generar mockup previo con las referencias adjuntas.
- [x] Reorganizar ficha y acciones con estilos exclusivos de Proveedor.
- [x] Espaciar alta/edición y conservar borrador ante fallos y guardados pendientes.
- [x] Tests de componentes y regresiones del área; lint/typecheck frontend y backend.
- [x] Verificar con Playwright y preparar capturas reproducibles a 1440/390 para la rama publicada.

Entrega: un commit feat(#483-j), push de feat/483-medios, repetición de la verificación sobre la rama publicada y checklist del PR #495. Evidencia final fuera del repositorio.

## Backend
Sin cambios de backend, AppContext ni Prisma.

## Corrección #308
- [x] Reemplazar los Sheet de proveedor y gasto por ReasonSheet durante la confirmación, conservando datos y borradores.
- [x] Cubrir diálogo único, regreso sin recarga, errores y éxito con tests de componentes.
- [x] Ejecutar Vitest de overlays (74 pruebas) y TypeScript frontend/backend, sin build.

Entrega #308: un único commit con el mensaje solicitado, en fix/308-proveedor-modal y sin push. El CLI de OpenSpec no está instalado en este entorno; los artefactos se actualizaron directamente.
