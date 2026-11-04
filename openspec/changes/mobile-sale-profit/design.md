# Diseño

Reutilizar `canSeeFinancials` y `summarizeSaleProfit`, exactamente como la columna desktop. Renderizar el pie sólo en SaleCard mobile con permiso financiero. La ganancia neta considera únicamente devoluciones compensadas de esa venta, sin limitarse al período de la lista; calcular el bruto sin devoluciones para el tachado cuando haya ajuste.

Mantener el formateo y moneda de `useMoney`. Ganancia positiva verde, ajuste ámbar y negativa roja con signo menos. Sin costo o datos financieros pendientes: guion largo, sin inventar un cero. Respetar el caso desktop de una devolución con costo aunque el equipo actual no tenga costo. Usar tokens de tema existentes y estilos exclusivos del pie para no modificar desktop.

Verificar el componente con fixtures ficticios y mocks: costo, ausencia de costo, devolución parcial, negativa, permisos, ventas pendientes, divisas, devoluciones sin compensar, datos pendientes y desktop. Revisar geometría y colores a 390 px en claro y oscuro.
