# Diseño

`dashboardLast7Days(today = dashboardDay())` devuelve `{ start: shiftDay(today, -6), end: today }`. Se usa como inicializador del estado y en el preset del selector, conservando mes, mes anterior, hoy y Total.

Los vacíos reconocen el rango de siete días antes que el mensual, incluso si coinciden el día siete. Conservan el rango de la instantánea resuelta durante consultas o fallos. El backend sigue usando ventanas inclusivas consecutivas de igual duración.

Las regresiones cubren límites argentinos, cambio de mes/año y febrero bisiesto, selección inicial, caché al remontar, filtros de ventas recientes, vacíos y comparación de siete días.
