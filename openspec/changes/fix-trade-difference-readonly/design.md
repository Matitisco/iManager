# Diseño

Desktop y mobile comparten `OperationForm`, usado por `TradeForm` para nuevos canjes. Reemplazar únicamente el input de Diferencia por un `output` etiquetado mediante `Field`, sin borde ni fondo de campo editable. Reutilizar `difference` y `money.show`; conservar las advertencias existentes. No cambiar la edición de canjes legacy.

Cubrir render en ambos layouts, ayuda sin precio y valor con precio, incluyendo cero y actualización al editar. Actualizar las expectativas de los tests existentes que consultaban el input.
