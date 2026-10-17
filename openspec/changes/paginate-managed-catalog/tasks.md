# Tareas
- [x] Extender el paginador sin cambiar los defaults de las otras tablas.
- [x] Paginar Catálogo, conservar selección/edición y adaptar estilos a los mockups móvil/desktop.
- [x] Cubrir rangos, búsqueda/reglas, selección, edición, límites y scroll con Vitest.
- [x] Ejecutar TypeScript, Vitest y build; dejar cambios sin commit ni push.

## Verificación

- TypeScript frontend (`npx tsc --noEmit`) y backend (`npm --prefix backend run lint`): pasan.
- Vitest de Catálogo/paginador: 28 pruebas pasan.
- Regresión de Inventario, Ventas, Canjes y Clientes: 46 pruebas pasan, conservando 8 filas por página.
- Build (`npm run build`): pasa; advertencia de bundle mayor a 500 kB.
- Suite completa (`npx vitest run`): 813 pruebas pasan, 1 falla y 7 se omiten por fallas de `beforeAll`; 117 archivos pasan y 5 fallan. Esta ejecución precede la última prueba agregada de selección fuera de la búsqueda.
- Bloqueos previos: cuatro suites necesitan Chromium headless shell 1217, ausente en el entorno. La prueba de conectividad en `DeskApp.test.tsx:212` falla de la misma forma sobre HEAD original, comprobado en una copia temporal sin modificar el working tree.
- Revisión visual: se abrieron los 11 PNG y se revisó el HTML aprobado. No se pudo ejecutar el navegador local: el sandbox rechaza la apertura de puertos y Chromium con `Operation not permitted`.
