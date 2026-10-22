# Diseño

Usar StockCountScreen, los servicios existentes, Sheet y ListSkeleton. Al entrar continuar el abierto o mostrar el último cerrado con controles anteriores debajo. Resumen con cuatro grupos, IMEI completos, estado compacto Por revisar y única acción Registrar conteo. Modal mínimo, centrado en escritorio y hoja inferior móvil. CSS acotado al módulo; reservar espacio para navegación y safe area.

Limitar isCountableStatus a DISPONIBLE, reutilizado por preview, snapshot y clasificación. Conservar snapshots históricos sin reescribirlos. No tocar schema ni AppContext. Validar filtro y exclusiones mediante unitarios e integración PostgreSQL; componentes para flujo, permisos, errores, registro y ausencia de ajustes.
