# Diseño

Reutilizar StockCountScreen, HistoryScreen, GroupTabs, Sheet y ListSkeleton. CSS específico por pantalla con los valores exactos de base.css y extra.css, integrado a los tokens del escritorio. Tarjetas de grupos seleccionables, resumen con pasos, vista compacta expandible del resultado y acción móvil despejada de la navegación. El alcance disponible del modal se presenta con el inventario ya cargado; no cambia contratos ni cálculo del conteo. Historial en columnas desktop y filas móviles centradas en la acción; encabezado del detalle con sección/fecha y bloques reordenados según viewport. Antes/Después únicamente desde changes, conservando todos sus campos.

Validar con typecheck frontend/backend y Vitest; actualizar selectores existentes sin agregar ni ejecutar E2E. Commit en español en la rama actual, sin push según pedido explícito.
