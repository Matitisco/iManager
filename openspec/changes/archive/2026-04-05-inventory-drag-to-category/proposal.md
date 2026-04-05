# Proposal: inventory-drag-to-category

## Problem

Mover ítems de categoría requería múltiples pasos: seleccionar con checkboxes → abrir "Mover a..." → elegir categoría. La interacción era lenta y no aprovechaba el paradigma de drag & drop que el usuario espera en una interfaz de gestión de inventario.

## Solution

Agregar drag & drop directo desde las filas de la tabla de inventario hacia las pestañas de categoría. El usuario presiona y arrastra cualquier fila (5px de threshold) para agarrarla; si no estaba seleccionada, se selecciona automáticamente. Un badge flotante muestra el conteo de ítems siendo arrastrados. Las pestañas de categoría se iluminan como drop targets válidos. Al soltar sobre una pestaña, aparece un diálogo de confirmación antes de ejecutar el movimiento.

## Scope

- Drag desde filas de inventario hacia category tabs (desktop only)
- Badge flotante con conteo durante el drag
- Highlight visual en la categoría destino
- Confirmación antes de ejecutar el bulk move
- Actualización instantánea de la tabla al confirmar
- Sin cambios en backend (reutiliza `bulkMoveCategory` existente)
