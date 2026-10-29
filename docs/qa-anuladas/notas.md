Ventas anuladas — QA 29/10/2026

Las anuladas quedan al final antes de paginar; las activas conservan su orden relativo. Revertir anulación pide confirmación con el Dialog del proyecto. El backend restaura todos los efectos en una transacción, conserva los movimientos originales y agrega compensaciones.

Clases reutilizadas: dtable, phone-row, is-void, ctx/ctxov, dialog, row, cancel, ok y ferr. Sin CSS nuevo. Confirmación centrada con botón negro; menú inferior nativo en móvil. La acción de reversión es la excepción solicitada a la regla de anulados sin acciones.

Capturas: 1440×900 @1x y 390×844 @2x. Cuatro estados por tamaño: orden, menu, confirmacion y revertida. Todas inspeccionadas; controles y diálogo dentro del viewport. Datos ficticios (Ana Pérez, cuatro iPhones y operaciones de ejemplo), sobre PostgreSQL local aislado. No se accedió a producción.

Validación final: TypeScript frontend/backend, 121 pruebas frontend, 47 unitarias backend, 47 integraciones backend y 4 escenarios E2E aprobados; verificar-clases TODO OK. Sin build ni watchers.

Pruebas: permisos de sección y acceso sensible, cancelación del diálogo, error visible, persistencia tras recargar, paginación, idempotencia/concurrencia, ventas completas/pendientes/parciales, cuotas, canjes, señas, crédito usado, reventa, comisión y caja. Se limita el pool local a 3 conexiones para no competir con otros procesos.

Compatibilidad histórica: se reconstruye la venta cuando la auditoría o los cobros conservan evidencia suficiente. Anulaciones anteriores sin estado previo completo (por ejemplo, pendientes/canjes/señas sin snapshot) responden 409 con explicación y no mutan datos. Las anulaciones nuevas conservan el snapshot completo. Schema: campo opcional Sale.cancellationSnapshot y migración aditiva.

Reproducción visual: ANULADAS_SHOTS=/workspace/qa-anuladas npm run test:e2e -- e2e/restore-sales.spec.ts --workers=1 (usar DB ficticia propia y Vite sin watch para esta sesión).
