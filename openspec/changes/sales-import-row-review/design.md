# Diseño

El parser conserva coordenadas físicas y datos no asignados en notas. El análisis combina mapeo existente con validación de todas las filas y contexto de stock/ventas por tienda. La revisión usa grilla de origen con asignación por columna y tarjetas móviles. Los importes ARS se convierten a USD con histórico diario blue; si falta, cotización actual avisada. La cotización revisada se congela al confirmar.

Una transacción conserva todas las filas o revierte el archivo completo. Las repeticiones internas tienen identificador por ocurrencia y aviso; reimportaciones son idempotentes. Totales e importes ilegibles se conservan sin importe imputado, con original en notas y marca de revisión independiente del estado de cobro. No hay cambios de schema.
