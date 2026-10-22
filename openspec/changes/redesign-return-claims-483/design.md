# Diseño

Mockup previo generado con imagegen a partir de capturas locales de main y referencias v2/v3; evidencia externa en /workspace/imanager-local/shots/483-g/.

Reutilizar Sheet/Actions, componentes de menú y PressTarget. DM Sans, pills negras seleccionadas, superficies blancas y separación por bloques; timeline con fecha y nota por evento. Seleccionar no persiste: Guardar confirma estado y nota juntos. Resolución conserva reglas de dinero/destino y permisos; RMA conserva su flujo. Edición reutiliza ReturnForm, bloqueando el vínculo a la venta.

PATCH acepta motivo, fecha y diagnóstico; estado abierto/diagnóstico y nota se guardan en una transacción Serializable con lock de tienda, auditoría y evento. Resolve/RMA reciben nota opcional. Baja lógica mediante DELETE existente: status ANULADO + deletedAt/deletedBy, evento y auditoría; no hay borrado físico ni restauración de una anulación. Esta baja del registro no revierte movimientos históricos de caja/stock ni créditos ya contabilizados: la confirmación lo explicita para reclamos con resolución. Los reportes de reclamos excluyen anulados explícitamente además de deletedAt; los movimientos financieros históricos mantienen su semántica independiente.

Sin cambios de schema Prisma. No imágenes/prompts versionados.
