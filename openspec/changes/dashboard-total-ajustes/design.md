# Diseño

Total se representa con un período nulo; el servicio envía rangeKey=all_time sin fechas. El backend ya soporta consultas históricas y series mensuales; se fija ese contrato con pruebas y se normaliza all_time a fechas nulas.

Se coordinan sesión confirmada/permisos y primeros pasos antes de mostrar DashboardContent. Las cuentas nuevas usan el mismo contenido sin remontarlo al actualizar progreso. Se agregan señales de listas resueltas por red y fallas al contexto sin alterar la carga inmediata por caché en otras pantallas. DashboardContent conserva el mismo DOM y reserva tamaños mientras espera todas las listas y overview inicial; no pinta cifras parciales. Los accesos operativos actuales no se atenúan al cambiar período. Se invalidan respuestas por tienda, usuario, permisos, rango y listas.

Se conserva el markup y CSS de #512: bentos, tarjetas y ventas recientes con avatar, estado e importe; cinco ventas desktop y cuatro móvil. Sólo se amplía el espacio para el chip Total y se agregan reservas mínimas de carga con Skeleton. Los detalles y menús contextuales permanecen. Auditoría y body preparados en docs/qa-dashv3.
