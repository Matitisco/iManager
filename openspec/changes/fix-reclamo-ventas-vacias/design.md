# Diseño

Frontend y backend admiten COMPLETADA/PENDIENTE sin depender de moneda, método, cliente o acceso sensible. Los errores de carga se muestran separados de una lista vacía. La apertura no cobra ni modifica deuda. El importe reintegrable de una pendiente usa exclusivamente amount menos openBalance explícito; sin saldo explícito es cero.

ReturnCase registra cantidad nullable: null conserva los reclamos históricos por toda la venta. La suma de reclamos activos y anulados con efectos físicos o financieros no supera unidades vendidas; el límite por reclamo es el menor entre su proporción de lo cobrado y el cobro disponible de la venta menos compensaciones anteriores. Lotes devueltos se separan del stock restante para no cambiar su estado. Reparaciones conservan stock. Mantener guardas sensibles al resolver y aislamiento por tienda.

El formulario carga `/api/returns/eligible-sales` al abrirse, mediante services y el estado existente de devoluciones; así no depende de listas globales vacías por una lectura inicial fallida. La consulta no pagina ni exige acceso sensible. Muestra error y reintento, espera la respuesta antes de permitir guardar y descarta respuestas de una sesión/tienda anterior.
