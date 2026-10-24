## Context

El footer de `LoadedReturnDetail` entrega directamente un botón secundario cuando el reclamo está anulado. Sin una grilla de acciones, conserva su ancho intrínseco. La evidencia móvil muestra aproximadamente 49 px de ancho para una acción textual de cierre.

## Goals / Non-Goals

Restablecer la distribución de una acción única con clases reales. No cambiar tamaños, colores, datos, mutaciones ni componentes compartidos.

## Decisions

Envolver exclusivamente el botón Cerrar de la rama anulada en `div.sacts.one`. Ambas clases existen en `desk.css`; la grilla de una columna estira el botón. Se mantiene `btn2 s`, `type="button"` y el mismo callback de cierre. La rama de restauración histórica conserva sus acciones existentes.

## Risks / Trade-offs

Cambio de layout reversible y acotado. Validar geometría real en Chromium para escritorio y móvil; jsdom no calcula anchos. No agregar una prueba que solo replique las clases del cambio.

## Validation

Reabrir el RMA ficticio anulado, medir ancho de botón/pie y cerrar en ambos viewports; comprobar persistencia del anulado tras recarga. Correr TypeScript frontend/backend en paralelo y pruebas relacionadas de reclamos con dos workers y lock compartido. Sin build ni suite completa.
