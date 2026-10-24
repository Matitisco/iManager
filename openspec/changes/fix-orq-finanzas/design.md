## Context

El registro ficticio QA finanzas proveedor 24-10 se creó, editó y archivó mediante la UI local. Las capturas 042/043/044 de /workspace/qa-orq/finanzas reproducen el estado ambiguo en móvil. El código actual solo aplica `is-void` a la fila; el detalle sí contiene una píldora `spill mid` con «Archivado».

## Goals / Non-Goals

Hacer explícito el estado ya persistido y ajustar el mensaje vacío al filtro. No introducir estilos nuevos, operaciones ni validaciones de negocio.

## Decisions

- Reutilizar `isVoidRow(row)` y `spill mid`, con texto real dentro de la fila para lectores de pantalla. Ubicar la píldora en la columna de información para no sumar ancho fijo en móvil ni competir con el indicador de problemas.
- Mantener las condiciones de carga/error y los filtros actuales. Cambiar solamente el título del vacío de Activos.
- Aplicar 16 px a `.supplier-sheet .supplier-fields input` y `textarea` en el media query móvil local. Coincide con la guía R22 y el patrón existente de return-sheet; la medición previa 056-mobile-foco-tab registra inputs de 15 px y textarea de 14 px. No se cambia desk.css.
- Probar el comportamiento observable con registros ficticios activos y archivados y con selección de filtros.

## Risks / Trade-offs

Una fila archivada incorpora una línea corta adicional. El retest visual verificará que el nombre, la fecha, el estado y el chevron siguen dentro del viewport a 1440×900 y 390×844 @2x.

## Validation

Pruebas de SuppliersScreen, pruebas existentes del overlay y visibilidad de secciones con Vitest (flock, máximo dos workers); lint/tsc frontend y backend en paralelo. Copiar solo SuppliersScreen al runtime y recargar. No build ni reinicio. La API conserva 4ffe679: los totales añadidos por #552 quedan fuera de la validación integrada.
