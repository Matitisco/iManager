---
name: inventory-dblclick-detection
type: proposal
---

# Proposal: Mejoras a la detección de doble-click en inventario

## Problema

La detección de doble-click para edición inline era poco fiable:
1. **Área de activación reducida**: solo se activaba si el click caía exactamente sobre el elemento `<td data-col>`, dejando zonas muertas en los bordes verticales de la celda.
2. **Interferencia con selección de fila**: el primer click de un doble-click disparaba la selección de fila (via `setSelectedIds`), causando un re-render de React que impedía al browser detectar el segundo click como parte de un double-click.

## Solución

1. **Fallback por columna (eje X)**: si el click no aterriza sobre un `td[data-col]`, se detecta la columna por posición X usando `thRefs.current[col].getBoundingClientRect()`. Así, cualquier click en la columna horizontal activa el edit.
2. **Debounce de single-click (250ms)**: la selección de fila se demora 250ms. Un double-click cancela el timer antes de que dispare, de modo que el primer click nunca genera un re-render intermedio.

## Alcance

- Solo afecta `src/pages/Inventory.tsx`
- No cambia el modelo de datos ni el backend
- No modifica comportamiento de selección shift+click (sigue funcionando igual)
