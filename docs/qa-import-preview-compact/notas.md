# Vista previa compacta de Importar equipos

Una hoja omite el checkbox de inclusión. Varias hojas usan chips en una fila con scroll horizontal, conservando selección e inclusión. Encabezado pasa a un enlace junto a los avisos con opciones en popover, foco inicial, Escape, cierre externo y recuperación de foco. Equipos y mapeo aprovechan el alto disponible con sus encabezados y scroll independientes; columnas rojas y motivos de descarte conservados.

Clases reutilizadas: sheet-frame, sheet-scroll, sheet-foot, wlink, sgs, sg, dtable compact y spill. CSS de layout con prefijo imp- en ImportModal.css, usando los tokens existentes. Se conserva el ancho y la composición actual de la revisión.

Validación: TypeScript frontend/backend, 89 pruebas relacionadas en ocho archivos y verificar-clases aprobados. Geometría Chromium a 1440×900 @1 y 390×844 @2: hoja y acciones dentro del viewport, scroll interno, encabezados fijos, popover visible y chips en una sola línea. Datos de las capturas: fixtures ficticios de pruebas, sin acceso a datos del negocio.

Capturas inspeccionadas en /workspace/qa-sin-hoja/: importador-{1440,390}.png, importador-{1440,390}-avisos.png, encabezado-{1440,390}.png, varias-hojas-{1440,390}.png y motivos-{1440,390}.png. Para regenerarlas: IMPORT_DISCARD_SHOTS=/workspace/qa-sin-hoja npx vitest run src/components/ImportModal.layout.test.tsx --maxWorkers=2.
