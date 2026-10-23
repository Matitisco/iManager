# Diseño

Los avisos persistentes deben ocupar espacio en el flujo del contenido: una capa flotante intercepta acciones de ventas y configuración. Conservar componentes, textos y tokens existentes. Los helpers E2E esperan el shell resuelto y animaciones del contenedor real. Actualizar expectativas según decisiones de producto, verificando recuperación y persistencia. Mantener el límite de CI; repartir suites completas en shards si los tiempos lo requieren.


La primera corrida posterior a #535 pasó todos los E2E pero expuso un aviso PWA duplicado. Se reprodujo con Chromium de Playwright: el servidor ya devolvía el build del bundle cargado, mientras un controllerchange tardío anunciaba otra actualización. Antes de anunciar por cambio de controlador se consulta version.json; una versión igual se descarta, una diferente o desconocida conserva el flujo existente. La limpieza del efecto descarta respuestas tardías.

La navegación exclusiva de #536 entró durante el seguimiento. Las regresiones pendientes se adaptan mediante el helper de navegación visible existente; el indicador móvil pulsa directamente su botón visible. Se conservan las aserciones de negocio, sin cambiar código de producto, timeouts ni skips.
