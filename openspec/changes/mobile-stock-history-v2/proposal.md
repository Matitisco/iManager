# Control de stock e Historial móvil v2

Implementar las referencias móviles aprobadas de #318 y #372 desde `mobile-v2/src/v2.css`. La lista de Historial y Control de stock cambian su presentación hasta 760 px; fuera del detalle modal-v3, escritorio a 1024/1440 conserva estructura y CSS efectivo. Mantener operaciones, permisos, filtros de escritorio y navegación.

Regla global del detalle: las filas sin Antes real omiten también la etiqueta Después sobre el valor. El modal aplica el rediseño modal-v3 aprobado en todos los viewports.

## Ampliación aprobada — detalle de evento modal-v3

Aplicar las referencias `modal-{a,b,c}-{1440,390}` y `modal-v3/src/modal.css` al detalle del Historial, también en escritorio. A compara precio; B presenta los contadores guardados del control; C presenta los valores nuevos sin Antes/Después. Mantener datos y destinos existentes y usar Sheet y tokens compartidos. Sin backend, Prisma, E2E nuevos, build, commit ni push.
