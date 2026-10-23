# Proveedores #308 — frontend B: Inventario

Referencias aprobadas: notas.md, C-inventario/C-equipo 1440/390 y HTML/CSS de /workspace/redisenio-308. Implementación sobre el backend y la ronda A existentes.

## Cambios

- Marca compartida con ícono de tienda y proveedor · dd/mm bajo el modelo en tabla y .inv-card. Reemplaza Proveedor: X y omite campos ausentes, sin guiones ni origen ficticio. No agrega consultas por fila.
- Selector Proveedor desde el catálogo compartido de AppContext, ordenado por nombre y con identidad por supplierId. Usa .dsel y un select nativo accesible, con foco visible y ancho determinado por la etiqueta. Está en el encabezado de la tarjeta desktop y junto a Seleccionar en móvil; también integra el borrador del Sheet Filtros.
- supplierId forma parte de InventoryColumnFilters, detección de filtros activos, limpieza y clave de paginación. Conserva el estado de la entrada de navegación/URL mediante useNavigationState y combina con el resto de los criterios antes de contar/paginar.
- Equipo: Proveedor abre Ver proveedor; Compra usa purchaseName o fecha completa y abre SupplierPurchaseDetail en una segunda capa compartida. El aviso también abre esa compra. Al volver se conserva el estado elegido del equipo. Los costos/totales siguen canSeeFinancials.
- El aviso usa exclusivamente GET /api/inventory/:id → purchaseSummary y aparece solo con problems > 0. Skeleton existente y reserva de 56 px desktop / 76 px móvil, conservada al resolver sin problemas o fallar. Respuestas tardías descartadas por equipo/usuario/tienda/origen/estado; sin mensajes secundarios. El resumen se consulta nuevamente si cambia el estado persistido.
- Reclamo: fila Proveedor solo cuando existe supplierName.

## Validación

- npm run lint y npm --prefix backend run lint aprobados; sin build.
- 122 pruebas relacionadas en 13 archivos Vitest: filtros y sus combinaciones, paginación/restauración de navegación, marca con/sin fecha/origen en escritorio y móvil, resumen positivo/cero/nulo, errores secundarios, respuestas tardías, enlaces y regreso al borrador, permisos financieros, proveedor del reclamo y contrato HTTP. Incluye regresiones de proveedores/importación, historial, calidad/capacidad, acciones masivas y navegación.
- Un único flujo crítico de consulta con Playwright, repetido a 1440×900 y 390×844 (@2x móvil), contra web 4310 / API 3310 / DB local imanager_308: login, inventario, filtro por proveedor con conteo real, equipo, compra, regreso y Ver proveedor. No agrega suites al CI ni escribe datos.
- Consulta del resumen retenida hasta medir el skeleton. Después de liberarla, las posiciones/alturas del Sheet, footer, Garantías y reserva coinciden exactamente en ambos tamaños. Sin overflow horizontal ni errores de página; acciones fijas y scroll interno accesibles.
- Capturas inspeccionadas y comparadas con los PNG: /workspace/qa-308/tmp/C-inventario-{1440,390}.png, C-equipo-{1440,390}.png y C-compra-{1440,390}.png. Script y registro temporales: inventory-review.cjs / inventory-review.log en ese mismo directorio.

## Desvíos respecto del mockup

- Se conservan tokens reales, DM Sans, avatar azul, --c-blue y los colores semánticos de Reservado (#3B82F6) y Enviado (#5B8DEF). No se copian los reemplazos grises/negros de los PNG.
- La base local contiene 168 equipos, incluidas dos altas de QA de la ronda A; el mockup tiene 166. Importadora Andes muestra 3 de 11 con problemas en la compra del 05/09, según el resumen real, frente a los 4 de 11 ilustrativos. Se mantienen el orden de novedades y sus resaltados actuales.
- La reserva del aviso agrega unos pocos píxeles de espacio respecto del PNG para garantizar que Garantías y las acciones no salten. Se conserva ese espacio sin texto cuando no hay problemas o falla la consulta secundaria.
- Selector nativo con las clases/tokens existentes para conservar navegación por teclado y selección por id, sin modificar el MenuButton compartido. El aviso abre la compra; Patrones queda para su ronda correspondiente.

## Archivos

Código: src/types.ts; src/services/inventory-api.ts; src/desk/inventory-filters.ts; src/desk/screens/InventoryScreen.tsx; src/desk/overlays/equipment.tsx; src/desk/overlays/supplier-purchases.tsx; src/desk/overlays/return-case.tsx; src/desk/desk.css.

Pruebas: src/services/inventory-api.test.ts; src/desk/inventory-filters.test.ts; src/desk/screens/InventoryScreen.test.tsx; src/desk/overlays/equipment-origin.test.tsx (nuevo); src/desk/overlays/return-case.test.tsx.

Documentación: PROJECT_STATUS.md; este archivo; openspec/changes/supplier-inventory-308/{proposal,design,tasks}.md y specs/suppliers/spec.md.

Sin cambios de backend, Prisma, AppContext, datos o producción. Sin build, commit, push ni escrituras de git.
