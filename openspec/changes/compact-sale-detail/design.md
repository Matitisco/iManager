# Diseño

Reutilizar la separación de Sheet entre sheet-scroll y sheet-foot. Aplicar flex y scroll interno únicamente al detalle de venta en desktop; conservar el sheet mobile y su safe area. Mostrar el canje en una sección de dos columnas y las acciones en dos columnas con controles de al menos 48 px y textos que admiten salto de línea. Validar estructura con Vitest y geometría, scroll, ausencia de overflow y capturas con Playwright a 1440×900 e iPhone 13.

El detalle pasa las acciones mediante una prop footer explícita de Sheet, independiente de la detección de children. El footer no encoge; el cuerpo tiene min-height: 0 y scroll propio. Una grilla de dos columnas iguales con gaps explícitos extiende la última acción impar a toda la fila. Todos los puntos de entrada conservan el único SaleDetail de DeskOverlays.

Las pruebas de navegador crean el canje desde la ficha de un cliente y abren esa venta desde Reportes, Ventas, Dashboard y notificaciones. Las ventas históricas sin operación integrada se importan por la API para probar dos/tres acciones, sin alterar permisos ni falsificar el estado del frontend. Las capturas con canje muestran el bloque completo después de desplazar el cuerpo, con las acciones todavía fijas.
