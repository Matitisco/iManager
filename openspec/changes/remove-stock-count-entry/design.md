# Diseño

Eliminar StockEntryButton, stockOpen y el render alternativo de InventoryScreen. StockCountScreen se monta únicamente desde DeskApp, sin props standalone/onBack ni flecha de regreso. Retirar el icono y CSS exclusivos del acceso eliminado; conservar los estilos compartidos por Carga en serie.

Actualizar componentes y selectores E2E para usar la pestaña por rol y nombre. Verificar navegación de ida y vuelta en escritorio y móvil, ausencia del botón y conservación de los flujos de conteo con Vitest y typecheck, sin build.
