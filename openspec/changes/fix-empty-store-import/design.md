# Diseño

Usar el bloque existente de reparación y protección de inventario en `finish()` independientemente del origen del plan. Extraer el armado de filas de ImportHost a un helper compartido con StockOnboarding; pasar las definiciones al confirmar. Sin cambios de schema ni de valores nativos reconocidos.

Verificar primero la regresión sobre main y después el arreglo con PostgreSQL local exclusivo de test, tests relacionados y TypeScript; sin build ni datos reales.
