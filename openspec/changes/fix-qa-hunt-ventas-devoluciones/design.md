## Backend

Conservar transacciones Serializable y bloqueo por tienda de Returns. El acumulado del cliente usa `balanceCurrency`, con fallback a moneda del local como en Operations; convertir con Decimal y `Sale.exchangeRate`, redondeando a dos decimales. Si falta una cotización histórica necesaria, fallar visiblemente y revertir toda la transacción.

Deduplicar IDs conservando el orden antes de planificar aplicaciones. Revalidar cantidad final del reclamo junto con los demás reclamos que consumen unidades, incluidos anulados con efectos conservados e históricos sin cantidad explícita.

## Frontend y límites

Sin cambio de UI ni AppContext. Ejercitar los flujos existentes en navegador desktop/mobile. Anular reclamos resueltos conserva movimientos pero actualmente los excluye de reportes: documentarlo con regresión de fallo esperado, sin definir una reversión parcial insegura.
