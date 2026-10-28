# Importador: destacar opción Nuevo campo

«Nuevo campo…» incorpora Plus de Lucide antes del texto, fondo `--lime-soft`, ícono sobre `--lime` y separador superior de 1 px con `--border`. El texto conserva `--primary` para contraste legible. El foco negro existente sigue visible.

Se reutilizan `DeskSelect`, `ds-select-option`, sus estados `active`/`selected` y el Sheet del importador. `SelectOption` admite ícono decorativo y clase opcionales; el CSS aditivo `imp-new-field-option` vive en `ImportModal.css`. No se modifican valores, orden, handlers, validaciones ni lógica de importación. El nombre textual también se conserva en el select nativo y en la búsqueda por teclado; el ícono está oculto al lector de pantalla.

Validación: 37 pruebas existentes de `select.test.tsx` e `ImportModal.panel.test.tsx` (máximo dos workers), TypeScript frontend/backend, build frontend y verificador de clases aprobados. Chromium con componentes reales: búsqueda por texto, flechas, Enter, Escape, retorno de foco y acceso al formulario por teclado a 1440×900 @1x y 390×844 @2x. Capturas inspeccionadas, sin recorte del selector. Las advertencias del build corresponden a tamaño de chunks e imports mixtos existentes.

Las capturas usan una hoja y dos equipos ficticios en un montaje local de `InventoryImportReview`, sin consultar base de datos ni servicios de negocio.

- [Escritorio](nuevo-campo-1440.png)
- [Móvil](nuevo-campo-390.png)
