# Diseño

Compartir una fila de Ganancia en RepairForms. Usar canSeeFinancials con la membresía actual y omitir completamente el DOM sin permiso. Calcular desde los inputs en alta/edición y desde los importes existentes en detalle; formatear con useMoney en la moneda de cada vista. Un monto ausente o no finito produce «—»; cero es válido. Conservar los ceros guardados como texto «0» en el editor para distinguirlos de un input borrado, sin modificar el payload.

Validar con Vitest sobre los componentes reales, escritorio/móvil, permisos, faltantes, ceros, cambios de inputs y moneda. No consultar bases de negocio ni ejecutar builds.
