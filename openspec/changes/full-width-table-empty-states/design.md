## Approach
Actualizar las clases compartidas inv-empty en desk.css: ancho completo, padding vertical de 64 px (40 px en móvil), marca de 64 px con tokens existentes, título de 18 px y texto de 14 px limitado a 420 px. Mantener acciones centradas y apiladas, de ancho completo en móvil.

Eliminar los contadores de InventoryEmpty, ClientsEmpty, TradeEmpty y SalesEmpty. TablePager ya se oculta cuando no hay resultados. Conservar filtros, callbacks y data-testid.

Notificaciones conserva padding y tipografía compactos mediante selectores específicos. Historial también reutiliza inv-empty-box; verificar sus pruebas relacionadas. Los demás vacíos tienen clases independientes.

## Validation
TypeScript/lint y pruebas de los componentes afectados con máximo dos workers. Sin build, servidores, bases ni producción.
