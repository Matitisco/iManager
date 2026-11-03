# Diseño
- Campo variante A, costo en moneda guardada del equipo; sin moneda guardada, moneda de venta/tienda. No convertir al guardar costo ni cambiar la moneda del equipo.
- Enviar costo solo si fue modificado y no está vacío. Cero es válido; se conserva la convención existente de reportes que considera cero como sin costo.
- Reutilizar moneyInput, Decimal, moneyChanged, writeAudit y diffFields/MONEY para inventory.cost y costChangedBy/At, dentro de las transacciones de venta y confirmación de canje.
- Ganancia en vivo con summarizeSaleProfit: precio completo menos costo por cantidad, sin restar otra vez el valor tomado en canje. Proyección monetaria existente.
- canSeeFinancials gobierna UI y escritura; preSerialization existente elimina cost de respuestas sin permiso. Opciones de equipos incluyen costo para prefill.

Cuando se envía costo y falta precio de inventario, solo se completa el precio automáticamente si está en la misma moneda: evita reetiquetar el costo. En otra moneda conserva precio a definir y registra el precio de la venta, sin conversión nueva.
