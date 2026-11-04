## Decisions
- DELETE /api/{sales,inventory,clients,trade-ins,repairs}/:id/permanent, separado del DELETE de baja lógica.
- Guard OWNER antes de consultar el registro; revalidar membresía bajo bloqueo compartido dentro de transacción Serializable con retry. Filtrar cada registro por storeId y bloquearlo antes de validar su estado.
- Archivos: archivedAt. Anulaciones: voidedAt o estados históricos de cancelación; canjes también confirmationStatus=CANCELLED. Activos devuelven 409, ajenos/inexistentes 404, otros roles 403.
- Borrar la entidad seleccionada y dependencias que el schema ya define en cascada; eliminar explícitamente ClientDeposit del mismo cliente/tienda porque su FK usa Restrict. Conservar entidades de negocio relacionadas mediante SetNull. No volver a aplicar efectos de stock, saldos o caja. Avisar explícitamente las dependencias en la confirmación.
- Registrar *.permanently_deleted con actor, rol, tienda, ID y etiqueta en la misma transacción. Conservar eventos previos.
- Componente de acción compartido en detalles y menú contextual; confirmar BORRAR exacto, bloquear durante petición con «Borrando…» y mostrar fallas sin cerrar. Conservar la identidad del registro mientras el modal esté abierto. Traducir por status 404/403/409 y usar un mensaje de conexión/reintento para otras fallas, sin exponer texto del backend.
- Mutar listas/cachés después de éxito o de 404 (registro ya ausente), invalidar lecturas archivadas pendientes y conservar el error 404 visible en el modal. Respetar el scope de tienda también en respuestas 404 tardías. Probar la URL final con el cliente HTTP real y base normalizada: `${API_BASE}/api/<entidad>/<id>/permanent`.

## Validation
Pruebas HTTP reales con DB local para roles OWNER/MANAGER/STAFF, activos, bajas, aislamiento y auditoría; regresiones de dependencias, rollback y concurrencia. Pruebas React de visibilidad, confirmación, errores y doble submit. Lint/typecheck frontend/backend y pruebas relevantes sin build.
