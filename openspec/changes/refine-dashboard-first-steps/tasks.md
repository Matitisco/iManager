- [x] Compartir dashboard y actualizar estados vacíos y nombres de rol.
- [x] Corregir CSS de isla y espacio inferior del dashboard.
- [x] Implementar cierre persistente tras completar los cinco pasos.
- [x] Actualizar tests y ejecutar Vitest, TypeScript y build.
- [x] Intentar capturas locales con Playwright: Chromium bloqueado por el sandbox (`shutdown: Operation not permitted`), sin capturas disponibles.

Validación final: TypeScript frontend/backend y build aprobados. Vitest: 837 tests aprobados (incluidos los 27 de dashboard/primeros pasos), un fallo de red en `DeskApp.test.tsx:212`, reproducido también en una copia limpia de HEAD, y cuatro archivos bloqueados al arrancar Chromium (siete tests sin ejecutar). No se modificaron esos tests ni se omitieron para presentar una suite aprobada. Sin cambios de backend/schema, escrituras de DB, commits, push, ramas ni PR.
