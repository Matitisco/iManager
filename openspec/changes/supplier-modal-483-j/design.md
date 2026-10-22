# Diseño

Referencias de main capturadas con Playwright a 1440×900 y 390×844 (iPhone 13). Mockup previo creado con imagegen, capturas y referencias v2/v3: `/workspace/imanager-local/shots/483-j/wireframe.png`. Imágenes y prompts quedan fuera del repositorio.

Usar Sheet y sus capas/foco/scroll existentes. Estilos exclusivos de Proveedor en supplier.css: contacto con valores que parten líneas en desktop y una sola línea con elipsis hasta 760 px, con valor completo en title; notas en superficie gris, compras separadas y cards sin sombra con padding interno. Equipos con título, IMEI completo, estado y costo sujeto al permiso actual. Footer fijo con Registrar equipo y SheetActionMenu para Subir stock/Editar/Archivar; restauración en proveedores archivados.

Alta y edición en una columna, con separación de campos y sin subtítulo ni placeholders opcionales repetidos. Bloquear controles, cierre y duplicación de envío durante persistencia; mantener borrador y errores visibles. Conservar endpoints y navegación existentes. Tests de componentes para estados, permisos, acciones y persistencia, más revisión visual local de la rama publicada.
