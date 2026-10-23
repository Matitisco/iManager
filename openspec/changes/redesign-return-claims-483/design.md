# Diseño

Mockup previo generado con imagegen a partir de capturas locales de main y referencias v2/v3; evidencia externa en /workspace/imanager-local/shots/483-g/.

Reutilizar Sheet/Actions, componentes de menú y PressTarget. DM Sans, pills negras seleccionadas, superficies blancas y separación por bloques; timeline con fecha y nota por evento. Seleccionar no persiste: Guardar confirma estado y nota juntos. Resolución conserva reglas de dinero/destino y permisos; RMA conserva su flujo. Edición reutiliza ReturnForm, bloqueando el vínculo a la venta.

PATCH acepta motivo, fecha y diagnóstico; estado abierto/diagnóstico y nota se guardan en una transacción Serializable con lock de tienda, auditoría y evento. Resolve/RMA reciben nota opcional. Baja lógica mediante DELETE existente: status ANULADO + deletedAt/deletedBy, evento y auditoría; no hay borrado físico ni restauración de una anulación. Esta baja del registro no revierte movimientos históricos de caja/stock ni créditos ya contabilizados: la confirmación lo explicita para reclamos con resolución. Los reportes de reclamos excluyen anulados explícitamente además de deletedAt; los movimientos financieros históricos mantienen su semántica independiente.

Sin cambios de schema Prisma. No imágenes/prompts versionados.

## Ronda visual aprobada #316 (2026-10-22)

Referencias de solo lectura: `/workspace/redisenio-316/figma/`, `notas.md` y HTML/CSS de referencia. El alta coloca Fecha primero con DatePicker flotante en escritorio e inline en móvil, seguida de Venta, resumen IMEI/garantía/importe y Motivo; omite diagnóstico y envía null. La edición conserva el diagnóstico existente y el vínculo a la venta.

El detalle reúne cliente/equipo/IMEI/fecha/motivo en una tarjeta, estados en segmentos iguales, campos condicionales y un único próximo paso con nota dentro de Seguimiento. Los eventos reales de `current.events` viven exclusivamente en un submodal de 480 px; móvil usa pantalla completa y BackButton. Comparte el acceso de reloj de 44 px con RecordHistoryButton, sin texto visible en ninguno de sus usos. Conserva permisos y endpoints financieros/RMA.

Menú Editar/Anular: contexto de escritorio, hoja móvil con código y cliente, fila seleccionada amarilla. Anulados con fondo semántico err al 7 %, importe «—» y sin acceso a acciones; consulta de solo lectura conservada. Confirmación identifica código y cliente y aclara conservación de movimientos.

Se renombra `.dp-calendar.inline` a `.dp-calendar.dp-inline` para evitar la utilidad Tailwind. Alta de ventas utiliza también el panel inline en móvil; Reportes mantiene su uso existente. Las hojas limitan altura al viewport, con cabecera/acciones fijas y scroll interno; fecha abierta y Resuelto móviles tienen referencias más altas que 844 px y requieren scroll en ese viewport.
