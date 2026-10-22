## Design
Mockup previo generado con image_gen en `.wireframe-483.png`: alta y edición desktop/mobile, un único selector con píldoras y botón de edición existentes. Mantener DM Sans, tokens y layout responsive actuales.

Deduplicar las opciones ya combinadas de catálogo/base/inventario por capacidad numérica GB/TB, ignorando espacios y mayúsculas de la unidad. Priorizar el orden y etiqueta del catálogo. Para una capacidad seleccionada equivalente, usar su valor original como id de la opción visible; así editar y guardar no transforma datos históricos y permite deseleccionar. No convertir TB a GB ni fusionar nombres personalizados distintos. No modificar el helper compartido de otros catálogos.

## Validation
Vitest unitario del agrupamiento, componente real y su integración con CatalogProvider/DeskOverlays y callbacks de persistencia. TypeScript frontend/backend y capturas locales 1440×900 y 390 con iPhone 13. Sin build ni escrituras a bases reales.

## Results
- Causa reproducida: `Set` y `catalogChoices` comparaban valores exactos; las capacidades de importación también pueden incluir espacio (`splitModelCapacity` produce `128 GB`). No hay dos campos JSX: son opciones equivalentes duplicadas en el mismo selector, compartido por alta y edición.
- Cinco pruebas de regresión fallaron antes del fix. Pasaron 56 pruebas en nueve archivos Vitest (10 nuevas entre unitarias y componente/integración): equipment-capacity-options, equipment-capacity, equipment-quality, catalog, catalog-close, sensitive-actions, validation-messages, inventory-color e InventoryScreen.
- `npx tsc --noEmit` aprobado en frontend y backend, `git diff --check` y `node --check .shots-483.mjs` aprobados. No se ejecutaron tests de backend ni E2E nuevos porque no cambia lógica de servidor ni un flujo crítico.
- Doce capturas en `.shots-483/`; alta, capacidad seleccionada, edición y editor de capacidades a 1440×900 y 390 con emulación iPhone 13. Auditoría del selector: un campo, cuatro opciones, cero duplicados; cero pasos fallidos.
- `.shots-483.mjs` usa 4210 por defecto. Este worktree se verificó con `SHOTS_DIR=/workspace/wt-483-c/.shots-483 SHOTS_APP_URL=http://127.0.0.1:4213/#/ node .shots-483.mjs`: 4210 sirve otro checkout. Vite de este worktree en 4213 y backend local sembrado en 3210; no se enviaron formularios ni cambios de catálogo.
- Mockup generado antes del código con la herramienta integrada image_gen; prompt en `.wireframe-483-c.prompt.txt`. Sin build, cambios de backend/schema, commit, push ni PR. La CLI OpenSpec no está instalada, por lo que no se pudo ejecutar su validación estricta.
