## Approach
Conservar el orden relativo dentro de activas/anuladas después de priorizar avisos. Reutilizar ContextMenu y Dialog. AppContext aplica el resultado persistido del endpoint protegido por acceso a Ventas y permiso sensible.

Guardar un snapshot privado de los efectos antes/después de anular, en la misma transacción. Revertir mediante deltas de cliente, restitución de estado de stock/canje y señas, compensaciones de movimientos y restauración del snapshot de comisión. Transacción Serializable con locks y reintentos; solicitudes repetidas son idempotentes. Rechazar stock vendido/reservado y créditos consumidos. Las anulaciones históricas solo se recuperan si hay evidencia suficiente del estado anterior; ante ambigüedad devolver conflicto visible, sin inventar saldos.

No tocar bases de producción. Validar con PostgreSQL local aislado, pruebas relacionadas y capturas 1440/390.
