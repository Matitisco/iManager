## Why
La caja diaria de #307 bloquea ventas, cobros, cancelaciones y correcciones de precio de #305 en producción.

## What Changes
- La caja es opcional para operar: sin configuración compatible no se genera movimiento; con caja configurada sin apertura, el movimiento queda sin asignar.
- Anulaciones compensatorias en caja compatible abierta o sin asignar sólo si el cobro original pertenecía a una caja; los cobros sin asignar se compensan siempre fuera de cajas. Originales y cierres inmutables.
- Corregir precios conserva los cobros reales; subir un precio pagado conserva la deuda adicional de #305.
- Corregir singular de equipo en inventario y dashboard; regresiones desktop/iPhone y backend.

## Impact
Prisma conserva tablas, datos y unicidades; permite registerId nulo y agrega moneda/medio opcionales. Validación local con prisma db push sin aceptar pérdida. Commit local en español, sin push.
