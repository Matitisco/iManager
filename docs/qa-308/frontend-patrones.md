# Proveedores #308 — ronda 4: Devoluciones → Patrones

Referencias leídas: notas.md, D-patrones 1440/390, HTML y clases pat-* de /workspace/redisenio-308. Backend y rondas anteriores existentes.

## Cambios

- Segmentos Reclamos/Patrones y Proveedor/Compra/Modelo con gchip y useNavigationState. Los filtros de estado siguen en Reclamos. Patrones no muestra el dock móvil de alta, siguiendo el PNG; Nuevo reclamo sigue disponible desde Reclamos y en escritorio.
- Cliente tipado GET /api/returns/patterns?groupBy=supplier|purchase|model. Se respeta el orden, label, devices/problems, percent, hot, topReason y claimsDetail del backend, sin recalcularlos ni inventar datos.
- Lista/detalle lateral 5:6 en escritorio; lista única con un detalle expandido en móvil. El nombre abre Ver proveedor o el detalle de compra; la barra/porcentaje expande o contrae reclamos. En Modelo, también el nombre expande. Controles separados sin botones anidados, región identificada y aria-expanded.
- Reclamos con RMA, cliente, equipo, motivo libre completo y Pill compartida. Aviso N de M reclamos son por la familia que envía topReason. Si claimsTruncated, se informa cuántos reclamos se muestran usando claims como denominador.
- Aviso de problemas de Ver proveedor enlazado a Patrones por Proveedor y con ese proveedor seleccionado. Sin permiso de Devoluciones conserva el aviso informativo. Destino por hash con identificador codificado y restauración incluso cuando la URL ya coincide pero cambiaron los segmentos locales.
- Patrones usa permiso de Devoluciones (sales). Enlaces de origen usan Inventario; compra reutiliza SupplierPurchaseDetail/Sheet, segunda capa en escritorio y pantalla completa con Volver en móvil. Costos y totales solo con canSeeFinancials. El componente compartido puede recibir únicamente el id de compra y obtener nombre/fecha desde su consulta existente.
- Skeletons compartidos sin texto de carga; respuesta vacía o fallida omite el contenido, sin error/reintento secundario. Caché durante la visita por agrupación y respuestas tardías descartadas. Cambiar usuario/tienda/permisos remonta el análisis y elimina snapshots anteriores; refetch y reconexión conservan el resultado completo mientras se consulta.

## Validación

- npm run lint y npm --prefix backend run lint aprobados; sin build.
- 98 pruebas relacionadas en 12 archivos Vitest. Incluyen agrupaciones y métricas del servidor, hot, aviso/ausencia de familia, denominador y recorte de reclamos, escritorio/móvil, colapsar/expandir, enlaces a reclamo/proveedor/compra, permisos, vacío, errores secundarios, caché, reconexión, respuestas tardías y aislamiento por tienda. También regresiones de reclamos, proveedores, origen del equipo y navegación.
- Un único flujo crítico de consulta con Playwright repetido a 1440×900 y 390×844 (@2x móvil): login, Proveedores → Importadora Andes → compra del 05/09 con En revisión → volver → aviso del proveedor → Patrones por Proveedor → Compra → expandir compra del 05/09 → Ver compra → volver → Modelo. Sin mutaciones del flujo ni nuevas suites E2E en CI.
- Revisión visual de capturas contra los PNG: lista/detalle lateral y expansión móvil, aviso, barras, colores y Sheet dentro del viewport. Sin overflow horizontal ni errores de página en ambos tamaños.
- Evidencia temporal fuera del repo: /workspace/qa-308/tmp/D-patrones-{1440,390}.png, D-proveedor-{1440,390}.png, D-compra-{1440,390}.png y D-modelo-{1440,390}.png; patterns-review.cjs / patterns-review.log y patterns-component.log en ese directorio.
- La web local se reinició con /workspace/run-local-308.sh. Fue necesario CHOKIDAR_USEPOLLING=true por ENOSPC del límite de watchers del entorno, sin cambiar configuración del repo ni otros puertos.

## Desvíos respecto del mockup

- Tokens reales y DM Sans conservados. Enviado/Abierto usan #5B8DEF mediante Pill; el avatar mantiene su azul. No se copian los reemplazos grises/negros del mockup.
- La base local difiere del mockup: la compra de Andes del 05/09 tiene 3 de 11 equipos con problemas (27%), y Mayorista Centro del 10/10 tiene 3 de 8 (38%), por lo que aparece antes según el orden del backend. Se muestran también los grupos al 0% que devuelve el endpoint. Los labels pueden incluir año/nota o nombre de lote y ocupar más líneas. No se cambian ni reordenan datos para imitar la imagen.
- El endpoint devuelve únicamente claimsDetail, sin detalle de equipos problemáticos sin reclamo. Por eso no se agrega la cuarta fila de equipo En revisión del PNG. Esa información sí se consulta al abrir el detalle de compra existente.
- El endpoint no separa proveedor/fecha/nota dentro de label. Se usa el label completo en el encabezado del detalle, sin reconstruir una fecha o nota a partir del texto.
- Se distinguen dos acciones de fila: nombre para abrir el origen, porcentaje para expandir los reclamos. Cumple ambos accesos sin interceptar clics de botones anidados.

## Archivos

Código: src/services/returns-api.ts; src/desk/returns-navigation.ts; src/desk/screens/ReturnsScreen.tsx; src/desk/screens/ReturnsPatterns.tsx; src/desk/screens/returns-patterns.css; src/desk/overlays/supplier.tsx; src/desk/overlays/supplier.css; src/desk/overlays/supplier-purchases.tsx.

Pruebas: src/services/returns-patterns-api.test.ts; src/desk/returns-navigation.test.ts; src/desk/screens/returns-patterns.test.tsx; src/desk/overlays/supplier.test.tsx.

Documentación: PROJECT_STATUS.md; este archivo; openspec/changes/return-patterns-308/{proposal,design,tasks}.md y specs/returns/spec.md.

Sin cambios de backend, Prisma, AppContext, dependencias o producción. Sin build, commit, push ni escrituras de git.
