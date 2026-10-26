# Diseño

Agregar draftSellerMemberId y draftWarrantyDays opcionales al canje, siguiendo sus otros campos de borrador. Validar pertenencia del vendedor al guardar/editar y al confirmar. Un PATCH omitido conserva lo guardado; null quita vendedor y 0 conserva ausencia de garantía. Confirmación usa valores explícitos o los persistidos. El formulario recupera ambos sin sobrescribir cambios manuales. Borradores anteriores conservan los defaults vigentes.
